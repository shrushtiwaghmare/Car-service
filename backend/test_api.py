import os
import tempfile
import unittest
from datetime import date, timedelta

import backend.app as app_module
from backend.database import init_db


class BookingApiTests(unittest.TestCase):
    def setUp(self):
        handle, self.db_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        init_db(self.db_path)
        self.previous_db = app_module.DB
        app_module.DB = self.db_path
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def tearDown(self):
        app_module.DB = self.previous_db
        os.remove(self.db_path)

    def register(self, client, name, email):
        return client.post("/api/auth/register", json={
            "name": name,
            "email": email,
            "password": "valid-password-123",
        })

    def test_booking_access_requires_login(self):
        response = self.client.get("/api/bookings")
        self.assertEqual(response.status_code, 401)

    def test_users_only_see_and_manage_their_own_bookings(self):
        self.assertEqual(self.register(self.client, "Alice", "alice@gmail.com").status_code, 201)
        response = self.client.post("/api/bookings", json={
            "name": "Alice",
            "phone": "5550101234",
            "car_model": "Honda Civic",
            "service": "Oil Change",
            "date": date.today().isoformat(),
            "time": "10:30",
        })
        self.assertEqual(response.status_code, 201)
        booking_id = response.get_json()["id"]

        other_client = app_module.app.test_client()
        self.assertEqual(self.register(other_client, "Bob", "bob@gmail.com").status_code, 201)
        self.assertEqual(other_client.get("/api/bookings").get_json(), [])
        self.assertEqual(other_client.get(f"/api/bookings/{booking_id}").status_code, 404)
        self.assertEqual(other_client.post(f"/api/bookings/{booking_id}/cancel").status_code, 404)
        self.assertEqual(other_client.put(f"/api/admin/bookings/{booking_id}", json={"status": "Completed"}).status_code, 403)

    def test_booking_rejects_unavailable_service_and_invalid_time(self):
        self.register(self.client, "Alice", "alice@gmail.com")
        payload = {
            "name": "Alice",
            "phone": "5550101234",
            "car_model": "Honda Civic",
            "service": "Unknown service",
            "date": date.today().isoformat(),
            "time": "10:30",
        }
        self.assertEqual(self.client.post("/api/bookings", json=payload).status_code, 400)
        payload["service"] = "Oil Change"
        payload["time"] = "29:91"
        self.assertEqual(self.client.post("/api/bookings", json=payload).status_code, 400)
        payload["time"] = "10:30"
        payload["name"] = 42
        self.assertEqual(self.client.post("/api/bookings", json=payload).status_code, 400)

    def test_user_can_request_reschedule_and_cancel_without_changing_other_data(self):
        self.register(self.client, "Alice", "alice@gmail.com")
        response = self.client.post("/api/bookings", json={
            "name": "Alice",
            "phone": "5550101234",
            "car_model": "Honda Civic",
            "service": "Oil Change",
            "date": date.today().isoformat(),
            "time": "10:30",
        })
        booking_id = response.get_json()["id"]
        requested_date = (date.today() + timedelta(days=1)).isoformat()
        response = self.client.post(f"/api/bookings/{booking_id}/reschedule", json={
            "date": requested_date,
            "time": "11:45",
        })
        self.assertEqual(response.status_code, 200)
        booking = self.client.get(f"/api/bookings/{booking_id}").get_json()
        self.assertEqual(booking["date"], date.today().isoformat())
        self.assertEqual(booking["reschedule_date"], requested_date)
        self.assertEqual(booking["status"], "Pending")
        self.assertEqual(self.client.post(f"/api/bookings/{booking_id}/cancel").status_code, 200)
        self.assertEqual(self.client.get(f"/api/bookings/{booking_id}").get_json()["status"], "Cancelled")

    def test_profile_is_scoped_to_logged_in_user(self):
        self.register(self.client, "Alice", "alice@gmail.com")
        self.client.put("/api/profile", json={"name": "Alice Updated", "phone": "5550101234", "address": "Main Street"})
        profile = self.client.get("/api/profile").get_json()
        self.assertEqual(profile["name"], "Alice Updated")
        self.assertEqual(profile["address"], "Main Street")
        other_client = app_module.app.test_client()
        self.register(other_client, "Bob", "bob@gmail.com")
        self.assertEqual(other_client.get("/api/profile").get_json()["name"], "Bob")

    def test_registration_requires_gmail_and_phone_requires_ten_digits(self):
        response = self.register(self.client, "Alice", "alice@example.com")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.register(self.client, "Alice", "alice@gmail.com").status_code, 201)
        booking = {
            "name": "Alice",
            "phone": "123-456-7890",
            "car_model": "Honda Civic",
            "service": "Oil Change",
            "date": date.today().isoformat(),
            "time": "10:30",
        }
        self.assertEqual(self.client.post("/api/bookings", json=booking).status_code, 400)
        self.assertEqual(self.client.put("/api/profile", json={
            "name": "Alice", "phone": "123456789", "address": "Main Street",
        }).status_code, 400)


if __name__ == "__main__":
    unittest.main()
