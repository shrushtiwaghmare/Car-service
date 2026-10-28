import { useEffect, useState } from "react";

const API = "/api";
const emptyForm = { name: "", phone: "", car_model: "", service: "", date: "", time: "" };
const bookingStatuses = ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled"];

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

function money(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function App() {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [bookingForm, setBookingForm] = useState(emptyForm);
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", address: "" });
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("All");
  const [adminUpdating, setAdminUpdating] = useState(null);

  function clearMessages() {
    setNotice("");
    setError("");
  }

  async function loadBookings() {
    const result = await api("/bookings");
    setBookings(result);
  }

  async function loadUserData(currentUser) {
    const [availableServices, result, profileData] = await Promise.all([
      api("/services"), api("/bookings"), api("/profile"),
    ]);
    setServices(availableServices);
    setBookings(result);
    setProfile(profileData);
    if (currentUser) setUser(currentUser);
  }

  useEffect(() => {
    api("/auth/me")
      .then(({ user: currentUser }) => loadUserData(currentUser))
      .catch(() => api("/services").then(setServices).catch(() => setError("The service server is unavailable.")))
      .finally(() => setLoading(false));
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      const response = await api(`/auth/${authMode}`, { method: "POST", body: authForm });
      setUser(response.user);
      await loadUserData(response.user);
      setAuthForm({ name: "", email: "", password: "" });
      setPage("dashboard");
      setNotice(authMode === "register" ? "Your account is ready." : "Welcome back.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setBookings([]);
    setAuthForm({ name: "", email: "", password: "" });
    setAuthMode("login");
    setPage("dashboard");
    setNotice("You have signed out.");
  }

  function startBooking(serviceName = "") {
    setBookingForm({ ...emptyForm, name: profile.name || user?.name || "", phone: profile.phone || "", service: serviceName || services[0]?.name || "" });
    clearMessages();
    setPage("book");
  }

  async function submitBooking(event) {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      await api("/bookings", { method: "POST", body: bookingForm });
      await loadBookings();
      setNotice("Booking received. Its status is Pending until the service center confirms it.");
      setPage("bookings");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function showBooking(id) {
    clearMessages();
    try {
      setDetail(await api(`/bookings/${id}`));
      setPage("detail");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm("Cancel this booking?")) return;
    clearMessages();
    try {
      await api(`/bookings/${id}/cancel`, { method: "POST" });
      await loadBookings();
      if (detail?.id === id) setDetail(await api(`/bookings/${id}`));
      setNotice("Your booking has been cancelled.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    clearMessages();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/bookings/${detail.id}/reschedule`, {
        method: "POST", body: { date: form.get("date"), time: form.get("time") },
      });
      setDetail(await api(`/bookings/${detail.id}`));
      setNotice("Request sent. The existing appointment stays in place until the service center reviews it.");
      setPage("detail");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitProfile(event) {
    event.preventDefault();
    clearMessages();
    try {
      const updated = await api("/profile", { method: "PUT", body: profile });
      setProfile(updated);
      setUser((current) => ({ ...current, ...updated }));
      setNotice("Profile updated.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    clearMessages();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/profile/password", {
        method: "PUT", body: { current_password: form.get("current_password"), new_password: form.get("new_password") },
      });
      formElement.reset();
      setNotice("Password updated.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitReview(event, id) {
    event.preventDefault();
    clearMessages();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/bookings/${id}/review`, { method: "POST", body: { rating: form.get("rating"), review: form.get("review") } });
      await showBooking(id);
      setNotice("Thank you for sharing your feedback.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function updateAdminStatus(id, status) {
    setAdminUpdating(id);
    clearMessages();
    try {
      await api(`/admin/bookings/${id}`, { method: "PUT", body: { status } });
      await loadBookings();
      setNotice(`Booking #${id} is now ${status.toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAdminUpdating(null);
    }
  }

  const counts = bookings.reduce((all, booking) => {
    all[booking.status] = (all[booking.status] || 0) + 1;
    return all;
  }, {});
  const upcoming = bookings.filter((booking) => ["Pending", "Confirmed"].includes(booking.status) && booking.date >= new Date().toISOString().slice(0, 10));
  const history = bookings.filter((booking) => ["Completed", "Cancelled"].includes(booking.status) || booking.date < new Date().toISOString().slice(0, 10));
  const activeBookings = bookings.filter((booking) => ["Pending", "Confirmed"].includes(booking.status) && booking.date >= new Date().toISOString().slice(0, 10));
  const shownBookings = (page === "history" ? history : activeBookings).filter((booking) => filter === "All" || booking.status === filter);
  const adminBookings = bookings.filter((booking) => adminStatusFilter === "All" || (booking.status || "Pending") === adminStatusFilter);
  const futureDate = new Date().toISOString().slice(0, 10);

  function navigate(nextPage) {
    clearMessages();
    setPage(nextPage);
    if (nextPage !== "detail" && nextPage !== "reschedule") setDetail(null);
  }

  function navClass(name) {
    return `whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition ${page === name ? "border-red-600 text-white" : "border-transparent text-neutral-300 hover:text-white"}`;
  }

  function serviceCards() {
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{services.map((service) => (
      <article key={service.name} className="flex min-h-56 flex-col border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3"><span className="text-2xl" aria-hidden="true">{service.icon}</span><span className="text-lg font-bold text-red-600">{money(service.price)}</span></div>
        <h3 className="mt-3 text-lg font-bold text-neutral-900">{service.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-neutral-600">{service.about}</p>
        <button onClick={() => startBooking(service.name)} className="mt-5 self-start bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Book this service</button>
      </article>
    ))}</div>;
  }

  function bookingTable(rows) {
    if (!rows.length) return <div className="border border-dashed border-neutral-300 bg-white px-6 py-12 text-center"><p className="font-semibold text-neutral-800">{page === "history" ? "No past bookings yet" : "No bookings to show"}</p><p className="mt-2 text-sm text-neutral-500">Your service appointments will appear here.</p><button onClick={() => startBooking()} className="mt-5 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Book a service</button></div>;
    return <div className="overflow-x-auto border border-neutral-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-neutral-900 text-white"><tr>{["Booking", "Service", "Appointment", "Price", "Payment", "Status", ""].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{rows.map((booking) => <tr key={booking.id} className="border-t border-neutral-200"><td className="px-4 py-4 font-semibold">#{booking.id}</td><td className="px-4 py-4">{booking.service}</td><td className="px-4 py-4">{booking.date}<span className="block text-xs text-neutral-500">{booking.time}</span></td><td className="px-4 py-4">{money(services.find((service) => service.name === booking.service)?.price)}</td><td className="px-4 py-4">{booking.payment_status || "Unpaid"}</td><td className="px-4 py-4"><Status value={booking.status} /></td><td className="px-4 py-4"><button onClick={() => showBooking(booking.id)} className="font-semibold text-red-600 hover:text-red-800">View details</button></td></tr>)}</tbody></table></div>;
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-neutral-100 text-neutral-600">Loading your account...</main>;

  if (!user) return <div className="min-h-screen bg-neutral-100">
    <header className="bg-neutral-950 px-6 py-5 text-white"><div className="mx-auto max-w-6xl text-lg font-extrabold">3M <span className="text-red-600">CAR CARE</span></div></header>
    <main className="mx-auto grid min-h-[78vh] max-w-5xl items-center gap-10 px-6 py-10 md:grid-cols-[1.1fr_0.9fr]">
      <section><p className="text-sm font-bold uppercase text-red-600">Service booking</p><h1 className="mt-3 max-w-lg text-4xl font-black leading-tight text-neutral-950">Your car deserves care that fits your day.</h1><p className="mt-4 max-w-md leading-7 text-neutral-600">Book trusted car care, keep track of your appointments, and manage your details in one place.</p></section>
      <form onSubmit={submitAuth} className="border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-neutral-950">{authMode === "login" ? "Sign in" : "Create your account"}</h2><p className="mt-1 text-sm text-neutral-500">{authMode === "login" ? "Access your bookings and profile." : "Your account is private and only sees your bookings."}</p>
        {authMode === "register" && <Field label="Full name" value={authForm.name} onChange={(value) => setAuthForm({ ...authForm, name: value })} required />}
        <Field label="Email" type="email" value={authForm.email} onChange={(value) => setAuthForm({ ...authForm, email: value })} pattern={authMode === "register" ? ".+@gmail\\.com" : undefined} title={authMode === "register" ? "Use an email address ending in @gmail.com." : undefined} required />
        <Field label="Password" type="password" value={authForm.password} onChange={(value) => setAuthForm({ ...authForm, password: value })} required minLength={authMode === "register" ? 8 : undefined} />
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="mt-6 w-full bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}</button>
        <p className="mt-5 text-center text-sm text-neutral-600">{authMode === "login" ? "New to 3M Car Care?" : "Already have an account?"} <button type="button" className="font-semibold text-red-600" onClick={() => { clearMessages(); setAuthMode(authMode === "login" ? "register" : "login"); }}>{authMode === "login" ? "Register" : "Sign in"}</button></p>
      </form>
    </main>
    <footer className="border-t border-neutral-200 px-6 py-5 text-center text-sm text-neutral-500">3M Car Care Service Center</footer>
  </div>;

  return <div className="flex min-h-screen flex-col bg-neutral-100">
    <header className="bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4"><button onClick={() => navigate("dashboard")} className="text-lg font-extrabold">3M <span className="text-red-600">CAR CARE</span></button><div className="flex items-center gap-4"><span className="hidden text-sm text-neutral-300 sm:block">{user.name}</span><button onClick={signOut} className="border border-neutral-700 px-3 py-2 text-sm hover:border-red-600">Sign out</button></div></div>
      <nav className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-5" aria-label="Main navigation">{[["dashboard", "Dashboard"], ["services", "Services"], ["bookings", "My Bookings"], ["history", "History"], ...(user.role === "admin" ? [["admin", "Admin"]] : []), ["profile", "My Profile"], ["contact", "Contact"]].map(([key, title]) => <button key={key} onClick={() => navigate(key)} className={navClass(key)}>{title}</button>)}</nav>
    </header>
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">
      {notice && <div role="status" className="mb-5 flex items-center justify-between border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-900">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message" className="ml-4 font-bold">×</button></div>}
      {error && <div role="alert" className="mb-5 flex items-center justify-between border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">{error}<button onClick={() => setError("")} aria-label="Dismiss error" className="ml-4 font-bold">×</button></div>}

      {page === "admin" && user.role === "admin" && <>
        <PageTitle title="Admin booking desk" subtitle="Review all customer bookings and update each service's progress." />
        <section className="mt-6 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-5">
          {bookingStatuses.map((status) => <div key={status} className="bg-white p-4"><p className="text-sm text-neutral-500">{status}</p><p className="mt-1 text-2xl font-black text-neutral-900">{bookings.filter((booking) => (booking.status || "Pending") === status).length}</p></div>)}
        </section>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-bold text-neutral-950">All customer bookings</h2><p className="mt-1 text-sm text-neutral-500">Showing {adminBookings.length} of {bookings.length}</p></div>
          <label className="text-sm font-semibold text-neutral-700">Filter by status<select value={adminStatusFilter} onChange={(event) => setAdminStatusFilter(event.target.value)} className="ml-2 border border-neutral-300 bg-white px-3 py-2"><option>All</option>{bookingStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        <div className="mt-4 overflow-x-auto border border-neutral-200 bg-white">
          {adminBookings.length === 0 ? <EmptyState text="There are no bookings in this status yet." /> : <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-neutral-900 text-white"><tr>{["Booking", "Customer", "Phone", "Car", "Service", "Appointment", "Service status"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
            <tbody>{adminBookings.map((booking) => <tr key={booking.id} className="border-t border-neutral-200 align-top">
              <td className="px-4 py-4 font-semibold">#{booking.id}</td>
              <td className="px-4 py-4">{booking.name}</td>
              <td className="px-4 py-4">{booking.phone}</td>
              <td className="px-4 py-4">{booking.car_model}</td>
              <td className="px-4 py-4">{booking.service}</td>
              <td className="px-4 py-4">{booking.date}<span className="block text-xs text-neutral-500">{booking.time}</span></td>
              <td className="px-4 py-4"><label className="sr-only" htmlFor={`admin-status-${booking.id}`}>Service status for booking {booking.id}</label><select id={`admin-status-${booking.id}`} value={booking.status || "Pending"} disabled={adminUpdating === booking.id} onChange={(event) => updateAdminStatus(booking.id, event.target.value)} className="border border-neutral-300 bg-white px-3 py-2 font-semibold disabled:opacity-60">{bookingStatuses.map((status) => <option key={status}>{status}</option>)}</select></td>
            </tr>)}</tbody>
          </table>}
        </div>
      </>}

      {page === "dashboard" && <>
        <section className="flex flex-wrap items-end justify-between gap-5 border-b border-neutral-300 pb-6"><div><p className="text-sm font-semibold uppercase text-red-600">Your service desk</p><h1 className="mt-1 text-3xl font-black text-neutral-950">Welcome, {user.name}</h1><p className="mt-2 text-neutral-600">Here is what is happening with your car care.</p></div><div className="flex gap-3"><button onClick={() => navigate("history")} className="border border-neutral-400 px-4 py-3 text-sm font-semibold hover:border-neutral-900">Booking history</button><button onClick={() => startBooking()} className="bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700">+ Book service</button></div></section>
        <section className="mt-6 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-4">{["Pending", "Confirmed", "Completed", "Cancelled"].map((status) => <div key={status} className="bg-white p-4"><p className="text-sm text-neutral-500">{status}</p><p className="mt-1 text-3xl font-black text-neutral-900">{counts[status] || 0}</p></div>)}</section>
        <section className="mt-10"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold text-neutral-950">Upcoming bookings</h2><p className="mt-1 text-sm text-neutral-500">Your next scheduled appointments</p></div><button onClick={() => navigate("bookings")} className="text-sm font-semibold text-red-600">All bookings</button></div>{bookingTable(upcoming.slice(0, 4))}</section>
        <section className="mt-10"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold text-neutral-950">Available services</h2><p className="mt-1 text-sm text-neutral-500">Book a service from our current menu</p></div><button onClick={() => navigate("services")} className="text-sm font-semibold text-red-600">Browse all</button></div>{serviceCards()}</section>
      </>}

      {page === "services" && <PageTitle title="Browse services" subtitle="Choose the care your car needs. Service prices are set by the center." />}
      {page === "services" && <div className="mt-6">{services.length ? serviceCards() : <EmptyState text="Services are unavailable right now." />}</div>}

      {page === "book" && <div className="mx-auto max-w-3xl"><PageTitle title="Book a service" subtitle="Choose an appointment and tell us about your car." /><form onSubmit={submitBooking} className="mt-6 grid gap-5 border border-neutral-200 bg-white p-6 sm:grid-cols-2">
        <Field label="Your name" value={bookingForm.name} onChange={(value) => setBookingForm({ ...bookingForm, name: value })} required />
        <Field label="Phone number" type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} title="Enter exactly 10 digits." value={bookingForm.phone} onChange={(value) => setBookingForm({ ...bookingForm, phone: value })} required />
        <Field label="Car make and model" value={bookingForm.car_model} onChange={(value) => setBookingForm({ ...bookingForm, car_model: value })} required />
        <label className="block text-sm font-semibold text-neutral-800">Service<select required value={bookingForm.service} onChange={(event) => setBookingForm({ ...bookingForm, service: event.target.value })} className="mt-1 block w-full border border-neutral-300 bg-white px-3 py-2.5 font-normal">{services.map((item) => <option key={item.name} value={item.name}>{item.name} - {money(item.price)}</option>)}</select></label>
        <Field label="Appointment date" type="date" min={futureDate} value={bookingForm.date} onChange={(value) => setBookingForm({ ...bookingForm, date: value })} required />
        <Field label="Appointment time" type="time" value={bookingForm.time} onChange={(value) => setBookingForm({ ...bookingForm, time: value })} required />
        <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-5 sm:col-span-2"><p className="text-sm text-neutral-600">Price <span className="ml-2 text-lg font-bold text-red-600">{money(services.find((item) => item.name === bookingForm.service)?.price)}</span></p><button disabled={busy} className="bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy ? "Submitting..." : "Request booking"}</button></div>
      </form></div>}

      {(page === "bookings" || page === "history") && <><PageTitle title={page === "history" ? "Booking history" : "My bookings"} subtitle={page === "history" ? "Completed and cancelled appointments from your account." : "Track upcoming appointments and see each booking's status."} /><div className="my-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2">{["All", "Pending", "Confirmed", "Completed", "Cancelled"].map((status) => <button key={status} onClick={() => setFilter(status)} className={`px-3 py-2 text-sm font-semibold ${filter === status ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"}`}>{status}</button>)}</div>{page === "bookings" && <button onClick={() => startBooking()} className="bg-red-600 px-4 py-2 text-sm font-bold text-white">+ Book service</button>}</div>{bookingTable(shownBookings)}</>}

      {page === "detail" && detail && <><button onClick={() => navigate("bookings")} className="mb-5 text-sm font-semibold text-red-600">← Back to bookings</button><PageTitle title={`Booking #${detail.id}`} subtitle="Appointment and service details" /><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]"><section className="border border-neutral-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-5"><div><p className="text-sm text-neutral-500">Service</p><h2 className="mt-1 text-xl font-bold">{detail.service}</h2></div><Status value={detail.status} /></div><dl className="grid gap-x-8 gap-y-5 py-5 sm:grid-cols-2">{[["Appointment date", detail.date], ["Appointment time", detail.time], ["Car", detail.car_model], ["Contact phone", detail.phone], ["Service price", money(services.find((item) => item.name === detail.service)?.price)], ["Payment status", detail.payment_status || "Unpaid"]].map(([label, value]) => <div key={label}><dt className="text-sm text-neutral-500">{label}</dt><dd className="mt-1 font-semibold text-neutral-900">{value}</dd></div>)}</dl>{detail.reschedule_date && <div className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm"><strong>Reschedule request pending review</strong><p className="mt-1">Requested: {detail.reschedule_date} at {detail.reschedule_time}</p></div>}
        {detail.status === "Completed" && <form onSubmit={(event) => submitReview(event, detail.id)} className="mt-5 border-t border-neutral-200 pt-5"><h3 className="font-bold">Share your feedback</h3>{detail.review_rating ? <p className="mt-2 text-sm">Your rating: {detail.review_rating}/5 · {detail.review_text}</p> : <div className="mt-3 flex flex-wrap gap-3"><select name="rating" required className="border border-neutral-300 px-3 py-2"><option value="">Rating</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select><input name="review" required placeholder="Write a short review" className="min-w-52 flex-1 border border-neutral-300 px-3 py-2"/><button className="bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Submit review</button></div>}</form>}
        </section><aside className="h-fit border border-neutral-200 bg-white p-5"><h3 className="font-bold">Booking actions</h3>{["Pending", "Confirmed"].includes(detail.status) && detail.date >= futureDate ? <div className="mt-4 grid gap-3"><button onClick={() => navigate("reschedule")} className="border border-neutral-300 px-4 py-2.5 text-sm font-semibold hover:border-neutral-900">Request reschedule</button><button onClick={() => cancelBooking(detail.id)} className="border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Cancel booking</button></div> : <p className="mt-3 text-sm text-neutral-500">No actions are available for this booking.</p>}</aside></div></>}

      {page === "reschedule" && detail && <div className="mx-auto max-w-xl"><PageTitle title="Request a new time" subtitle={`Booking #${detail.id} · ${detail.service}`} /><form onSubmit={submitReschedule} className="mt-6 grid gap-5 border border-neutral-200 bg-white p-6"><Field label="Requested date" name="date" type="date" min={futureDate} required /><Field label="Requested time" name="time" type="time" required /><p className="text-sm text-neutral-500">This is a request only. Your current appointment remains unchanged until the service center reviews it.</p><div className="flex justify-end gap-3"><button type="button" onClick={() => navigate("detail")} className="border border-neutral-300 px-4 py-2.5">Back</button><button className="bg-red-600 px-4 py-2.5 font-bold text-white">Send request</button></div></form></div>}

      {page === "profile" && <div className="mx-auto max-w-2xl"><PageTitle title="My profile" subtitle="Update your contact details and account password." /><form onSubmit={submitProfile} className="mt-6 grid gap-5 border border-neutral-200 bg-white p-6 sm:grid-cols-2"><Field label="Full name" value={profile.name} onChange={(value) => setProfile({ ...profile, name: value })} required /><Field label="Email" value={profile.email} onChange={() => {}} disabled /><Field label="Phone number" type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} title="Enter exactly 10 digits." value={profile.phone} onChange={(value) => setProfile({ ...profile, phone: value })} required /><label className="block text-sm font-semibold text-neutral-800 sm:col-span-2">Address<textarea value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} rows="3" className="mt-1 block w-full border border-neutral-300 px-3 py-2.5 font-normal" /></label><div className="sm:col-span-2"><button className="bg-red-600 px-5 py-2.5 font-bold text-white">Save profile</button></div></form><form onSubmit={submitPassword} className="mt-6 grid gap-4 border border-neutral-200 bg-white p-6"><h2 className="font-bold">Change password</h2><Field label="Current password" name="current_password" type="password" required /><Field label="New password" name="new_password" type="password" minLength={8} required /><div><button className="border border-neutral-400 px-4 py-2.5 text-sm font-semibold hover:border-neutral-900">Update password</button></div></form></div>}

      {page === "contact" && <><PageTitle title="Contact us" subtitle="Our service center team can help with booking questions." /><section className="mt-6 grid gap-5 border border-neutral-200 bg-white p-6 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase text-neutral-500">Service center</p><p className="mt-2 font-semibold">3M Car Care</p></div><div><p className="text-xs font-bold uppercase text-neutral-500">Phone</p><p className="mt-2 text-neutral-700">Contact number not configured</p></div><div><p className="text-xs font-bold uppercase text-neutral-500">Address</p><p className="mt-2 text-neutral-700">Address not configured</p></div></section></>}
    </main>
    <footer className="mt-10 border-t border-neutral-200 bg-white px-5 py-5 text-center text-sm text-neutral-500">3M Car Care Service Center</footer>
  </div>;
}

function Field({ label, value, onChange, type = "text", required = false, disabled = false, min, minLength, maxLength, pattern, title, inputMode, name }) {
  return <label className="block text-sm font-semibold text-neutral-800">{label}<input name={name} type={type} required={required} disabled={disabled} min={min} minLength={minLength} maxLength={maxLength} pattern={pattern} title={title} inputMode={inputMode} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="mt-1 block w-full border border-neutral-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-red-600 disabled:bg-neutral-100" /></label>;
}

function PageTitle({ title, subtitle }) {
  return <div className="border-b border-neutral-300 pb-5"><h1 className="text-3xl font-black text-neutral-950">{title}</h1><p className="mt-2 text-neutral-600">{subtitle}</p></div>;
}

function Status({ value }) {
  const colors = { Pending: "bg-amber-100 text-amber-900", Confirmed: "bg-blue-100 text-blue-900", Completed: "bg-green-100 text-green-900", Cancelled: "bg-neutral-200 text-neutral-700" };
  return <span className={`inline-flex px-2.5 py-1 text-xs font-bold ${colors[value] || "bg-neutral-100 text-neutral-700"}`}>{value || "Pending"}</span>;
}

function EmptyState({ text }) {
  return <div className="border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">{text}</div>;
}

export default App;
