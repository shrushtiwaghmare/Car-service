import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from database import add_booking, delete_booking, get_bookings, init_db

app = Flask(__name__)
CORS(app)

# keep the database file next to app.py, so it does not matter
# which folder we run the program from
DB = os.path.join(os.path.dirname(__file__), "carcare.db")

init_db(DB)


# get all the bookings
@app.route("/api/bookings")
def get_bookings_route():
    return jsonify(get_bookings(DB))


# save a new booking
@app.route("/api/bookings", methods=["POST"])
def add_booking_route():
    data = request.get_json() or {}

    try:
        add_booking(data, DB)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify({"message": "Booking saved successfully!"})


# delete one booking by id
@app.route("/api/bookings/<int:booking_id>", methods=["DELETE"])
def delete_booking_route(booking_id):
    delete_booking(booking_id, DB)
    return jsonify({"message": "Booking deleted."})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
