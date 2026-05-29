# auth.py
import bcrypt
from werkzeug.security import check_password_hash, generate_password_hash
from db import get_connection
from models import get_user_by_email, create_user

def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()

def check_password(plain_password: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed.encode())

def signup_user(email, password):

    conn = get_connection()
    cursor = conn.cursor()

    password_hash = generate_password_hash(password)

    cursor.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s,%s)",
        (email, password_hash)
    )

    conn.commit()

    user_id = cursor.lastrowid

    cursor.close()
    conn.close()

    return user_id

def login_user(email, password):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    cursor.execute(
        "SELECT id, email, password_hash FROM users WHERE email=%s",
        (email,)
    )

    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if user and check_password_hash(user["password_hash"], password):
        return user

    return None