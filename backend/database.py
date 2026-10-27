import os
import hashlib
import hmac
import secrets
import sqlite3

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "carcare.db")


def _hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 240000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def _check_password(encoded, password):
    algorithm, salt, digest = encoded.split("$", 2)
    return algorithm == "pbkdf2_sha256" and hmac.compare_digest(
        digest, _hash_password(password, salt).split("$", 2)[2]
    )


def _connect(db_path=None):
    return sqlite3.connect(db_path or DEFAULT_DB_PATH)


def init_db(db_path=None):
    conn = _connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            car_model TEXT NOT NULL,
            service TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            user_id INTEGER,
            status TEXT NOT NULL DEFAULT 'Pending',
            payment_status TEXT NOT NULL DEFAULT 'Unpaid',
            reschedule_date TEXT,
            reschedule_time TEXT,
            review_rating INTEGER,
            review_text TEXT
        )
        """
    )
    columns = {row[1] for row in conn.execute("PRAGMA table_info(bookings)")}
    additions = {
        "user_id": "INTEGER",
        "status": "TEXT NOT NULL DEFAULT 'Pending'",
        "payment_status": "TEXT NOT NULL DEFAULT 'Unpaid'",
        "reschedule_date": "TEXT",
        "reschedule_time": "TEXT",
        "review_rating": "INTEGER",
        "review_text": "TEXT",
    }
    for column, definition in additions.items():
        if column not in columns:
            conn.execute(f"ALTER TABLE bookings ADD COLUMN {column} {definition}")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'user'
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id)")
    conn.commit()
    conn.close()


def create_user(name, email, password, role="user", db_path=None):
    conn = _connect(db_path)
    try:
        cursor = conn.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (name.strip(), email.strip().lower(), _hash_password(password), role),
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as exc:
        raise ValueError("An account with this email already exists.") from exc
    finally:
        conn.close()


def get_user_by_email(email, db_path=None):
    conn = _connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user(user_id, db_path=None):
    conn = _connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id, name, email, phone, address, role FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_user(user_id, name, phone, address, db_path=None):
    conn = _connect(db_path)
    conn.execute(
        "UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?",
        (name.strip(), phone.strip(), address.strip(), user_id),
    )
    conn.commit()
    conn.close()


def change_password(user_id, current_password, new_password, db_path=None):
    conn = _connect(db_path)
    row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row or not _check_password(row[0], current_password):
        conn.close()
        raise ValueError("Current password is incorrect.")
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (_hash_password(new_password), user_id),
    )
    conn.commit()
    conn.close()


def get_bookings(db_path=None, user_id=None):
    conn = _connect(db_path)
    conn.row_factory = sqlite3.Row
    if user_id is None:
        rows = conn.execute("SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC").fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC, time DESC, id DESC",
            (user_id,),
        ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def add_booking(data, db_path=None, user_id=None):
    required_fields = [
        "name",
        "phone",
        "car_model",
        "service",
        "date",
        "time",
    ]

    raw = data or {}
    cleaned = {
        field: raw.get(field, "").strip() if isinstance(raw.get(field, ""), str) else ""
        for field in required_fields
    }
    if not all(cleaned.values()):
        raise ValueError("Please fill all fields.")

    conn = _connect(db_path)
    conn.execute(
        """
        INSERT INTO bookings (name, phone, car_model, service, date, time, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            cleaned["name"],
            cleaned["phone"],
            cleaned["car_model"],
            cleaned["service"],
            cleaned["date"],
            cleaned["time"],
            user_id,
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


def get_booking(booking_id, db_path=None, user_id=None):
    conn = _connect(db_path)
    conn.row_factory = sqlite3.Row
    if user_id is None:
        row = conn.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM bookings WHERE id = ? AND user_id = ?", (booking_id, user_id)
        ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_booking(booking_id, fields, db_path=None, user_id=None):
    allowed = {"status", "reschedule_date", "reschedule_time", "review_rating", "review_text"}
    updates = [(key, value) for key, value in fields.items() if key in allowed]
    if not updates:
        return
    assignments = ", ".join(f"{key} = ?" for key, _ in updates)
    values = [value for _, value in updates]
    query = f"UPDATE bookings SET {assignments} WHERE id = ?"
    values.append(booking_id)
    if user_id is not None:
        query += " AND user_id = ?"
        values.append(user_id)
    conn = _connect(db_path)
    conn.execute(query, values)
    conn.commit()
    conn.close()
