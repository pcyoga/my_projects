"""
PostureCare Python Edition - Storage & Persistence Manager
Exact 1-to-1 conversion of /src/utils/storage.ts
Handles local JSON database persistence, presets, sessions, goals, and user profiles.
"""
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import asdict
from models import (
    UserProfile,
    BaselineProfile,
    PostureSession,
    PostureAlert,
    UserGoal,
    NotificationPreferences,
    AuthState
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

DEFAULT_USER = UserProfile(
    id="usr_user_01",
    fullName="PostureCare User",
    email="user@workspace.local",
    occupation="Workstation User",
    computerUsageHours=8,
    primaryActivity="general",
    breakFrequencyMinutes=45,
    primaryObjective="Maintain healthy spinal alignment and ergonomic posture",
    hasCompletedOnboarding=True,
    createdAt="2026-09-01T09:00:00Z"
)

def get_sample_sessions() -> List[Dict[str, Any]]:
    now = datetime.now()
    return [
        {
            "id": "ses_01",
            "userId": "usr_alex",
            "postureProfileId": "base_01",
            "startTime": (now - timedelta(minutes=180)).isoformat(),
            "endTime": (now - timedelta(minutes=125)).isoformat(),
            "durationSeconds": 3300,
            "averageScore": 92,
            "goodSeconds": 2800,
            "warningSeconds": 380,
            "poorSeconds": 120,
            "alertCount": 2,
            "primaryDeviation": "Slight right shoulder slump near the 45m mark"
        },
        {
            "id": "ses_02",
            "userId": "usr_alex",
            "postureProfileId": "base_01",
            "startTime": (now - timedelta(minutes=360)).isoformat(),
            "endTime": (now - timedelta(minutes=270)).isoformat(),
            "durationSeconds": 5400,
            "averageScore": 86,
            "goodSeconds": 4320,
            "warningSeconds": 780,
            "poorSeconds": 300,
            "alertCount": 4,
            "primaryDeviation": "Forward head tilt during deep concentration"
        },
        {
            "id": "ses_03",
            "userId": "usr_alex",
            "postureProfileId": "base_01",
            "startTime": (now - timedelta(days=1)).isoformat(),
            "endTime": (now - timedelta(days=1, hours=-2)).isoformat(),
            "durationSeconds": 7200,
            "averageScore": 89,
            "goodSeconds": 6120,
            "warningSeconds": 780,
            "poorSeconds": 300,
            "alertCount": 5,
            "primaryDeviation": "Mid-torso slouching after 90m continuous sitting"
        }
    ]

class LocalStorageManager:
    def __init__(self, filename="storage.json"):
        self.file_path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(self.file_path):
            self._init_defaults()

    def _read_data(self) -> Dict[str, Any]:
        try:
            with open(self.file_path, "r") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_data(self, data: Dict[str, Any]):
        with open(self.file_path, "w") as f:
            json.dump(data, f, indent=2)

    def _init_defaults(self):
        initial = {
            "auth": {
                "isAuthenticated": True,
                "user": asdict(DEFAULT_USER)
            },
            "user_profile": asdict(DEFAULT_USER),
            "baseline": {
                "id": "base_01",
                "userId": DEFAULT_USER.id,
                "name": "Standard Desk Setup",
                "headAngle": 1.5,
                "neckAngle": 4.2,
                "shoulderAngle": 0.8,
                "torsoAngle": 2.1,
                "cameraDistance": 1.0,
                "toleranceLevel": "standard",
                "calibratedAt": datetime.now().isoformat(),
                "isActive": True
            },
            "sessions": get_sample_sessions(),
            "goals": [
                {
                    "id": "goal_01",
                    "title": "Maintain > 80% Good Posture Daily",
                    "type": "good_posture_percent",
                    "targetValue": 80,
                    "currentValue": 84,
                    "unit": "%",
                    "status": "in_progress",
                    "startDate": "2026-08-25",
                    "targetDate": "2026-09-05",
                    "category": "daily"
                },
                {
                    "id": "goal_02",
                    "title": "Keep Alerts Below 4 Per Session",
                    "type": "max_alerts",
                    "targetValue": 4,
                    "currentValue": 3,
                    "unit": "alerts",
                    "status": "in_progress",
                    "startDate": "2026-08-25",
                    "targetDate": "2026-09-01",
                    "category": "habit"
                }
            ],
            "preferences": {
                "dailyReminders": True,
                "dailyReminderTime": "09:30",
                "postureAlerts": True,
                "soundAlerts": True,
                "soundVolume": 0.7,
                "breakReminders": True,
                "breakReminderMinutes": 45,
                "alertSensitivity": "medium",
                "alertDelaySeconds": 3,
                "cooldownSeconds": 10
            }
        }
        self._write_data(initial)

    # Auth Methods
    def get_auth_state(self) -> Dict[str, Any]:
        data = self._read_data()
        return data.get("auth", {"isAuthenticated": True, "user": asdict(PRESET_ACCOUNTS[0])})

    def set_auth_state(self, auth_data: Dict[str, Any]):
        data = self._read_data()
        data["auth"] = auth_data
        self._write_data(data)

    def logout(self):
        data = self._read_data()
        data["auth"] = {"isAuthenticated": False, "user": None}
        self._write_data(data)

    def register_user(self, email: str, full_name: str = "", occupation: str = "Workstation User", objective: str = "Maintain healthy spinal posture") -> Dict[str, Any]:
        data = self._read_data()
        users = data.get("registered_users", [])
        now_str = datetime.now().isoformat()
        user_dict = {
            "id": f"usr_{int(datetime.now().timestamp())}",
            "fullName": full_name or email.split('@')[0].capitalize(),
            "email": email.strip().lower(),
            "occupation": occupation,
            "computerUsageHours": 8,
            "primaryActivity": "general",
            "breakFrequencyMinutes": 45,
            "primaryObjective": objective,
            "hasCompletedOnboarding": False,
            "createdAt": now_str
        }
        # Update or append
        existing = [u for u in users if u.get("email", "").lower() == email.strip().lower()]
        if existing:
            users = [user_dict if u.get("email", "").lower() == email.strip().lower() else u for u in users]
        else:
            users.append(user_dict)
        data["registered_users"] = users

        # Log simulated welcome email
        emails = data.get("email_logs", [])
        email_log = {
            "id": f"mail_{int(datetime.now().timestamp())}",
            "fromAddress": "PostureCare <posturehealthcare@gmail.com>",
            "replyTo": "no-reply@posturehealthcare.com",
            "recipientEmail": email.strip().lower(),
            "recipientName": user_dict["fullName"],
            "subject": f"Welcome to PostureCare, {user_dict['fullName']}! Please log in to get started.",
            "sentAt": now_str,
            "status": "delivered",
            "previewSnippet": "Welcome to PostureCare! Sent from posturehealthcare@gmail.com (no-reply)."
        }
        emails.insert(0, email_log)
        data["email_logs"] = emails[:50]

        self._write_data(data)
        return user_dict

    def find_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        data = self._read_data()
        users = data.get("registered_users", [])
        for u in users:
            if u.get("email", "").lower() == email.strip().lower():
                return u
        return None

    def login_user(self, email: str, full_name: str = "") -> Dict[str, Any]:
        existing = self.find_user_by_email(email)
        if existing:
            user_dict = existing
        else:
            user_dict = {
                "id": f"usr_{int(datetime.now().timestamp())}",
                "fullName": full_name or email.split('@')[0].capitalize(),
                "email": email.strip().lower(),
                "occupation": "Workstation User",
                "computerUsageHours": 8,
                "primaryActivity": "general",
                "breakFrequencyMinutes": 45,
                "primaryObjective": "Maintain healthy spinal alignment and posture",
                "hasCompletedOnboarding": True,
                "createdAt": datetime.now().isoformat()
            }
        self.set_auth_state({"isAuthenticated": True, "user": user_dict})
        self.save_user_profile(user_dict)
        return user_dict

    # User Profile
    def get_user_profile(self) -> Dict[str, Any]:
        data = self._read_data()
        return data.get("user_profile", asdict(DEFAULT_USER))

    def save_user_profile(self, profile: Dict[str, Any]):
        data = self._read_data()
        data["user_profile"] = profile
        if data.get("auth", {}).get("isAuthenticated"):
            data["auth"]["user"] = profile
        self._write_data(data)

    # Baseline Profile
    def get_baseline_profile(self) -> Optional[Dict[str, Any]]:
        data = self._read_data()
        return data.get("baseline")

    def save_baseline_profile(self, baseline: Dict[str, Any]):
        data = self._read_data()
        data["baseline"] = baseline
        self._write_data(data)

    # Sessions
    def get_sessions(self) -> List[Dict[str, Any]]:
        data = self._read_data()
        return data.get("sessions", [])

    def save_session(self, session: Dict[str, Any]):
        data = self._read_data()
        sessions = data.get("sessions", [])
        sessions.insert(0, session)
        data["sessions"] = sessions
        self._write_data(data)
        # Also persist directly into ACID relational database
        try:
            from database import db
            db.save_session_transactional(session)
        except Exception as e:
            print(f"[Storage] SQLite sync notice: {e}")

    def clear_sessions(self):
        data = self._read_data()
        data["sessions"] = []
        self._write_data(data)

    # Database Retrieval Integration
    def get_database_manager(self):
        from database import db
        return db

    def get_db_metrics(self, days: int = 7) -> Dict[str, Any]:
        from database import db
        return db.get_aggregated_posture_metrics(days=days)

    def get_db_trends(self, days: int = 7) -> List[Dict[str, Any]]:
        from database import db
        return db.get_daily_score_trends(days=days)

    def get_db_top_deviations(self, limit: int = 5) -> List[Dict[str, Any]]:
        from database import db
        return db.get_top_posture_deviations(limit=limit)

    def get_db_sessions_by_range(self, user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        from database import db
        return db.get_sessions_by_date_range(user_id, start_date, end_date)

    # Goals
    def get_goals(self) -> List[Dict[str, Any]]:
        data = self._read_data()
        return data.get("goals", [])

    def save_goals(self, goals: List[Dict[str, Any]]):
        data = self._read_data()
        data["goals"] = goals
        self._write_data(data)

    # Preferences
    def get_preferences(self) -> Dict[str, Any]:
        data = self._read_data()
        return data.get("preferences", {
            "dailyReminders": True,
            "dailyReminderTime": "09:30",
            "postureAlerts": True,
            "soundAlerts": True,
            "soundVolume": 0.7,
            "breakReminders": True,
            "breakReminderMinutes": 45,
            "alertSensitivity": "medium",
            "alertDelaySeconds": 3,
            "cooldownSeconds": 10
        })

    def save_preferences(self, prefs: Dict[str, Any]):
        data = self._read_data()
        data["preferences"] = prefs
        self._write_data(data)

storage = LocalStorageManager()
