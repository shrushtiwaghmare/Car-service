import os
import sqlite3

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "carcare.db")


def _connect(db_path=None):
    return sqlite3.connect(db_path or DEFAULT_DB_PATH)


def init_db(db_path=None):
    conn = _connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT,
            car_model TEXT,
            service TEXT,
            date TEXT,
            time TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def get_bookings(db_path=None):
    conn = _connect(db_path)
    rows = conn.execute("SELECT * FROM bookings ORDER BY id").fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "name": row[1],
            "phone": row[2],
            "car_model": row[3],
            "service": row[4],
            "date": row[5],
            "time": row[6],
        }
        for row in rows
    ]


def add_booking(data, db_path=None):
    required_fields = [
        "name",
        "phone",
        "car_model",
        "service",
        "date",
        "time",
    ]

    cleaned = data or {}
    if not all(cleaned.get(field, "").strip() for field in required_fields):
        raise ValueError("Please fill all fields.")

    conn = _connect(db_path)
    conn.execute(
        """
        INSERT INTO bookings (name, phone, car_model, service, date, time)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            cleaned["name"].strip(),
            cleaned["phone"].strip(),
            cleaned["car_model"].strip(),
            cleaned["service"].strip(),
            cleaned["date"].strip(),
            cleaned["time"].strip(),
        ),
    )
    conn.commit()
    booking_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return booking_id


def delete_booking(booking_id, db_path=None):
    conn = _connect(db_path)
    conn.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
    conn.commit()
    conn.close()
