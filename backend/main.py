from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

app = FastAPI()

# Allow your frontend to call these endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class UserCreate(BaseModel):
    email: str
    password: str

class Message(BaseModel):
    id: int
    from_email: str
    to_email: str
    content: str
    timestamp: str

# File that holds your “database”
DB_FILE = "db.json"

def load_db():
    if not os.path.exists(DB_FILE):
        # initialize empty shape if file doesn't exist
        return {"users": [], "messages": []}
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(db: dict):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)

@app.get("/api/users")
def read_users():
    db = load_db()
    return db["users"]

@app.get("/api/messages")
def read_messages():
    db = load_db()
    return db["messages"]

@app.post("/api/register")
def register(user: UserCreate):
    db = load_db()
    users = db["users"]
    if any(u["email"] == user.email for u in users):
        raise HTTPException(status_code=400, detail="Email already registered")
    users.append({"email": user.email, "password": user.password})
    db["users"] = users
    save_db(db)
    return {"email": user.email}

@app.post("/api/login")
def login(user: UserCreate):
    db = load_db()
    users = db["users"]
    match = next((u for u in users if u["email"] == user.email), None)
    if not match or match["password"] != user.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful", "email": user.email}

@app.post("/api/messages")
def create_message(msg: Message):
    db = load_db()
    messages = db["messages"]
    messages.append(msg.dict())
    db["messages"] = messages
    save_db(db)
    return msg
