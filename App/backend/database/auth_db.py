import sqlite3
import hashlib
import os
from pathlib import Path
from App.backend.database.database import supabase

# Paths
BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "Data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "users.db"

# Admin credentials
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def register_user(name: str, email: str, password: str) -> tuple[bool, str]:
    init_db()
    email_clean = email.strip().lower()
    if not name or not email_clean or not password:
        return False, "Please fill in all required fields (Name, Email, Password)."
    
    hashed_pwd = hash_password(password)

    # 1. Store in Supabase 'users' table
    supabase_success = False
    try:
        res = supabase.table("users").insert({
            "name": name,
            "email": email_clean,
            "password": hashed_pwd
        }).execute()
        if res.data:
            supabase_success = True
    except Exception as e:
        print(f"[Supabase Register Note]: {e}")

    # 2. Store in local SQLite as backup/sync
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        """, (name, email_clean, hashed_pwd))
        conn.commit()
        conn.close()
        return True, "Registration successful! User details saved into Supabase. You can now log in."
    except sqlite3.IntegrityError:
        if supabase_success:
            return True, "Registration successful! You can now log in."
        return False, "An account with this email already exists."
    except Exception as e:
        if supabase_success:
            return True, "Registration successful! You can now log in."
        return False, f"Registration error: {str(e)}"

def login_user(email: str, password: str) -> tuple[bool, dict | str]:
    init_db()
    email_clean = email.strip().lower()
    hashed_pwd = hash_password(password)
    
    # 1. Try Supabase login first
    try:
        res = supabase.table("users").select("*").eq("email", email_clean).eq("password", hashed_pwd).execute()
        if res.data and len(res.data) > 0:
            user = res.data[0]
            return True, {
                "id": user.get("id"),
                "name": user.get("name"),
                "email": user.get("email")
            }
    except Exception as e:
        print(f"[Supabase Login Fallback]: {e}")

    # 2. Fallback to local SQLite DB
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email_clean, hashed_pwd))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return True, {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        else:
            return False, "Invalid email or password."
    except Exception as e:
        return False, f"Login error: {str(e)}"

def verify_admin(username: str, password: str) -> bool:
    return username.strip() == ADMIN_USERNAME and password == ADMIN_PASSWORD

# Supabase database reader for Admin Dashboard
def fetch_all_supabase_predictions():
    """Fetch stored prediction records and user list from Supabase tables."""
    tables = [
        ("Registered Users", "users"),
        ("Crop Predictions", "crop_prediction"),
        ("Irrigation Predictions", "irrigation_prediction"),
        ("Climate Risk Predictions", "climate_prediction"),
        ("Yield Predictions", "yield_prediction"),
        ("Unified Connected Predictions", "predictions")
    ]
    
    results = {}
    
    for display_name, table_name in tables:
        try:
            response = supabase.table(table_name).select("*").order("id", desc=True).limit(100).execute()
            results[display_name] = response.data if response.data else []
        except Exception:
            try:
                response = supabase.table(table_name).select("*").limit(100).execute()
                results[display_name] = response.data if response.data else []
            except Exception:
                results[display_name] = []
                
    return results
