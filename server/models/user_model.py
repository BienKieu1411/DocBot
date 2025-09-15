from .client_supabase import supabase
from datetime import datetime, timedelta, timezone
import secrets
from typing import Optional, Dict

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def db_create_user(email: str, hashed_password: str) -> Optional[Dict]:
    try:
        res = supabase.table("users").insert({
            "email": email,
            "hashed_password": hashed_password,
            "is_verified": False
        }).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_get_user_by_email(email: str) -> Optional[Dict]:
    try:
        res = supabase.table("users").select("*").eq("email", email).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_get_user_by_id(user_id: int) -> Optional[Dict]:
    try:
        res = supabase.table("users").select("*").eq("id", user_id).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_verify_user(user_id: int) -> Optional[Dict]:
    try:
        res = supabase.table("users").update({"is_verified": True}).eq("id", user_id).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_update_password(user_id: int, hashed_password: str) -> Optional[Dict]:
    try:
        res = supabase.table("users").update({"hashed_password": hashed_password}).eq("id", user_id).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_create_refresh_token(user_id: int) -> Optional[str]:
    try:
        db_cleanup_expired_refresh_tokens()
        supabase.table("refresh_tokens").delete().eq("user_id", user_id).execute()
        token = secrets.token_urlsafe(64)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
        supabase.table("refresh_tokens").insert({
            "user_id": user_id,
            "token": token,
            "expires_at": expires_at,
            "revoked": False
        }).execute()
        return token
    except:
        return None

def db_get_refresh_token(token: str) -> Optional[Dict]:
    try:
        res = supabase.table("refresh_tokens").select("*").eq("token", token).eq("revoked", False).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_revoke_refresh_token(token: str):
    try:
        supabase.table("refresh_tokens").update({"revoked": True}).eq("token", token).execute()
    except:
        pass

def db_create_otp(user_id: int, otp_code: Optional[str] = None) -> Optional[Dict]:
    try:
        db_cleanup_expired_otps()
        supabase.table("otp_codes").delete().eq("user_id", user_id).execute()

        if otp_code is None:
            otp_code = ''.join(secrets.choice("0123456789") for _ in range(6))

        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        res = supabase.table("otp_codes").insert({
            "user_id": user_id,
            "otp_code": otp_code,
            "expires_at": expires_at,
            "used": False
        }).execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_verify_otp(user_id: int, otp_code: str) -> Optional[Dict]:
    try:
        now = datetime.now(timezone.utc).isoformat()
        res = supabase.table("otp_codes").select("*")\
            .eq("user_id", user_id)\
            .eq("otp_code", otp_code)\
            .eq("used", False)\
            .gt("expires_at", now)\
            .execute()
        return res.data[0] if res.data else None
    except:
        return None

def db_mark_otp_used(otp_id: int):
    try:
        supabase.table("otp_codes").update({"used": True}).eq("id", otp_id).execute()
    except:
        pass

def db_cleanup_expired_otps():
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("otp_codes").delete().lt("expires_at", now).execute()
    except:
        pass

def db_cleanup_expired_refresh_tokens():
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("refresh_tokens").delete().lt("expires_at", now).execute()
    except:
        pass

def generate_otp_code(length: int = 6) -> str:
    return ''.join(secrets.choice("0123456789") for _ in range(length))
