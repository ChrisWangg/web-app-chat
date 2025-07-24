# ────────────────────────────────────────────────────────────────────────────
#  main.py – FastAPI backend with dual‑wrapped AES keys for E2EE chat
# ────────────────────────────────────────────────────────────────────────────
import os, json, time
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from argon2 import PasswordHasher, exceptions as argon2_exceptions

app = FastAPI()
ph = PasswordHasher()

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Secure session cookie ───────────────────────────────────────────────────
app.add_middleware(SessionMiddleware, secret_key="COMP6841")

# ── Pydantic models ─────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str
    public_key: Optional[str] = None

class PublicKeyIn(BaseModel):
    key: str

class PublicKeyOut(PublicKeyIn):
    email: str

class MessageEncryptedIn(BaseModel):
    to_email: str
    ciphertext: str
    encrypted_key: str                      # wrapped for RECIPIENT
    encrypted_key_self: Optional[str] = ""  # wrapped for SENDER
    iv: str
    tag: str

class MessageEncrypted(MessageEncryptedIn):
    id: int
    from_email: str
    timestamp: float

class FriendRequest(BaseModel):
    username: str

# ── “DB” helpers ────────────────────────────────────────────────────────────
DB_FILE = "db.json"

def load_db():
    if not os.path.exists(DB_FILE):
        return {"users": [], "messages": []}
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(db: dict):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)

def get_user(email: str):
    return next((u for u in load_db()["users"] if u["email"] == email), None)

# ── Auth dependency ─────────────────────────────────────────────────────────
async def get_current_user(request: Request):
    email = request.session.get("user")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not logged in")
    user = get_user(email)
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Invalid session")
    return user

# ── Register / login / logout ───────────────────────────────────────────────
@app.post("/api/register", status_code=201)
def register(u: UserCreate):
    db = load_db()
    if get_user(u.email):
        raise HTTPException(400, "Email already registered")
    db["users"].append(
        {
            "email": u.email,
            "password": ph.hash(u.password),
            **({"public_key": u.public_key} if u.public_key else {}),
        }
    )
    save_db(db)
    return {"email": u.email, "public_key_saved": bool(u.public_key)}

@app.post("/api/login")
def login(u: UserCreate, request: Request):
    user = get_user(u.email)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    try:
        ph.verify(user["password"], u.password)
    except argon2_exceptions.VerifyMismatchError:
        raise HTTPException(401, "Invalid credentials")
    if ph.check_needs_rehash(user["password"]):
        user["password"] = ph.hash(u.password)
        save_db(load_db())
    request.session["user"] = user["email"]
    return {"message": "Login successful", "email": user["email"]}

@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}

@app.get("/api/auth/me")
def whoami(user=Depends(get_current_user)):
    return {"email": user["email"]}

# ── Public‑key exchange ─────────────────────────────────────────────────────
@app.post("/api/keys", status_code=201)
def upload_key(pub: PublicKeyIn, user=Depends(get_current_user)):
    db = load_db()
    for u in db["users"]:
        if u["email"] == user["email"]:
            u["public_key"] = pub.key
            break
    save_db(db)
    return {"stored": True}

@app.get("/api/keys/{email}", response_model=PublicKeyOut)
def download_key(email: str, _=Depends(get_current_user)):
    user = get_user(email)
    if not user or "public_key" not in user:
        raise HTTPException(404, "Key not found")
    return {"email": email, "key": user["public_key"]}

# ── Messaging ───────────────────────────────────────────────────────────────
@app.get("/api/messages", response_model=List[MessageEncrypted])
def read_messages(user=Depends(get_current_user)):
    db = load_db()
    out = [
        MessageEncrypted(
            **{
                **m,
                "encrypted_key_self": m.get("encrypted_key_self", ""),
            }
        )
        for m in db["messages"]
        if m["from_email"] == user["email"] or m["to_email"] == user["email"]
    ]
    return out

@app.post("/api/messages", response_model=MessageEncrypted, status_code=201)
def create_message(msg: MessageEncryptedIn, user=Depends(get_current_user)):
    if not get_user(msg.to_email):
        raise HTTPException(404, "Recipient not found")
    if "public_key" not in get_user(msg.to_email):
        raise HTTPException(400, "Recipient has not uploaded a key yet")

    db = load_db()
    next_id = max((m["id"] for m in db["messages"]), default=0) + 1
    obj = {
        "id": next_id,
        "from_email": user["email"],
        "to_email": msg.to_email,
        "ciphertext": msg.ciphertext,
        "encrypted_key": msg.encrypted_key,
        "encrypted_key_self": msg.encrypted_key_self or "",
        "iv": msg.iv,
        "tag": msg.tag,
        "timestamp": time.time(),
    }
    db["messages"].append(obj)
    save_db(db)
    return MessageEncrypted(**obj)

# ── Friend graph (unchanged) ────────────────────────────────────────────────
@app.post("/api/add-friend")
def add_friend(new_friend: FriendRequest, user=Depends(get_current_user)):
    if new_friend.username == user["email"]:
        raise HTTPException(400, "Cannot add yourself")
    if not get_user(new_friend.username):
        raise HTTPException(404, "User not found")

    db = load_db()
    graph: dict = db.setdefault("friend_list", {})
    graph.setdefault(user["email"], [])
    graph.setdefault(new_friend.username, [])
    if new_friend.username not in graph[user["email"]]:
        graph[user["email"]].append(new_friend.username)
    if user["email"] not in graph[new_friend.username]:
        graph[new_friend.username].append(user["email"])
    save_db(db)
    return {"added": new_friend.username, "by": user["email"]}

@app.get("/api/friends", response_model=List[str])
def list_friends(user=Depends(get_current_user)):
    return load_db().get("friend_list", {}).get(user["email"], [])
