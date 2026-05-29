# config.py
import os

# DB settings - update these
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "root123"),
    "database": os.getenv("DB_NAME", "expense_db"),
    "port": int(os.getenv("DB_PORT", 3306))
}

# Flask secret key
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-prod")

# Notification (SMTP) settings - update with real SMTP if you want email notifications
SMTP_CONFIG = {
    "smtp_host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
    "smtp_port": int(os.getenv("SMTP_PORT", 587)),
    "smtp_user": os.getenv("SMTP_USER", "youremail@example.com"),
    "smtp_pass": os.getenv("SMTP_PASS", "your-email-password")
}

# Power BI Integration hints
POWERBI = {
    "report_url": os.getenv("POWERBI_REPORT_URL", ""),  # e.g., publish-to-web url or hosted report link
    # For secure embed you would add workspace id, report id, client id, tenant id etc.
}