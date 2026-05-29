# notifier.py
import smtplib
from email.message import EmailMessage
from config import SMTP_CONFIG
from db import get_connection

def send_email(to_email, subject, body):
    msg = EmailMessage()
    msg["From"] = SMTP_CONFIG["smtp_user"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(SMTP_CONFIG["smtp_host"], SMTP_CONFIG["smtp_port"]) as s:
        s.starttls()
        s.login(SMTP_CONFIG["smtp_user"], SMTP_CONFIG["smtp_pass"])
        s.send_message(msg)

def record_notification(user_id, message):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO notifications (user_id, message) VALUES (%s,%s)", (user_id, message))
    conn.commit()
    cur.close(); conn.close()

def notify_if_exceeded(user, personal, current_month_total):

    budget = float(personal.get("monthly_budget") or 0)

    if budget == 0:
        return False, ""

    threshold = float(personal.get("alert_threshold", 80))

    percentage = (current_month_total / budget) * 100 if budget else 0

    if threshold == 0:
        return False, ""

    if percentage >= threshold and percentage < 100:
        return True, f"⚠️ You have used {percentage:.0f}% of your budget"

    elif percentage >= 100:
        return True, "🚨 Budget exceeded!"

    return False, ""