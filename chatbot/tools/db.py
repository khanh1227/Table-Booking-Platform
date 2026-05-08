"""
db.py — Kết nối MySQL trực tiếp cho chatbot service.

Dùng mysql-connector-python (pure Python, không cần C build như mysqlclient).
Mỗi tool gọi get_connection() để lấy connection mới — không dùng connection pool
phức tạp vì chatbot là low-traffic service.
"""
import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    """Trả về MySQL connection. Caller phải close() sau khi dùng."""
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", 3306)),
        database=os.getenv("DB_NAME", "tablebooking_db_new"),
        user=os.getenv("DB_USER", "tb_user"),
        password=os.getenv("DB_PASSWORD", ""),
        charset="utf8mb4",
        use_unicode=True,
    )


def query(sql: str, params: tuple = ()) -> list[dict]:
    """
    Thực thi SELECT query, trả về list[dict].
    Tự động close connection sau khi done.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return rows
    finally:
        cursor.close()
        conn.close()
