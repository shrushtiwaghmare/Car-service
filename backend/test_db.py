import os
import sqlite3
import tempfile
import unittest

from backend.database import add_booking, get_bookings, init_db


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db_path = os.path.join(tempfile.gettempdir(), "carcare_test.db")
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        init_db(self.db_path)

    def test_init_db_creates_bookings_table(self):
        with sqlite3.connect(self.db_path) as conn:
            tables = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).fetchall()
        self.assertIn(("bookings",), tables)

    def test_add_and_get_bookings(self):
        booking = {
            "name": "Alice",
            "phone": "1234567890",
            "car_model": "Honda Civic",
            "service": "Oil Change",
            "date": "2026-10-26",
            "time": "10:30",
        }

        add_booking(booking, self.db_path)
        rows = get_bookings(self.db_path)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Alice")
        self.assertEqual(rows[0]["car_model"], "Honda Civic")


if __name__ == "__main__":
    unittest.main()
