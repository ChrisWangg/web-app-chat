# main.py
import os, json, time
from typing import List
from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from argon2 import PasswordHasher, exceptions as argon2_exceptions

app = FastAPI()
ph = PasswordHasher()


# ─── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── SESSION MIDDLEWARE ─────────────────────────────────────────────────────────
#  
# This signs & verifies an HttpOnly "session" cookie for you.
app.add_middleware(SessionMiddleware, secret_key="COMP6841")

# ─── Pydantic MODELS ─────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str

class MessageIn(BaseModel):
    to_email: str
    content: str

class Message(MessageIn):
    id: int
    from_email: str
    timestamp: float

class FriendRequest(BaseModel):
    username: str

# ─── SIMPLE FILE “DB” HELPERS ────────────────────────────────────────────────────
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

# ─── AUTH DEPENDENCY ────────────────────────────────────────────────────────────
async def get_current_user(request: Request):
    email = request.session.get("user")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not logged in")
    user = get_user(email)
    if not user:
        # in case they were deleted
        request.session.clear()
        raise HTTPException(status_code=401, detail="Invalid session")
    return user

# ─── ENDPOINTS ─────────────────────────────────────────────────────────────────

@app.post("/api/register", status_code=201)
def register(u: UserCreate):
    db = load_db()
    if get_user(u.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    pwd_hash = ph.hash(u.password)
    
    db["users"].append({"email": u.email, "password": pwd_hash})
    save_db(db)
    return {"email": u.email}

@app.post("/api/login")
def login(u: UserCreate, request: Request):
    user = get_user(u.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        ph.verify(user["password"], u.password)
    except argon2_exceptions.VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
     
    if ph.check_needs_rehash(user["password"]):
        user["password"] = ph.hash(u.password)
        db = load_db()
        for rec in db["users"]:
            if rec["email"] == user["email"]:
                rec["password"] = user["password"]
                break
        save_db(db)

    request.session["user"] = user["email"]
    return {"message": "Login successful", "email": user["email"]}

@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}

@app.get("/api/auth/me")
def whoami(user = Depends(get_current_user)):
    return {"email": user["email"]}

@app.get("/api/messages", response_model=List[Message])
def read_messages(user=Depends(get_current_user)):
    db = load_db()
    # only show messages to/from this user
    out = []
    for m in db["messages"]:
        if m["from_email"] == user["email"] or m["to_email"] == user["email"]:
            out.append(Message(**m))
    return out

@app.post("/api/messages", response_model=Message, status_code=201)
def create_message(msg: MessageIn, user=Depends(get_current_user)):
    db = load_db()
    next_id = max((m["id"] for m in db["messages"]), default=0) + 1
    obj = {
        "id": next_id,
        "from_email": user["email"],
        "to_email": msg.to_email,
        "content": msg.content,
        "timestamp": time.time(),
    }
    db["messages"].append(obj)
    save_db(db)
    return Message(**obj)


@app.post("/api/add-friend")
def add_friend(new_friend: FriendRequest, user=Depends(get_current_user)):
    if new_friend.username == user["email"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # Target must exist
    if not get_user(new_friend.username):
        raise HTTPException(status_code=404, detail="User not found")

    db = load_db()
    graph: dict = db.setdefault("friend_list", {})

    def add_edge(a: str, b: str):
        friends = set(graph.get(a, []))
        friends.add(b)
        graph[a] = list(friends)

    add_edge(user["email"], new_friend.username)
    add_edge(new_friend.username, user["email"])
    save_db(db)

    return {
        "added": new_friend.username,
        "by": user["email"],
    }
    
@app.get("/api/friends", response_model=List[str])
def list_friends(user=Depends(get_current_user)):
    db = load_db()
    friends = db.get("friend_list", {}).get(user["email"], [])
    return friends
