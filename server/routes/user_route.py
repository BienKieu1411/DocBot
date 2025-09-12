from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, EmailStr
from auth import get_current_user
from controllers.user_controller import (
    register_controller,
    verify_email_controller,
    login_controller,
    refresh_token_controller,
    forgot_password_controller,
    reset_password_controller,
    resend_verification_controller,
    logout_controller,
    get_user_by_id_controller
)

router = APIRouter(prefix="") 

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_password: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp_code: str

@router.post("/register")
def register(data: RegisterRequest):
    return register_controller(data.email, data.password)

@router.post("/verify")
def verify_email(data: VerifyEmailRequest):
    return verify_email_controller(data.email, data.otp_code)

@router.post("/login")
def login(data: LoginRequest, response: Response):
    return login_controller(data.email, data.password, response)

@router.post("/refresh-token")
def refresh_token(response: Response, data: RefreshTokenRequest):
    return refresh_token_controller(data.refresh_token, response)

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    return forgot_password_controller(data.email)

@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    return reset_password_controller(data.email, data.otp_code, data.new_password)

@router.post("/resend-verification")
def resend_verification(data: ResendVerificationRequest):
    return resend_verification_controller(data.email)

@router.post("/logout")
def logout(response: Response, data: RefreshTokenRequest = None):
    return logout_controller(response, data.refresh_token if data else None)

@router.get("/profile")
def get_profile(current_user: str = Depends(get_current_user)):
    return get_user_by_id_controller(current_user)
