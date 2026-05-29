# db.py
import mysql.connector
from mysql.connector import Error
from config import DB_CONFIG

def get_connection():
    conn = mysql.connector.connect(
        host=DB_CONFIG["host"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        database=DB_CONFIG["database"],
        port=DB_CONFIG.get("port", 3306),
        autocommit=False
    )
    return conn