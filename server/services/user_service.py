from models.user_model import (
    db_create_user, db_get_user_by_email, db_verify_user, db_update_password, 
    db_create_refresh_token, db_get_refresh_token, db_revoke_refresh_token, 
    db_create_otp, db_verify_otp, db_mark_otp_used, db_get_user_by_id,
)
from fastapi import HTTPException, Response
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import jwt
import smtplib
from email.mime.text import MIMEText
import os
from pathlib import Path

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "supersecret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str):
    return pwd_context.verify(password, hashed)

def create_access_token(user_id: int):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"user_id": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def load_email_template(template_name: str, **kwargs) -> str:
    template_path = Path(__file__).parent.parent / "mail_sender" / template_name
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    for key, value in kwargs.items():
        template = template.replace(f'{{{key}}}', str(value))
    return template

def send_email(to_email: str, subject: str, body: str, is_html: bool = False):
    msg = MIMEText(body, 'html' if is_html else 'plain')
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD]):
        return True
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [to_email], msg.as_string())
    return True

def register_service(email: str, password: str):
    if db_get_user_by_email(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(password)
    user = db_create_user(email, hashed)
    otp_code = db_create_otp(user["id"])["otp_code"]
    try:
        email_body = load_email_template("verify-email-template.html", otp_code=otp_code, user_email=email)
        send_email(email, "DocBot - Mã xác nhận tài khoản", email_body, is_html=True)
        message = "Registered successfully! Please check your email for verification code."
    except:
        message = "Registered successfully! Please check your email for verification code. (Email may be unavailable)"
    return {"success": True, "message": message, "email": email, "instructions": "Enter the 6-digit code from your email to verify your account"}

def verify_email_service(email: str, otp_code: str):
    user = db_get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    otp_data = db_verify_otp(user["id"], otp_code)
    if not otp_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    expires_at = datetime.fromisoformat(otp_data["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP code has expired")
    db_verify_user(user["id"])
    db_mark_otp_used(otp_data["id"])
    return {"success": True, "message": "Email verified successfully"}

def login_service(email: str, password: str, response: Response):
    user = db_get_user_by_email(email)
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user["is_verified"]:
        raise HTTPException(status_code=401, detail="Email not verified")
    access_token = create_access_token(user["id"])
    refresh_token = db_create_refresh_token(user["id"])
    response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="None", max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60)
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True, samesite="None", max_age=7*24*3600)
    return {"success": True, "user": {"id": user["id"], "email": user["email"], "avatar_url": user.get("avatar_url")}}

def refresh_access_token_service(response: Response, refresh_token: str):
    token_data = db_get_refresh_token(refresh_token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access_token = create_access_token(token_data["user_id"])
    response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="None", max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60)
    return {"success": True}

def forgot_password_service(email: str):
    user = db_get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    otp_code = db_create_otp(user["id"])["otp_code"]
    email_body = load_email_template("reset-password-template.html", otp_code=otp_code, user_email=email)
    send_email(email, "DocBot - Code Reset Password", email_body, is_html=True)
    return {"success": True, "message": "Password reset code sent"}

def reset_password_service(email: str, otp_code: str, new_password: str):
    user = db_get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    otp_data = db_verify_otp(user["id"], otp_code)
    if not otp_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    expires_at = datetime.fromisoformat(otp_data["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP code has expired")
    hashed = hash_password(new_password)
    db_update_password(user["id"], hashed)
    db_mark_otp_used(otp_data["id"])
    return {"success": True, "message": "Password reset successfully"}

def resend_verification_service(email: str):
    user = db_get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    if user["is_verified"]:
        raise HTTPException(status_code=400, detail="Email already verified")
    otp_code = db_create_otp(user["id"])["otp_code"]
    email_body = load_email_template("verify-email-template.html", otp_code=otp_code, user_email=email)
    send_email(email, "DocBot - Mã xác nhận tài khoản", email_body, is_html=True)
    return {"success": True, "message": "Verification code sent"}

def logout_service(response: Response, refresh_token: str = None):
    if refresh_token:
        db_revoke_refresh_token(refresh_token)
    response.delete_cookie("access_token", samesite="None", secure=True)
    response.delete_cookie("refresh_token", samesite="None", secure=True)
    return {"success": True, "message": "Logged out successfully"}

def get_user_by_id_service(user_id: int):
    user = db_get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": {"id": user["id"], "email": user["email"], "avatar_url": user.get("avatar_url")}}
