from fastapi import HTTPException, Response
from services.user_service import (
    register_service,
    verify_email_service,
    login_service,
    refresh_access_token_service,
    forgot_password_service,
    reset_password_service,
    resend_verification_service,
    logout_service,
    get_user_by_id_service
)

def register_controller(email: str, password: str):
    return register_service(email, password)

def verify_email_controller(email: str, otp_code: str):
    return verify_email_service(email, otp_code)

def login_controller(email: str, password: str, response: Response):
    return login_service(email, password, response)

def refresh_token_controller(refresh_token: str, response: Response):
    return refresh_access_token_service(response, refresh_token)

def forgot_password_controller(email: str):
    return forgot_password_service(email)

def reset_password_controller(email: str, otp_code: str, new_password: str):
    return reset_password_service(email, otp_code, new_password)

def resend_verification_controller(email: str):
    return resend_verification_service(email)

def logout_controller(response: Response, refresh_token: str = None):
    return logout_service(response, refresh_token)

def get_user_by_id_controller(user_id: int):
    user = get_user_by_id_service(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
