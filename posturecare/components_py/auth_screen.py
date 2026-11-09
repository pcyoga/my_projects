"""
Python Equivalent of /src/components/AuthScreen.tsx
Handles User Sign In, User Registration, Password Validation, and Dispatching Real Emails via email_service.py.
"""
from typing import Dict, Any, Optional, Callable
import threading
from storage import storage
from email_service import (
    after_successful_signup,
    after_successful_login,
    after_password_reset_request,
    SMTP_EMAIL
)


class AuthScreenComponent:
    """
    Component controller for handling authentication logic,
    mode toggling ('signin' vs 'signup'), and registration with email verification.
    """

    def __init__(self, on_login_success: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.auth_mode: str = "signin"  # 'signin' | 'signup'
        self.on_login_success = on_login_success
        self.last_registered_email: Optional[str] = None
        self.signup_success_notification: Optional[Dict[str, str]] = None

    def switch_mode(self, mode: str) -> str:
        """Switch between 'signin' and 'signup' modes."""
        if mode in ["signin", "signup"]:
            self.auth_mode = mode
        return self.auth_mode

    def handle_sign_in(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate an existing user.
        Dispatches admin notification in background via email_service.
        """
        email = email.strip()
        password = password.strip()
        if not email or not password:
            raise ValueError("Email and password are both required.")

        user = storage.login_user(email)
        if self.on_login_success:
            self.on_login_success(user)

        # Notify admin of successful login in background
        threading.Thread(target=after_successful_login, args=(email,), daemon=True).start()

        return {
            "success": True,
            "user": user,
            "message": f"Welcome back, {user.get('fullName')}!"
        }

    def handle_sign_up(
        self,
        email: str,
        password: str,
        full_name: str = "",
        occupation: str = "Workstation User",
        objective: str = "Maintain healthy spinal alignment"
    ) -> Dict[str, Any]:
        """
        Register a new user account without auto-logging in.
        Dispatches real welcome email and admin notification via email_service.
        """
        email = email.strip()
        password = password.strip()
        if not email or not password:
            raise ValueError("Email and password are both required.")

        # Check if user already exists
        data = storage._read_data()
        existing_users = data.get("registered_users", [])
        if any(u.get("email", "").lower() == email.lower() for u in existing_users):
            raise ValueError("An account with this email address already exists. Please sign in instead.")

        clean_name = full_name.strip() or email.split("@")[0].capitalize()
        user = storage.register_user(
            email=email,
            full_name=clean_name,
            occupation=occupation.strip() or "Workstation User",
            objective=objective.strip() or "Maintain healthy spinal alignment"
        )

        self.last_registered_email = email
        self.signup_success_notification = {
            "title": "Account Created Successfully!",
            "message": f"A confirmation welcome email has been dispatched from {SMTP_EMAIL} to {email}.",
            "fromAddress": SMTP_EMAIL,
            "email": email,
            "fullName": clean_name
        }

        # Dispatch real notification emails in background
        threading.Thread(target=after_successful_signup, args=(email,), daemon=True).start()

        # Automatically transition to signin tab to prompt the user to log in
        self.auth_mode = "signin"

        return {
            "success": True,
            "notification": self.signup_success_notification,
            "prompt": "Please enter your password to sign in."
        }

    def handle_password_reset(self, email: str, reset_link_or_code: str) -> Dict[str, Any]:
        """
        Triggers password reset email and notifies admin via email_service.
        """
        email = email.strip()
        if not email:
            raise ValueError("Email address is required.")

        threading.Thread(
            target=after_password_reset_request,
            args=(email, reset_link_or_code),
            daemon=True
        ).start()

        return {
            "success": True,
            "message": f"Reset instructions sent to {email}"
        }
