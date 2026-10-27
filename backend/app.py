import os
import re
from datetime import date
from functools import wraps

from flask import Flask, jsonify, request, session
from flask_cors import CORS
try:
    from .database import (
        _check_password,
        add_booking,
        change_password,
        create_user,
        get_booking,
        get_bookings,
        get_user,
        get_user_by_email,
        init_db,
        update_booking,
        update_user,
    )
except ImportError:
    from database import (
        _check_password,
        add_booking,
        change_password,
        create_user,
        get_booking,
        get_bookings,
        get_user,
        get_user_by_email,
        init_db,
        update_booking,
        update_user,
    )

app = Flask(__name__)
app.secret_key = os.environ.get("CARCARE_SECRET_KEY") or os.urandom(32)
CORS(app, supports_credentials=True, origins=["http://localhost:5180", "http://127.0.0.1:5180"])

# keep the database file next to app.py, so it does not matter
# which folder we run the program from
DB = os.path.join(os.path.dirname(__file__), "carcare.db")

init_db(DB)

SERVICES = [
    {"icon": "🚿", "name": "Car Wash", "price": 499, "about": "Outside and inside cleaning of your car."},
    {"icon": "🛢️", "name": "Oil Change", "price": 999, "about": "Engine oil and oil filter replacement."},
    {"icon": "🔧", "name": "General Service", "price": 1499, "about": "Basic checkup with all the main parts."},
    {"icon": "❄️", "name": "AC Service", "price": 1299, "about": "AC gas check, cleaning and cooling repair."},
    {"icon": "🛑", "name": "Brake Service", "price": 1999, "about": "Brake pad check and brake oil top up."},
    {"icon": "🚗", "name": "Full Car Service", "price": 2999, "about": "Complete service of your full car."},
]
SERVICE_NAMES = {service["name"] for service in SERVICES}


def login_required(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"message": "Please log in to continue."}), 401
        return handler(*args, **kwargs)
    return wrapped


def admin_required(handler):
    @wraps(handler)
    @login_required
    def wrapped(*args, **kwargs):
        if session.get("role") != "admin":
            return jsonify({"message": "Admin access required."}), 403
        return handler(*args, **kwargs)
    return wrapped


def valid_appointment(data):
    appointment_date = data.get("date", "")
    try:
        date_is_valid = date.fromisoformat(appointment_date) >= date.today()
        appointment_time = data.get("time", "")
        time_is_valid = (
            len(appointment_time) == 5
            and appointment_time[2] == ":"
            and appointment_time[:2].isdigit()
            and appointment_time[3:].isdigit()
            and int(appointment_time[:2]) < 24
            and int(appointment_time[3:]) < 60
        )
        return date_is_valid and time_is_valid
    except (TypeError, ValueError):
        return False


def valid_phone(phone):
    return isinstance(phone, str) and re.fullmatch(r"[0-9]{10}", phone) is not None


@app.route("/api/auth/register", methods=["POST"])
def register_route():
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not name or not email or not email.endswith("@gmail.com"):
        return jsonify({"message": "Enter a valid Gmail address ending in @gmail.com."}), 400
    if len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters."}), 400
    try:
        configured_admin = os.environ.get("CARCARE_ADMIN_EMAIL", "").strip().lower()
        role = "admin" if configured_admin and email == configured_admin else "user"
        user_id = create_user(name, email, password, role=role, db_path=DB)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 409
    session.clear()
    session.update(user_id=user_id, role="user")
    return jsonify({"user": get_user(user_id, DB)}), 201


@app.route("/api/auth/login", methods=["POST"])
def login_route():
    data = request.get_json() or {}
    account = get_user_by_email(str(data.get("email", "")), DB)
    if not account or not _check_password(account["password_hash"], str(data.get("password", ""))):
        return jsonify({"message": "Email or password is incorrect."}), 401
    session.clear()
    session.update(user_id=account["id"], role=account["role"])
    return jsonify({"user": get_user(account["id"], DB)})


@app.route("/api/auth/logout", methods=["POST"])
def logout_route():
    session.clear()
    return jsonify({"message": "Signed out."})


@app.route("/api/auth/me")
@login_required
def current_user_route():
    user = get_user(session["user_id"], DB)
    if not user:
        session.clear()
        return jsonify({"message": "Please log in to continue."}), 401
    return jsonify({"user": user})


@app.route("/api/services")
def services_route():
    return jsonify(SERVICES)


@app.route("/api/profile", methods=["GET", "PUT"])
@login_required
def profile_route():
    user_id = session["user_id"]
    if request.method == "GET":
        return jsonify(get_user(user_id, DB))
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    address = str(data.get("address", "")).strip()
    if not name or not phone:
        return jsonify({"message": "Name and phone number are required."}), 400
    if not valid_phone(phone):
        return jsonify({"message": "Phone number must contain exactly 10 digits."}), 400
    update_user(user_id, name, phone, address, DB)
    return jsonify(get_user(user_id, DB))


@app.route("/api/profile/password", methods=["PUT"])
@login_required
def password_route():
    data = request.get_json() or {}
    new_password = str(data.get("new_password", ""))
    if len(new_password) < 8:
        return jsonify({"message": "New password must be at least 8 characters."}), 400
    try:
        change_password(session["user_id"], str(data.get("current_password", "")), new_password, DB)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    return jsonify({"message": "Password updated."})


@app.route("/api/bookings")
@login_required
def get_bookings_route():
    if session.get("role") == "admin":
        return jsonify(get_bookings(DB))
    return jsonify(get_bookings(DB, user_id=session["user_id"]))


# save a new booking
@app.route("/api/bookings", methods=["POST"])
@login_required
def add_booking_route():
    data = request.get_json() or {}
    if not valid_phone(data.get("phone")):
        return jsonify({"message": "Phone number must contain exactly 10 digits."}), 400
    if data.get("service") not in SERVICE_NAMES:
        return jsonify({"message": "Please select an available service."}), 400
    if not valid_appointment(data):
        return jsonify({"message": "Please choose a valid date today or later."}), 400

    try:
        booking_id = add_booking(data, DB, user_id=session["user_id"])
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify({"message": "Booking saved successfully!", "id": booking_id}), 201


@app.route("/api/bookings/<int:booking_id>", methods=["GET"])
@login_required
def booking_detail_route(booking_id):
    booking = get_booking(booking_id, DB, user_id=None if session.get("role") == "admin" else session["user_id"])
    if not booking:
        return jsonify({"message": "Booking not found."}), 404
    booking["price"] = next((service["price"] for service in SERVICES if service["name"] == booking["service"]), None)
    return jsonify(booking)


@app.route("/api/bookings/<int:booking_id>/cancel", methods=["POST"])
@login_required
def cancel_booking_route(booking_id):
    booking = get_booking(booking_id, DB, user_id=session["user_id"])
    if not booking:
        return jsonify({"message": "Booking not found."}), 404
    if booking["status"] not in ("Pending", "Confirmed") or booking["date"] < date.today().isoformat():
        return jsonify({"message": "This booking can no longer be cancelled."}), 400
    update_booking(booking_id, {"status": "Cancelled"}, DB, user_id=session["user_id"])
    return jsonify({"message": "Booking cancelled."})


@app.route("/api/bookings/<int:booking_id>/reschedule", methods=["POST"])
@login_required
def reschedule_booking_route(booking_id):
    booking = get_booking(booking_id, DB, user_id=session["user_id"])
    if not booking:
        return jsonify({"message": "Booking not found."}), 404
    if booking["status"] not in ("Pending", "Confirmed") or booking["date"] < date.today().isoformat():
        return jsonify({"message": "This booking cannot be rescheduled."}), 400
    data = request.get_json() or {}
    requested = {"date": data.get("date"), "time": data.get("time")}
    if not valid_appointment(requested):
        return jsonify({"message": "Choose a valid future date and time."}), 400
    update_booking(booking_id, {
        "reschedule_date": requested["date"],
        "reschedule_time": requested["time"],
    }, DB, user_id=session["user_id"])
    return jsonify({"message": "Reschedule request sent for admin review."})


@app.route("/api/bookings/<int:booking_id>/review", methods=["POST"])
@login_required
def review_booking_route(booking_id):
    booking = get_booking(booking_id, DB, user_id=session["user_id"])
    if not booking:
        return jsonify({"message": "Booking not found."}), 404
    if booking["status"] != "Completed":
        return jsonify({"message": "Reviews are available after a completed service."}), 400
    data = request.get_json() or {}
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        rating = 0
    review_text = str(data.get("review", "")).strip()
    if rating not in range(1, 6) or not review_text:
        return jsonify({"message": "Choose a rating and write a review."}), 400
    update_booking(booking_id, {"review_rating": rating, "review_text": review_text}, DB, user_id=session["user_id"])
    return jsonify({"message": "Thank you for your review."})


@app.route("/api/admin/bookings")
@admin_required
def admin_bookings_route():
    return jsonify(get_bookings(DB))


@app.route("/api/admin/bookings/<int:booking_id>", methods=["PUT"])
@admin_required
def admin_update_booking_route(booking_id):
    booking = get_booking(booking_id, DB)
    if not booking:
        return jsonify({"message": "Booking not found."}), 404
    data = request.get_json() or {}
    status = data.get("status")
    if status not in {"Pending", "Confirmed", "Completed", "Cancelled"}:
        return jsonify({"message": "Choose a valid booking status."}), 400
    update_booking(booking_id, {"status": status}, DB)
    return jsonify({"message": "Booking status updated."})


@app.route("/api/admin/bookings/<int:booking_id>/reschedule", methods=["PUT"])
@admin_required
def admin_reschedule_route(booking_id):
    booking = get_booking(booking_id, DB)
    if not booking or not booking["reschedule_date"] or not booking["reschedule_time"]:
        return jsonify({"message": "No reschedule request found."}), 404
    data = request.get_json() or {}
    decision = data.get("decision")
    if decision == "approve":
        if not valid_appointment({"date": booking["reschedule_date"], "time": booking["reschedule_time"]}):
            return jsonify({"message": "The requested date is no longer valid."}), 400
        update_booking(booking_id, {
            "date": booking["reschedule_date"],
            "time": booking["reschedule_time"],
            "reschedule_date": None,
            "reschedule_time": None,
        }, DB)
    elif decision == "reject":
        update_booking(booking_id, {"reschedule_date": None, "reschedule_time": None}, DB)
    else:
        return jsonify({"message": "Decision must be approve or reject."}), 400
    return jsonify({"message": "Reschedule request updated."})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
