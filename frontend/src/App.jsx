import { useState, useEffect } from "react";

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
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSignedIn, setAdminSignedIn] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [updatingBooking, setUpdatingBooking] = useState(null);

  async function loadBookings() {
    const response = await fetch("/api/admin/bookings", { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load bookings.");
    setBookings(data);
  }

  useEffect(() => {
    fetch("/api/admin/session", { credentials: "include" })
      .then((response) => {
        if (response.ok) {
          setAdminSignedIn(true);
          return loadBookings();
        }
        return null;
      })
      .catch(() => {});
  }, []);

  async function signInAdmin(event) {
    event.preventDefault();
    setAdminBusy(true);
    setAdminError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not sign in.");
      setAdminSignedIn(true);
      setAdminPassword("");
      await loadBookings();
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function signOutAdmin() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setAdminSignedIn(false);
    setBookings([]);
  }

  async function updateBookingStatus(id, status) {
    setUpdatingBooking(id);
    setAdminError("");
    try {
      const response = await fetch(`/api/admin/bookings/${id}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update status.");
      setBookings((current) => current.map((booking) => booking.id === id ? data : booking));
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setUpdatingBooking(null);
    }
  }

  // save a new booking
  function bookService(e) {
    e.preventDefault();

    if (!name || !phone || !carModel || !service || !date || !time) {
      setMessage("Please fill all fields.");
      return;
    }

    fetch("/api/bookings", {
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
      .then((res) => res.json())
      .then(() => {
        setMessage("Booking done! We will call you soon.");
        setName("");
        setPhone("");
        setCarModel("");
        setService("Car Wash");
        setDate("");
        setTime("");
      })
      .catch(() => setMessage("Something went wrong. Please try again."));
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
          <button onClick={() => setPage("bookings")} className={navClass("bookings")}>Admin</button>
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
          {!adminSignedIn ? (
            <div className="mx-auto max-w-md">
              <h2 className="text-3xl font-bold text-[#0A0A0A]">Admin sign in</h2>
              <p className="mt-2 text-gray-600">Sign in to review customer bookings and update service progress.</p>
              <form onSubmit={signInAdmin} className="mt-6 space-y-4 rounded border border-gray-200 bg-white p-6 shadow">
                <label className="block text-sm font-semibold text-[#0A0A0A]">
                  Admin email
                  <input required type="email" autoComplete="username" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" />
                </label>
                <label className="block text-sm font-semibold text-[#0A0A0A]">
                  Password
                  <input required type="password" autoComplete="current-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" />
                </label>
                <button disabled={adminBusy} className="w-full rounded bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {adminBusy ? "Signing in..." : "Sign in"}
                </button>
                {adminError && <p role="alert" className="text-sm text-red-700">{adminError}</p>}
              </form>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Admin workspace</p>
                  <h2 className="mt-1 text-3xl font-bold text-[#0A0A0A]">Customer bookings</h2>
                  <p className="mt-2 text-gray-600">{bookings.length} booking{bookings.length === 1 ? "" : "s"} across all customers.</p>
                </div>
                <button onClick={signOutAdmin} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#0A0A0A] hover:bg-gray-50">Sign out</button>
              </div>
              {adminError && <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{adminError}</p>}
              {bookings.length === 0 ? (
                <p className="mt-8 text-gray-600">No customer bookings yet.</p>
              ) : (
                <div className="mt-6 overflow-x-auto rounded border border-gray-200 bg-white shadow">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-[#0A0A0A] text-white">
                      <tr>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Service</th>
                        <th className="px-4 py-3">Appointment</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-t border-gray-200 align-top">
                          <td className="px-4 py-4 font-semibold">{booking.name}</td>
                          <td className="px-4 py-4">{booking.phone}</td>
                          <td className="px-4 py-4">{booking.car_model}</td>
                          <td className="px-4 py-4">{booking.service}</td>
                          <td className="px-4 py-4">{booking.date}<br />{booking.time}</td>
                          <td className="px-4 py-4">
                            <label className="sr-only" htmlFor={`booking-status-${booking.id}`}>Status for {booking.name}</label>
                            <select
                              id={`booking-status-${booking.id}`}
                              value={booking.status || "Pending"}
                              disabled={updatingBooking === booking.id}
                              onChange={(event) => updateBookingStatus(booking.id, event.target.value)}
                              className="rounded border border-gray-300 bg-white px-3 py-2 font-semibold disabled:opacity-60"
                            >
                              {["Pending", "Confirmed", "In Progress", "Completed", "Cancelled"].map((status) => <option key={status}>{status}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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
