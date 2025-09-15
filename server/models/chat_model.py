from .client_supabase import supabase
from datetime import datetime, timezone
from typing import Optional, Dict, List
import dotenv
from fastapi import UploadFile
import os

dotenv.load_dotenv()
BUCKET_NAME = os.getenv("SUPABASE_BUCKET", "uploads")


def get_chat_by_id(chat_id: int) -> Optional[Dict]:
    response = supabase.table("chat_sessions").select("*").eq("id", chat_id).execute()
    return response.data[0] if response.data else None


def get_chat_session_by_id(chat_id: int) -> Optional[Dict]:
    response = supabase.table("chat_sessions").select("*").eq("id", chat_id).execute()
    return response.data[0] if response.data else None


def get_messages_by_session_id(session_id: int) -> Optional[List[Dict]]:
    response = supabase.table("chat_messages").select("*").eq("session_id", session_id).execute()
    return response.data if response.data else None


def get_file_by_id(file_id: int) -> Optional[Dict]:
    response = supabase.table("files").select("*").eq("id", file_id).execute()
    return response.data[0] if response.data else None


def get_files_by_session_id(session_id: int) -> Optional[List[Dict]]:
    response = supabase.table("session_files").select("*").eq("session_id", session_id).execute()
    return response.data if response.data else None


def get_chat_sessions_by_user_id(user_id: int) -> Optional[List[Dict]]:
    response = supabase.table("chat_sessions").select("*").eq("user_id", user_id).execute()
    return response.data if response.data else None


def create_chat_session(user_id: int, title: str = "New Chat") -> Optional[Dict]:
    now = datetime.now(timezone.utc).isoformat()
    new_chat = {
        "user_id": user_id,
        "session_name": title,
        "created_at": now,
        "updated_at": now,
    }
    response = supabase.table("chat_sessions").insert(new_chat).execute()
    return response.data[0] if response.data else None


def create_chat_message(session_id: int, role: str, content: str) -> Optional[Dict]:
    now = datetime.now(timezone.utc).isoformat()
    new_message = {
        "session_id": session_id,
        "role": role,
        "message": content,
        "created_at": now,
    }
    response = supabase.table("chat_messages").insert(new_message).execute()
    if response.data:
        supabase.table("chat_sessions").update({"updated_at": now}).eq("id", session_id).execute()
        return response.data[0]
    return None


def update_chat_session_name(session_id: int, new_name: str) -> Optional[Dict]:
    updates = {"session_name": new_name, "updated_at": datetime.now(timezone.utc).isoformat()}
    response = supabase.table("chat_sessions").update(updates).eq("id", session_id).execute()
    return response.data[0] if response.data else None


def update_chat_session_title(session_id: int, new_title: str) -> Optional[Dict]:
    updates = {"session_name": new_title, "updated_at": datetime.now(timezone.utc).isoformat()}
    response = supabase.table("chat_sessions").update(updates).eq("id", session_id).execute()
    return response.data[0] if response.data else None


def delete_chat_session(session_id: int) -> bool:
    files = get_files_by_session_id(session_id)
    file_ids = [file["file_id"] for file in files] if files else []
    for file_id in file_ids:
        delete_file_chunks(file_id)
        supabase.table("session_files").delete().eq("session_id", session_id).eq("file_id", file_id).execute()
    supabase.table("files").delete().in_("id", file_ids).execute()
    response = supabase.table("chat_sessions").delete().eq("id", session_id).execute()
    return bool(response.data)


def delete_file_from_session(file_id: int) -> bool:
    delete_file_chunks(file_id)
    response = supabase.table("session_files").delete().eq("file_id", file_id).execute()
    return bool(response.data)


def create_file_chunks(file_id: int, chunks: List[Dict]) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    chunk_records = []

    for chunk in chunks:
        embedding = chunk.get("embedding")
        if embedding is None:
            print(f"Skipping chunk {chunk.get('chunk_index')} due to missing embedding")
            continue
        chunk_records.append({
            "session_id": chunk.get("session_id"),
            "file_id": file_id,
            "chunk_index": chunk.get("chunk_index"),
            "text": chunk.get("text"),
            "embedding_model": chunk.get("embedding_model", "all-MiniLM-L6-v2"),
            "embedding": embedding,
            "chunk_size": chunk.get("chunk_size"),
            "created_at": now,
        })

    if not chunk_records:
        print("No valid chunks to insert for file_id:", file_id)
        return False

    response = supabase.table("file_chunks").insert(chunk_records).execute()
    if response.data:
        print(f"Inserted {len(chunk_records)} chunks for file_id: {file_id}")
        return True
    else:
        print("Failed to insert chunks for file_id:", file_id)
        return False


def delete_file_chunks(file_id: int) -> bool:
    response = supabase.table("file_chunks").delete().eq("file_id", file_id).execute()
    return bool(response.data)


def get_file_chunks_by_file_id(file_id: int) -> Optional[List[Dict]]:
    response = supabase.table("file_chunks").select("*").eq("file_id", file_id).execute()
    return response.data if response.data else None


def get_file_chunks_by_session_id(session_id: int) -> Optional[List[Dict]]:
    response = supabase.table("file_chunks").select("*").eq("session_id", session_id).execute()
    return response.data if response.data else None


def count_chat_session_not_have_file(user_id: int) -> int:
    session_files = supabase.table("session_files").select("session_id").execute().data
    session_ids = [s["session_id"] for s in session_files] if session_files else []
    query = supabase.table("chat_sessions").select("id", count="exact").eq("user_id", user_id)
    if session_ids:
        ids_str = "(" + ",".join(map(str, session_ids)) + ")"
        query = query.filter("id", "not.in", ids_str)
    response = query.execute()
    return response.count if hasattr(response, "count") else 0


def get_chat_session_not_have_file(user_id: int) -> Optional[Dict]:
    all_sessions = supabase.table("chat_sessions").select("*").eq("user_id", user_id).execute()
    if not all_sessions.data:
        return None
    linked_sessions = supabase.table("session_files").select("session_id").execute().data
    linked_ids = {s["session_id"] for s in linked_sessions} if linked_sessions else set()
    for session in all_sessions.data:
        if session["id"] not in linked_ids:
            return session
    return None


def upload_file(user_id: int, uploaded_file: UploadFile) -> Dict:
    storage_path = f"{user_id}/{uploaded_file.filename}"
    content = uploaded_file.file.read()
    res = supabase.storage.from_(BUCKET_NAME).upload(storage_path, content, {"content-type": uploaded_file.content_type, "upsert": "true"})
    if not res or (isinstance(res, dict) and res.get("error")):
        raise Exception("Upload failed")
    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
    file_record = {
        "user_id": user_id,
        "filename": uploaded_file.filename,
        "file_url": public_url,
        "file_type": uploaded_file.content_type,
        "file_size": len(content),
    }
    db_res = supabase.table("files").insert(file_record).execute()
    file_id = db_res.data[0]["id"] if db_res.data else None
    return {"id": file_id, "db_response": db_res.data}


def link_file_to_session(session_id: int, file_id: int) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    link_record = {"session_id": session_id, "file_id": file_id, "created_at": now}
    response = supabase.table("session_files").insert(link_record).execute()
    return bool(response.data)
