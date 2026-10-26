import { useState, useEffect } from "react";

const API_URL = "http://127.0.0.1:5001/api/bookings";

// all the services we offer
const services = [
  { icon: "🚿", name: "Car Wash", price: 499, about: "Outside and inside cleaning of your car." },
  { icon: "🛢️", name: "Oil Change", price: 999, about: "Engine oil and oil filter replacement." },
  { icon: "🔧", name: "General Service", price: 1499, about: "Basic checkup with all the main parts." },
  { icon: "❄️", name: "AC Service", price: 1299, about: "AC gas check, cleaning and cooling repair." },
  { icon: "🛑", name: "Brake Service", price: 1999, about: "Brake pad check and brake oil top up." },
  { icon: "🚗", name: "Full Car Service", price: 2999, about: "Complete service of your full car." },
];

function App() {
  // which page is showing right now
  const [page, setPage] = useState("home");

  // form inputs
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carModel, setCarModel] = useState("");
  const [service, setService] = useState("Car Wash");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // message shown below the form
  const [message, setMessage] = useState("");

  // all bookings from the database
  const [bookings, setBookings] = useState([]);

  // get the bookings from flask
  function loadBookings() {
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => setBookings(data))
      .catch(() => setBookings([]));
  }

  // load bookings one time when the page opens
  useEffect(() => {
    loadBookings();
  }, []);

  // save a new booking
  function bookService(e) {
    e.preventDefault();

    if (!name || !phone || !carModel || !service || !date || !time) {
      setMessage("Please fill all fields.");
      return;
    }

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: phone,
        car_model: carModel,
        service: service,
        date: date,
        time: time,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Booking failed.");
        return data;
      })
      .then(() => {
        setMessage("Booking done! We will call you soon.");
        setName("");
        setPhone("");
        setCarModel("");
        setService("Car Wash");
        setDate("");
        setTime("");
        loadBookings();
      })
      .catch((error) => {
        setMessage(
          error.message === "Failed to fetch"
            ? "Could not reach the booking server. Make sure the backend is running."
            : error.message || "Something went wrong. Please try again."
        );
      });
  }

  // delete one booking
  function deleteBooking(id) {
    fetch(API_URL + "/" + id, { method: "DELETE" })
      .then(() => loadBookings())
      .catch(() => alert("Something went wrong. Please try again."));
  }

  // when a Book Now button is clicked on a service card
  function bookThisService(serviceName) {
    setService(serviceName);
    setMessage("");
    setPage("book");
  }

  // small helper so the navbar links look the same
  function navClass(pageName) {
    if (page === pageName) {
      return "text-red-600 font-semibold";
    }
    return "text-white hover:text-red-600";
  }

  return (
    <div className="min-h-screen flex flex-col *:w-full bg-neutral-100">
      {/* NAVBAR */}
      <nav className="bg-[#0A0A0A] px-6 py-4 md:flex md:items-center md:justify-between">
        <h1 className="text-xl font-bold text-white text-center md:text-left">
          3M <span className="text-red-600">CAR CARE</span>
        </h1>

        <div className="mt-3 flex flex-wrap justify-center gap-4 md:mt-0 md:gap-6">
          <button onClick={() => setPage("home")} className={navClass("home")}>Home</button>
          <button onClick={() => setPage("services")} className={navClass("services")}>Services</button>
          <button onClick={() => setPage("book")} className={navClass("book")}>Book Service</button>
          <button onClick={() => setPage("bookings")} className={navClass("bookings")}>Bookings</button>
        </div>
      </nav>

      {/* HOME PAGE */}
      {page === "home" && (
        <div>
          {/* hero */}
          <div className="bg-[#0A0A0A] px-6 py-20 text-center">
            <h2 className="text-4xl md:text-6xl font-bold text-white">
              YOUR CAR.
              <br />
              <span className="text-red-600">OUR CARE.</span>
            </h2>
            <p className="mt-4 text-gray-300">Professional car service made simple.</p>
            <button
              onClick={() => setPage("book")}
              className="mt-8 bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700"
            >
              Book a Service
            </button>
          </div>

          {/* small intro */}
          <div className="max-w-3xl mx-auto px-6 py-12 text-center">
            <h3 className="text-2xl font-bold text-[#0A0A0A]">Welcome to 3M Car Care</h3>
            <p className="mt-4 text-gray-600">
              We are a small car service centre. We do car washing, oil change, AC service
              and full car service. Book your service online and come at your own time.
              No waiting in a long line.
            </p>
          </div>

          {/* service cards */}
          <div className="max-w-6xl mx-auto px-6 pb-16">
            <h3 className="text-2xl font-bold text-[#0A0A0A] mb-6 text-center">Our Services</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div key={s.name} className="bg-white border border-gray-200 rounded shadow p-6">
                  <div className="text-3xl">{s.icon}</div>
                  <h4 className="mt-3 text-lg font-bold text-[#0A0A0A]">{s.name}</h4>
                  <p className="mt-2 text-sm text-gray-600">{s.about}</p>
                  <p className="mt-3 text-xl font-bold text-red-600">₹{s.price}</p>
                  <button
                    onClick={() => bookThisService(s.name)}
                    className="mt-4 w-full bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700"
                  >
                    Book Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SERVICES PAGE */}
      {page === "services" && (
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-3xl font-bold text-[#0A0A0A]">Services</h2>
          <p className="mt-2 text-gray-600">These are all the services available at our centre.</p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.name} className="bg-white border border-gray-200 rounded shadow p-6">
                <div className="text-3xl">{s.icon}</div>
                <h4 className="mt-3 text-lg font-bold text-[#0A0A0A]">{s.name}</h4>
                <p className="mt-2 text-sm text-gray-600">{s.about}</p>
                <p className="mt-3 text-xl font-bold text-red-600">₹{s.price}</p>
                <button
                  onClick={() => bookThisService(s.name)}
                  className="mt-4 w-full bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700"
                >
                  Book Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOOK SERVICE PAGE */}
      {page === "book" && (
        <div className="max-w-lg mx-auto px-6 py-12">
          <h2 className="text-3xl font-bold text-[#0A0A0A]">Book Service</h2>
          <p className="mt-2 text-gray-600">Fill this form and we will keep your slot ready.</p>

          <form onSubmit={bookService} className="mt-6 bg-white border border-gray-200 rounded shadow p-6">
            <label className="block text-sm font-semibold text-[#0A0A0A]">Customer Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            />

            <label className="block mt-4 text-sm font-semibold text-[#0A0A0A]">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            />

            <label className="block mt-4 text-sm font-semibold text-[#0A0A0A]">Car Model</label>
            <input
              type="text"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            />

            <label className="block mt-4 text-sm font-semibold text-[#0A0A0A]">Select Service</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            >
              {services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} - ₹{s.price}
                </option>
              ))}
            </select>

            <label className="block mt-4 text-sm font-semibold text-[#0A0A0A]">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            />

            <label className="block mt-4 text-sm font-semibold text-[#0A0A0A]">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            />

            <button
              type="submit"
              className="mt-6 w-full bg-red-600 text-white px-5 py-3 rounded font-semibold hover:bg-red-700"
            >
              BOOK SERVICE
            </button>

            {message && <p className="mt-4 text-center text-sm text-red-600">{message}</p>}
          </form>
        </div>
      )}

      {/* BOOKINGS PAGE */}
      {page === "bookings" && (
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-3xl font-bold text-[#0A0A0A]">Bookings</h2>
          <p className="mt-2 text-gray-600">All the bookings saved in the database.</p>

          {bookings.length === 0 ? (
            <p className="mt-8 text-gray-600">No bookings yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto bg-white border border-gray-200 rounded shadow">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0A0A0A] text-white">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Car Model</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t border-gray-200">
                      <td className="px-4 py-3">{b.id}</td>
                      <td className="px-4 py-3">{b.name}</td>
                      <td className="px-4 py-3">{b.phone}</td>
                      <td className="px-4 py-3">{b.car_model}</td>
                      <td className="px-4 py-3">{b.service}</td>
                      <td className="px-4 py-3">{b.date}</td>
                      <td className="px-4 py-3">{b.time}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteBooking(b.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-[#0A0A0A] px-6 py-6 text-center text-sm text-gray-400">
        3M Car Care - College Project
      </footer>
    </div>
  );
}

export default App;
