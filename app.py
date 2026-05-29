# app.py
import os
from flask import Flask, render_template, request, redirect, url_for, session, flash
from utils.currency_converter import convert_currency
from werkzeug.security import check_password_hash, generate_password_hash
from config import SECRET_KEY
from datetime import datetime
from auth import login_user, signup_user
from flask import jsonify, session
from decimal import Decimal

from models import (
    save_personal_details,
    get_personal_details,
    get_user_expenses_sum_month,
    get_user_by_email,
    get_all_personal_details,
    get_personal_by_id,
    delete_personal_details,
    get_all_users,
    add_expense_db,
    get_user_expenses,
    get_all_categories,
    add_user_category,
    delete_user_category
)
from notifier import notify_if_exceeded
from powerbi_integration import open_report_in_new_tab
from datetime import datetime
from db import get_connection
from werkzeug.utils import secure_filename




app = Flask(__name__)
app.secret_key = SECRET_KEY



UPLOAD_FOLDER = "static/uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
# Create folder if not exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# Home
@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


# Signup
@app.route("/signup", methods=["GET", "POST"])
def signup():

    if request.method == "POST":

        email = request.form["email"].strip().lower()
        password = request.form["password"]

        existing = get_user_by_email(email)

        if existing:
            flash("Email already registered — please login.", "warning")
            return redirect(url_for("login"))

        user_id = signup_user(email, password)

        if user_id:
            flash("Signup successful. Please login.", "success")
            return redirect(url_for("login"))

        flash("Signup failed.", "danger")

    return render_template("signup.html")


# Login
from werkzeug.security import check_password_hash

@app.route("/login", methods=["GET","POST"])
def login():

    if request.method == "POST":

        email = request.form["email"].strip().lower()
        password = request.form["password"]

        user = login_user(email, password)

        if user:

            session["user_id"] = user["id"]
            session["user_email"] = user["email"]
            session["user_name"] = user["email"].split("@")[0]

            return redirect(url_for("dashboard"))

        flash("Invalid credentials", "danger")

    return render_template("login.html")


# Logout
@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully.", "info")
    return redirect(url_for("login"))


@app.route("/dashboard")
def dashboard():

    if "user_id" not in session:
        return redirect(url_for("login"))

    user_id = session["user_id"]
    now = datetime.now()

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # GET TOTAL EXPENSE FOR CURRENT MONTH (FIXED)
    cursor.execute("""
        SELECT COALESCE(SUM(amount),0) AS total
        FROM expenses
        WHERE user_id=%s
        AND MONTH(expense_date)=%s
        AND YEAR(expense_date)=%s
    """, (user_id, now.month, now.year))

    total_month = cursor.fetchone()["total"]

    # GET USER PREFERENCES (FIXED SOURCE)
    cursor.execute("""
        SELECT monthly_budget, alert_threshold
        FROM user_preferences
        WHERE user_id=%s
    """, (user_id,))

    pref = cursor.fetchone()

    cursor.close()
    conn.close()

    # SET DEFAULTS
    if pref:
        budget = float(pref.get("monthly_budget") or 0)
        threshold = float(pref.get("alert_threshold") or 80)
    else:
        budget = 0
        threshold = 80

    # BUILD PERSONAL DICT (FOR COMPATIBILITY)
    personal = {
        "monthly_budget": budget,
        "alert_threshold": threshold
    }



    # ALERT LOGIC
    user = {
        "id": user_id,
        "email": session.get("user_email")
    }

    exceeded, message = notify_if_exceeded(
        user,
        personal,
        total_month
    )

    return render_template(
        "dashboard.html",
        total_month=total_month,
        personal=personal,
        exceeded=exceeded,
        message=message
    )



# Settings Page
@app.route("/settings")
def settings():

    if "user_id" not in session:
        return redirect(url_for("login"))

    return render_template("settings.html")


# Account Page
@app.route("/account")
def account():

    if "user_id" not in session:
        return redirect(url_for("login"))

    return render_template("account.html")



# Open PowerBI Dashboard
@app.route("/open_report")
def open_report():

    if "user_id" not in session:
        return redirect(url_for("login"))

    try:
        open_report_in_new_tab()
        flash("Power BI report opened in new tab.", "info")

    except Exception as e:
        flash(str(e), "danger")

    return redirect(url_for("dashboard"))


# Add Personal details
# @app.route("/add_personal", methods=["GET", "POST"])
# def add_personal():

#     currency = request.form.get("currency")

#     if "user_id" not in session:
#         return redirect(url_for("login"))

#     user_id = session["user_id"]

#     if request.method == "POST":

#         full_name = request.form.get("full_name")
#         monthly_salary = float(request.form.get("monthly_salary") or 0)
#         phone = request.form.get("phone")
#         city = request.form.get("city")
#         currency = request.form.get("currency")

#         # Save data
#         save_personal_details(
#             user_id,
#             full_name,
#             monthly_salary,
#             currency,
#             phone,
#             city
#         )

#         flash("Personal details added successfully.", "success")

#         return redirect(url_for("personal"))

#     return render_template("add_personal.html")


@app.route("/add_personal", methods=["GET", "POST"])
def add_personal():

    if "user_id" not in session:
        return redirect(url_for("login"))

    user_id = session["user_id"]

    if request.method == "POST":

        full_name = request.form.get("full_name")
        monthly_salary = float(request.form.get("monthly_salary") or 0)
        phone = request.form.get("phone")
        city = request.form.get("city")
        currency = request.form.get("currency")

        # ✅ IMAGE UPLOAD
        file = request.files.get("profile_image")
        filename = None

        if file and file.filename != "":
            import uuid
            filename = str(uuid.uuid4()) + "_" + secure_filename(file.filename)
            file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))

        # ✅ SAVE DATA (updated)
        save_personal_details(
            user_id,
            full_name,
            monthly_salary,
            currency,
            phone,
            city,
            filename
        )

        flash("Personal details added successfully.", "success")
        return redirect(url_for("personal"))

    return render_template("add_personal.html")

@app.route("/personal")
def personal():

    if "user_id" not in session:
        return redirect(url_for("login"))

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get users + latest salary
    cursor.execute("""
        SELECT p.*,
               s.salary,
               s.month,
               s.year
        FROM personal_details p
        LEFT JOIN monthly_salary s
          ON p.id = s.person_id
         AND (s.year, s.month) = (
                SELECT year, month
                FROM monthly_salary
                WHERE person_id = p.id
                ORDER BY year DESC, month DESC
                LIMIT 1
         )
    """)

    details_list = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template("personal.html", details_list=details_list)


# ---------------- ADD SALARY ----------------
@app.route("/add_salary/<int:person_id>", methods=["GET", "POST"])
def add_salary(person_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get user's currency
    cursor.execute("""
        SELECT currency, full_name
        FROM personal_details
        WHERE id=%s
    """, (person_id,))

    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if request.method == "POST":

        salary = request.form["salary"]
        month = request.form["month"]
        year = request.form["year"]

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO monthly_salary (person_id, salary, month, year)
            VALUES (%s, %s, %s, %s)
        """, (person_id, salary, month, year))

        conn.commit()
        cursor.close()
        conn.close()

        flash("Salary added successfully", "success")
        return redirect(url_for("personal"))

    return render_template("add_salary.html", person_id=person_id, user=user)

# ---------------- SALARY INFO (POPUP DATA) ----------------
@app.route("/salary_info/<int:person_id>")
def salary_info(person_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    # Get user currency
    cursor.execute("""
        SELECT currency
        FROM personal_details
        WHERE id=%s
    """, (person_id,))
    user = cursor.fetchone()
    user_currency = user["currency"] if user else "INR"

    # Get base currency (logged-in user)
    user_id = session.get("user_id")

    cursor.execute("""
        SELECT default_currency
        FROM user_preferences
        WHERE user_id=%s
    """, (user_id,))
    pref = cursor.fetchone()
    base_currency = pref["default_currency"] if pref else "INR"

    # Get salary data
    cursor.execute("""
        SELECT *
        FROM monthly_salary
        WHERE person_id=%s
        ORDER BY year DESC, month DESC
    """, (person_id,))

    data = cursor.fetchall()

    cursor.close()
    conn.close()

    months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ]

    for row in data:

        # Convert Decimal
        for key, value in row.items():
            if isinstance(value, Decimal):
                row[key] = float(value)

        # Month name
        row["month_name"] = months[row["month"] - 1]

        # Converted salary
        try:
            converted = convert_currency(
                float(row["salary"]),
                user_currency,
                base_currency
            )
        except:
            converted = row["salary"]

        row["converted_salary"] = round(converted, 2)
        row["user_currency"] = user_currency
        row["base_currency"] = base_currency

    return jsonify(data)


#----------------Edit Salary-----------------
@app.route("/edit_salary/<int:id>", methods=["POST"])
def edit_salary(id):

    salary = request.form["salary"]

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE monthly_salary
        SET salary=%s
        WHERE id=%s
    """, (salary, id))

    conn.commit()
    cursor.close()
    conn.close()

    return "success"


#============Delete Salary=============
@app.route("/delete_salary/<int:id>")
def delete_salary(id):

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM monthly_salary WHERE id=%s", (id,))
    conn.commit()

    cursor.close()
    conn.close()

    return "success"


# Edit Personal Details
@app.route("/edit_personal/<int:id>", methods=["GET", "POST"])
def edit_personal(id):

    if "user_id" not in session:
        return redirect(url_for("login"))

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    if request.method == "POST":

        full_name = request.form["full_name"]
        currency = request.form["currency"]

        #Get existing image
        cursor.execute("SELECT image FROM personal_details WHERE id=%s", (id,))
        existing = cursor.fetchone()
        old_image = existing["image"] if existing else None

        # REMOVE IMAGE BUTTON
        remove_image = request.form.get("remove_image")

        if remove_image == "1":

            if old_image:
                old_path = os.path.join(app.config["UPLOAD_FOLDER"], old_image)
                if os.path.exists(old_path):
                    os.remove(old_path)

            cursor.execute("""
                UPDATE personal_details
                SET image=NULL
                WHERE id=%s
            """, (id,))

            conn.commit()
            cursor.close()
            conn.close()

            flash("Image removed successfully", "success")
            return redirect(url_for("edit_personal", id=id))

        
        # IMAGE UPLOAD / REPLACE
        file = request.files.get("profile_image")

        if file and file.filename != "":

            # Delete old image first
            if old_image:
                old_path = os.path.join(app.config["UPLOAD_FOLDER"], old_image)
                if os.path.exists(old_path):
                    os.remove(old_path)

            import uuid
            filename = str(uuid.uuid4()) + "_" + secure_filename(file.filename)
            file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))

            cursor.execute("""
                UPDATE personal_details
                SET full_name=%s,
                    currency=%s,
                    image=%s
                WHERE id=%s
            """, (full_name, currency, filename, id))

        else:
            # No image change
            cursor.execute("""
                UPDATE personal_details
                SET full_name=%s,
                    currency=%s
                WHERE id=%s
            """, (full_name, currency, id))

        conn.commit()
        cursor.close()
        conn.close()

        flash("Details updated successfully", "success")
        return redirect(url_for("personal"))

    # ---------------- GET ----------------
    cursor.execute("SELECT * FROM personal_details WHERE id=%s", (id,))
    details = cursor.fetchone()

    cursor.close()
    conn.close()

    return render_template("edit_personal.html", details=details)

# Delete Personal Details
@app.route("/delete_personal/<int:id>")
def delete_personal(id):

    if "user_id" not in session:
        return redirect(url_for("login"))

    delete_personal_details(id)

    flash("Record deleted successfully", "warning")

    return redirect(url_for("personal"))


@app.route("/expenses")
def expenses():

    if "user_id" not in session:
        return redirect(url_for("login"))

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
SELECT 
    p.id,
    p.full_name,
    p.currency,

    -- Get current month salary
    COALESCE(s.salary, 0) AS monthly_salary,

    -- Sum expenses for that salary
    COALESCE(SUM(e.amount), 0) AS total_expense

FROM users u

JOIN personal_details p 
    ON u.id = p.user_id

LEFT JOIN monthly_salary s
    ON p.id = s.person_id
    AND s.month = MONTH(CURDATE())
    AND s.year = YEAR(CURDATE())

LEFT JOIN expenses e 
    ON u.id = e.user_id 
    AND p.id = e.person_id
    AND e.salary_id = s.id 

GROUP BY 
    p.id,
    p.full_name,
    p.currency,
    s.salary
""")

    users = cursor.fetchall()

    currency_symbols = {
        "INR": "₹",
        "USD": "$",
        "EUR": "€",
        "GBP": "£"
    }

    for u in users:

        salary = float(u["monthly_salary"] or 0)
        currency = (u["currency"] or "INR").upper()

        symbol = currency_symbols.get(currency, currency)

        

        balance = salary - float(u["total_expense"])

        u["balance"] = balance

        u["salary_display"] = f"{symbol}{salary:,.2f}"

        u["balance_display"] = f"{symbol}{balance:,.2f}"

    cursor.close()
    conn.close()

    return render_template("expenses.html", users=users)



# Add Expense
@app.route("/add_expense", methods=["GET", "POST"])
def add_expense():

    if "user_id" not in session:
        return redirect(url_for("login"))

    conn = get_connection()

    user_id = session["user_id"]
    person_id = request.args.get("person_id") or request.form.get("person_id")

    if not person_id:
        return redirect(url_for("expenses"))

    # -------- GET PERSON CURRENCY --------
    cursor1 = conn.cursor(dictionary=True, buffered=True)

    cursor1.execute("""
        SELECT full_name, currency
        FROM personal_details
        WHERE id=%s AND user_id=%s
    """, (person_id, user_id))

    result = cursor1.fetchone()
    person_currency = result["currency"] if result else "INR"
    user_name = result["full_name"] if result else "User"

    cursor1.close()

    # -------- GET USER DEFAULT CURRENCY --------
    cursor_pref = conn.cursor(dictionary=True, buffered=True)

    cursor_pref.execute("""
        SELECT default_currency
        FROM user_preferences
        WHERE user_id=%s
    """, (user_id,))

    pref = cursor_pref.fetchone()
    base_currency = pref["default_currency"] if pref else "INR"

    cursor_pref.close()

    # -------- FETCH SALARIES (NEW) --------
    cursor_sal = conn.cursor(dictionary=True, buffered=True)

    cursor_sal.execute("""
        SELECT id, salary, month, year
        FROM monthly_salary
        WHERE person_id=%s
        ORDER BY year DESC, month DESC
    """, (person_id,))

    salaries = cursor_sal.fetchall()
    cursor_sal.close()

    # -------- INSERT EXPENSE --------
    if request.method == "POST":

        category = request.form["category"]
        amount = float(request.form["amount"])
        note = request.form.get("description")
        expense_date = request.form.get("expense_date")

        # NEW: Salary ID from dropdown
        salary_id = request.form.get("salary_id")

        selected_currency = person_currency

        # -------- CONVERT USING API --------
        try:
            amount_converted = convert_currency(
                amount,
                selected_currency,
                base_currency
            )
        except Exception as e:
            print("Conversion error:", e)
            amount_converted = amount

        cursor2 = conn.cursor(buffered=True)

        cursor2.execute("""
            INSERT INTO expenses
            (user_id, person_id, category, amount, currency, amount_base, note, expense_date, salary_id) 
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            user_id,
            person_id,
            category,
            amount,
            selected_currency,
            amount_converted,
            note,
            expense_date,
            salary_id   #NEW
        ))

        conn.commit()
        cursor2.close()

        salary_id = request.form.get("salary_id")

        return redirect(url_for("add_expense", person_id=person_id,salary_id=salary_id))

    # -------- FETCH EXPENSE LIST --------
    selected_salary_id = request.args.get("salary_id")
    cursor3 = conn.cursor(dictionary=True, buffered=True)

    expenses = []

    if selected_salary_id:
        cursor3.execute("""
        SELECT *
        FROM expenses
        WHERE person_id=%s 
        AND user_id=%s
        AND salary_id=%s
        ORDER BY expense_date DESC
    """, (person_id, user_id, selected_salary_id))
        expenses = cursor3.fetchall()

    # -------- USER PREFS --------
    cursor_pref = conn.cursor(dictionary=True)
    cursor_pref.execute("SELECT show_notes FROM user_preferences WHERE user_id=%s", (user_id,))
    prefs = cursor_pref.fetchone()
    cursor_pref.close()
    
    cursor_pref2 = conn.cursor(dictionary=True)
    cursor_pref2.execute("""
    SELECT monthly_budget, alert_threshold
    FROM user_preferences
    WHERE user_id=%s
""", (user_id,))
    pref2 = cursor_pref2.fetchone()
    cursor_pref2.close()
    budget = float(pref2.get("monthly_budget") or 0) if pref2 else 0
    threshold = float(pref2.get("alert_threshold") or 80) if pref2 else 80

    cursor3.close()
    conn.close()

    

    # -------- RETURN TEMPLATE --------
    return render_template(
        "add_expense.html",
        user_id=user_id,
        expenses=expenses,
        currency=person_currency,
        base_currency=base_currency,
        person_id=person_id,
        prefs=prefs,
        salaries=salaries,
        selected_salary_id=selected_salary_id,
        budget=budget,
        threshold=threshold,
        user_name=user_name
    )

# Delete added expense for the user_id
@app.route("/delete_expense/<int:expense_id>", methods=["POST"])
def delete_expense(expense_id):

    if "user_id" not in session:
        return redirect(url_for("login"))

    user_id = session["user_id"]

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM expenses
        WHERE id=%s AND user_id=%s
    """, (expense_id, user_id))

    conn.commit()

    cursor.close()
    conn.close()

    flash("Expense deleted successfully", "success")

    person_id = request.args.get("person_id") or request.form.get("person_id")
    salary_id = request.args.get("salary_id") or request.form.get("salary_id")

    return redirect(url_for(    
    "add_expense",
    person_id=person_id,
    salary_id=salary_id
    ))


# Edit added expense for the user_id
@app.route("/edit_expense/<int:expense_id>", methods=["GET", "POST"])
def edit_expense(expense_id):

    if "user_id" not in session:
        return redirect(url_for("login"))

    user_id = session["user_id"]

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    if request.method == "POST":

        category = request.form.get("category")
        amount = request.form.get("amount")
        note = request.form.get("note")

        cursor.execute("""
        UPDATE expenses
        SET category=%s, amount=%s, note=%s
        WHERE id=%s AND user_id=%s
        """, (category, amount, note, expense_id, user_id))

        conn.commit()

        cursor.close()
        conn.close()

        flash("Expense updated successfully", "success")

        person_id = request.form.get("person_id")
        salary_id = request.form.get("salary_id")
        return redirect(url_for(
            "add_expense",
            person_id=person_id,
            salary_id=salary_id
            ))

    cursor.execute("""
    SELECT * FROM expenses
    WHERE id=%s AND user_id=%s
    """, (expense_id, user_id))

    expense = cursor.fetchone()

    cursor.close()
    conn.close()

    return render_template("edit_expense.html", expense=expense)


#Load Categories
@app.route("/categories")
def categories():

    if "user_id" not in session:
        return {"categories": []}

    user_id = session["user_id"]

    data = get_all_categories(user_id)

    return {"categories": data}


#Add Categories
@app.route("/add_category", methods=["POST"])
def add_category():

    if "user_id" not in session:
        return {"error": "Login required"}

    user_id = session["user_id"]

    name = request.form.get("category_name", "").strip()

    # Prevent empty category
    if not name:
        return {"error": "Category name cannot be empty"}

    # Prevent very short names
    if len(name) < 2:
        return {"error": "Category name must be at least 2 characters"}

    success = add_user_category(user_id, name)

    if not success:
        return {"error": "Maximum 15 custom categories allowed"}

    return {"success": True}


# Delete Categories
@app.route("/delete_category", methods=["POST"])
def delete_category():

    if "user_id" not in session:
        return {"error": "Login required"}

    user_id = session["user_id"]

    category_id = request.form.get("category_id")

    delete_user_category(user_id, category_id)

    return {"success": True}


# Account Details
@app.route("/account_details", methods=["GET", "POST"])
def account_details():

    if "user_id" not in session:
        return redirect(url_for("login"))

    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    user_id = session["user_id"]

    # -------- HANDLE UPDATE --------
    if request.method == "POST":

        full_name = request.form.get("full_name")
        email = request.form.get("email")
        phone = request.form.get("phone")

        # Update users table (email)
        cursor.execute("""
            UPDATE users
            SET email = %s
            WHERE id = %s
        """, (email, user_id))

        # Update user_details table
        cursor.execute("""
            UPDATE user_details
            SET full_name = %s, phone = %s
            WHERE logged_user_id = %s
        """, (full_name, phone, user_id))

        conn.commit()

        flash("Profile updated successfully!", "success")

        return redirect(url_for("account_details"))

    # -------- FETCH DATA --------
    cursor.execute("""
        SELECT 
        u.id,
        u.email,
        u.created_at,
        d.full_name,
        d.phone,
        p.currency
        FROM users u
        LEFT JOIN user_details d
        ON u.id = d.logged_user_id
        LEFT JOIN personal_details p
        ON u.id = p.user_id
        WHERE u.id = %s
    """, (user_id,))

    user = cursor.fetchone()

    edit_mode = request.args.get("edit")

    cursor.close()
    conn.close()

    return render_template(
        "account_details.html",
        user=user,
        edit_mode=edit_mode
    )

@app.route('/change_password', methods=['GET', 'POST'])
def change_password():

    if "user_id" not in session:
        return redirect(url_for("login"))

    if request.method == "POST":

        current_password = request.form.get("current_password")
        new_password = request.form.get("new_password")
        confirm_password = request.form.get("confirm_password")

        user_id = session["user_id"]

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT password_hash FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"status": "error", "message": "User not found"})

        if not check_password_hash(user["password_hash"], current_password):
            return jsonify({"status": "error", "message": "Current password is incorrect"})

        if new_password != confirm_password:
            return jsonify({"status": "error", "message": "Passwords do not match"})

        if check_password_hash(user["password_hash"], new_password):
            return jsonify({"status": "error", "message": "New password cannot be same as old"})

        new_hash = generate_password_hash(new_password)

        cursor.execute(
            "UPDATE users SET password_hash=%s WHERE id=%s",
            (new_hash, user_id)
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"status": "success", "message": "Password updated successfully!"})

    return render_template("change_password.html")

@app.route('/preferences', methods=['GET', 'POST'])
def preferences():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    conn = get_connection()

    user_id = session['user_id']
    cursor = conn.cursor(dictionary=True)

    if request.method == 'POST':
        currency = request.form.get('currency')
        category = request.form.get('category')
        budget = request.form.get('budget')
        start_day = request.form.get('start_day')
        show_notes = request.form.get("show_notes")  # 'yes' or 'no'
        alert_threshold = request.form.get("alert_threshold")
        show_notes_flag = 1 if show_notes == "yes" else 0

        # Check if already exists
        cursor.execute("SELECT * FROM user_preferences WHERE user_id=%s", (user_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE user_preferences
                SET default_currency=%s,
                    default_category=%s,
                    monthly_budget=%s,
                    month_start_day=%s,
                    show_notes=%s,
                    alert_threshold=%s
                WHERE user_id=%s
            """, (currency, category, budget, start_day, show_notes_flag, alert_threshold,user_id))
        else:
            cursor.execute("""
                INSERT INTO user_preferences
                (user_id, default_currency, default_category, monthly_budget, month_start_day, show_notes, alert_threshold)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (user_id, currency, category, budget, start_day, show_notes_flag, alert_threshold))

        conn.commit()

        flash("Preferences saved successfully!", "success")
        return redirect(url_for('preferences'))

    # GET request
    cursor.execute("SELECT * FROM user_preferences WHERE user_id=%s", (user_id,))
    prefs = cursor.fetchone()


    currencies = ["INR", "USD", "GBP", "EUR"]
    return render_template('preferences.html',prefs=prefs,currencies=currencies)


@app.route('/get_expense_total')
def get_expense_total():
    salary_id = request.args.get("salary_id")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COALESCE(SUM(amount),0)
        FROM expenses
        WHERE salary_id = %s
    """, (salary_id,))

    total = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    return {"total": total}


if __name__ == "__main__":
    app.run(debug=True)