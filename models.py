# models.py
from db import get_connection
from datetime import date

def get_user_by_email(email):

    conn = get_connection()
    cur = conn.cursor(dictionary=True, buffered=True)

    cur.execute("SELECT * FROM users WHERE email=%s", (email,))
    row = cur.fetchone()

    cur.close()
    conn.close()

    return row

def create_user(email, password_hash):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("INSERT INTO users (email, password_hash) VALUES (%s,%s)", (email, password_hash))
    conn.commit()
    user_id = cur.lastrowid
    cur.close(); conn.close()
    return user_id

def save_personal_details(user_id, full_name, monthly_salary, currency, phone, city, image):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO personal_details
        (user_id, full_name, monthly_salary, currency, phone, city, image)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (user_id, full_name, monthly_salary, currency, phone, city, image))

    conn.commit()
    cursor.close()
    conn.close()

def get_personal_details(user_id):
    conn = get_connection()
    cur = conn.cursor(dictionary=True, buffered=True)
    cur.execute("SELECT * FROM personal_details WHERE user_id=%s", (user_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row

def add_expense(user_id, category, amount, expense_date=None, note=None):
    if expense_date is None:
        expense_date = date.today()
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""INSERT INTO expenses (user_id, category, amount, expense_date, note)
                   VALUES (%s,%s,%s,%s,%s)""",
                (user_id, category, amount, expense_date, note))
    conn.commit()
    cur.close(); conn.close()

def get_user_expenses_sum_month(user_id, month, year):

    conn = get_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT SUM(amount) AS total
        FROM expenses
        WHERE user_id = %s
        AND MONTH(expense_date) = %s
        AND YEAR(expense_date) = %s
    """, (user_id, month, year))

    row = cur.fetchone()

    total = row["total"] if row["total"] else 0

    cur.close()
    conn.close()

    return total

def get_user_expenses(user_id):

    conn = get_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT id, category, amount, note, expense_date
        FROM expenses
        WHERE user_id = %s
        ORDER BY expense_date DESC
    """, (user_id,))

    data = cur.fetchall()

    cur.close()
    conn.close()

    return data

def get_all_personal_details():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    cursor.execute("""
        SELECT id, user_id, full_name, monthly_salary, currency, phone, city, updated_at
        FROM personal_details
        ORDER BY updated_at DESC
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows

def get_personal_by_id(id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    cursor.execute("""
        SELECT * FROM personal_details
        WHERE id = %s
    """, (id,))

    row = cursor.fetchone()

    cursor.close()
    conn.close()

    return row


def get_all_users():

    conn = get_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT id, full_name, phone, city
        FROM personal_details
    """)

    users = cur.fetchall()

    cur.close()
    conn.close()

    return users


def add_expense_db(user_id, category, amount, description):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO expenses
        (user_id, category, amount, note, expense_date)
        VALUES (%s,%s,%s,%s,CURDATE())
    """, (user_id, category, amount, description))

    conn.commit()

    cur.close()
    conn.close()


def get_user_expenses(user_id):

    conn = get_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT category, amount, note, expense_date
        FROM expenses
        WHERE user_id=%s
        ORDER BY expense_date DESC
    """,(user_id,))

    data = cur.fetchall()

    cur.close()
    conn.close()

    return data

def delete_personal_details(id):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM personal_details
        WHERE id = %s
    """, (id,))

    conn.commit()

    cursor.close()
    conn.close()

def get_all_categories(user_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, category_name, 'default' as type
        FROM expense_categories
        
        UNION
        
        SELECT id, category_name, 'user' as type
        FROM user_expense_categories
        WHERE user_id = %s
        
        ORDER BY category_name
    """, (user_id,))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows



def add_user_category(user_id, category_name):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT COUNT(*) as total
        FROM user_expense_categories
        WHERE user_id=%s
    """, (user_id,))

    count = cursor.fetchone()["total"]

    if count >= 15:
        cursor.close()
        conn.close()
        return False

    cursor.execute("""
        INSERT INTO user_expense_categories (user_id, category_name)
        VALUES (%s,%s)
    """, (user_id, category_name))

    conn.commit()

    cursor.close()
    conn.close()

    return True


def delete_user_category(user_id, category_id):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM user_expense_categories
        WHERE id=%s AND user_id=%s
    """, (category_id, user_id))

    conn.commit()

    cursor.close()
    conn.close()