from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from typing import Optional
from auth import get_current_user
from controllers import chat_controller
from pydantic import BaseModel

router = APIRouter(prefix="", tags=["chats"])

@router.get("/user/")
def get_chats_by_user(user_id: int = Depends(get_current_user)):
    sessions = chat_controller.get_chat_sessions_by_user_id(user_id)
    return sessions if sessions else []

@router.post("/create")
def create_chat(title: Optional[str] = Query("New Chat"), user_id: int = Depends(get_current_user)):
    return chat_controller.create_new_chat_session(user_id, title)

@router.get("/user/{user_id}")
def get_chats_by_user_id(user_id: int):
    return chat_controller.get_chat_sessions_by_user_id(user_id)

@router.get("/file/{file_id}")
def get_file(file_id: int):
    return chat_controller.get_file(file_id)

@router.get("/session/{chat_id}")
def get_chat(chat_id: int):
    return chat_controller.get_chat_session_by_id(chat_id)

@router.get("/session/{chat_id}/messages")
def get_messages(chat_id: int):
    return chat_controller.get_chat_messages(chat_id)

@router.get("/session/{chat_id}/files")
def get_files(chat_id: int):
    return chat_controller.get_files(chat_id)

@router.post("/session/{session_id}/upload")
def upload_file(session_id: int, file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    return chat_controller.upload_file(user_id, session_id, file)

class MessageCreate(BaseModel):
    role: str
    content: str

@router.post("/session/{chat_id}/messages")
def create_message(chat_id: int, message: MessageCreate):
    return chat_controller.create_chat_message(chat_id, message.role, message.content)

class RenameRequest(BaseModel):
    new_name: str
    
@router.put("/session/{chat_id}/rename")
def rename_chat(chat_id: int, request: RenameRequest):
    return chat_controller.rename_chat_session(chat_id, request.new_name)

@router.delete("/session/{chat_id}")
def delete_chat(chat_id: int):
    return chat_controller.delete_chat_session(chat_id)

@router.delete("/file/{file_id}")
def delete_file(file_id: int):
    return chat_controller.delete_file(file_id)

class ProcessRequest(BaseModel):
    user_message: str

@router.post("/session/{chat_id}/process")
def process_message(chat_id: int, request: ProcessRequest):
    return chat_controller.process_user_message(chat_id, request.user_message)