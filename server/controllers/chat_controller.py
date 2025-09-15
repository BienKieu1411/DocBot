from typing import Optional, Dict, List
from fastapi import UploadFile
import services.chat_service as chat_service


def get_chat_session_by_id(chat_id: int) -> Dict:
    return chat_service.get_chat_session_by_id(chat_id)


def get_chat_sessions_by_user_id(user_id: int) -> list:
    return chat_service.get_chat_sessions_by_user_id(user_id)


def get_chat_messages(session_id: int) -> list:
    return chat_service.get_messages_by_chat_session_id(session_id)


def get_file(file_id: int) -> Dict:
    return chat_service.get_file_info_by_id(file_id)


def get_files(session_id: int) -> list:
    return chat_service.get_files_info_by_session_id(session_id)


def create_new_chat_session(user_id: int, title: str = "New Chat") -> Dict:
    return chat_service.create_new_chat_session(user_id, title)


def create_chat_message(session_id: int, role: str, content: str) -> Dict:
    return chat_service.create_new_chat_message(session_id, role, content)


def rename_chat_session(session_id: int, new_name: str) -> Dict:
    return chat_service.update_chat_session(session_id, new_name)


def delete_chat_session(session_id: int) -> bool:
    return chat_service.delete_chat_session_by_id(session_id)


def delete_file(file_id: int) -> bool:
    return chat_service.delete_file_from_session(file_id)


def process_user_message(session_id: int, user_message: str) -> Dict:
    return chat_service.process_user_message(session_id, user_message)

def upload_file(user_id: int, session_id: int, file: UploadFile) -> Dict:
    return chat_service.upload_file(user_id, session_id, file)
