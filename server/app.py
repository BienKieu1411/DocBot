import os
import sys

# Ensure local server package modules (routes, controllers, services, auth) are importable in serverless envs
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.user_route import router as user_router
from routes.chat_route import router as chat_router

app = FastAPI(title="Doc Chat App API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router, prefix="/user")
app.include_router(chat_router, prefix="/chat")

@app.get("/")
def root():
    return {"message": "Doc Chat App API running"}

@app.get("/health")
def health():
    return {"ok": True}