import { getDatabase } from "@netlify/database";
import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const db = getDatabase();
const pbkdf2Async = promisify(pbkdf2);

const SERVICES = [
  { icon: "🚿", name: "Car Wash", price: 499, about: "Outside and inside cleaning of your car." },
  { icon: "🛢️", name: "Oil Change", price: 999, about: "Engine oil and oil filter replacement." },
  { icon: "🔧", name: "General Service", price: 1499, about: "Basic checkup with all the main parts." },
  { icon: "❄️", name: "AC Service", price: 1299, about: "AC gas check, cleaning and cooling repair." },
  { icon: "🛑", name: "Brake Service", price: 1999, about: "Brake pad check and brake oil top up." },
  { icon: "🚗", name: "Full Car Service", price: 2999, about: "Complete service of your full car." },
];
const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
const FIELDS = ["name", "phone", "car_model", "service", "date", "time"];

const json = (data, status = 200) => Response.json(data, { status });
const today = () => new Date().toISOString().slice(0, 10);
const validPhone = (phone) => typeof phone === "string" && /^[0-9]{10}$/.test(phone);
const isOpen = (b) => ["Pending", "Confirmed"].includes(b.status) && b.date >= today();

// same format as the old Python backend: pbkdf2_sha256$salt$hexdigest
async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const digest = (await pbkdf2Async(password, salt, 240000, 32, "sha256")).toString("hex");
  return `pbkdf2_sha256$${salt}$${digest}`;
}

async function checkPassword(encoded, password) {
  const [algorithm, salt, digest] = encoded.split("$");
  if (algorithm !== "pbkdf2_sha256") return false;
  const actual = Buffer.from((await hashPassword(password, salt)).split("$")[2]);
  const expected = Buffer.from(digest);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validAppointment({ date, time } = {}) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  return date >= today() && typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

async function startSession(userId, req, context) {
  const token = randomBytes(32).toString("hex");
  await db.sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${userId})`;
  context.cookies.set({
    name: "session", value: token, path: "/", httpOnly: true, sameSite: "Lax",
    secure: new URL(req.url).protocol === "https:",
  });
}

async function currentUser(context) {
  const token = context.cookies.get("session");
  if (!token) return null;
  const [user] = await db.sql`
    SELECT u.id, u.name, u.email, u.phone, u.address, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.created_at > now() - interval '30 days'`;
  return user ?? null;
}

const getUser = async (id) => (await db.sql`SELECT id, name, email, phone, address, role FROM users WHERE id = ${id}`)[0];

// userId = null means any booking (admin)
async function getBooking(id, userId) {
  const [booking] = userId == null
    ? await db.sql`SELECT * FROM bookings WHERE id = ${id}`
    : await db.sql`SELECT * FROM bookings WHERE id = ${id} AND user_id = ${userId}`;
  return booking ?? null;
}

async function handle(req, context) {
  // ponytail: `netlify dev` retries a 403/404 as .html, .htm, /index.html and /index.htm
  // and keeps the last answer, so drop those endings to give the same reply every time
  const path = new URL(req.url).pathname
    .replace(/^\/api/, "").replace(/(\/index)?\.html?$/, "").replace(/\/$/, "");
  const method = req.method;
  const raw = method === "GET" ? {} : await req.json().catch(() => ({}));
  const data = raw && typeof raw === "object" ? raw : {};

  // ---------- public routes ----------
  if (method === "GET" && path === "/services") return json(SERVICES);

  if (method === "POST" && path === "/auth/register") {
    const name = String(data.name ?? "").trim();
    const email = String(data.email ?? "").trim().toLowerCase();
    const password = String(data.password ?? "");
    if (!name || !email.endsWith("@gmail.com")) {
      return json({ message: "Enter a valid Gmail address ending in @gmail.com." }, 400);
    }
    if (password.length < 8) return json({ message: "Password must be at least 8 characters." }, 400);
    const adminEmail = (process.env.CARCARE_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const role = adminEmail && email === adminEmail ? "admin" : "user";
    const [created] = await db.sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${name}, ${email}, ${await hashPassword(password)}, ${role})
      ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!created) return json({ message: "An account with this email already exists." }, 409);
    await startSession(created.id, req, context);
    return json({ user: await getUser(created.id) }, 201);
  }

  if (method === "POST" && path === "/auth/login") {
    const email = String(data.email ?? "").trim().toLowerCase();
    const [account] = await db.sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
    if (!account || !(await checkPassword(account.password_hash, String(data.password ?? "")))) {
      return json({ message: "Email or password is incorrect." }, 401);
    }
    await startSession(account.id, req, context);
    return json({ user: await getUser(account.id) });
  }

  if (method === "POST" && path === "/auth/logout") {
    const token = context.cookies.get("session");
    if (token) await db.sql`DELETE FROM sessions WHERE token = ${token}`;
    context.cookies.delete({ name: "session", path: "/" });
    return json({ message: "Signed out." });
  }

  // ---------- signed-in routes ----------
  const user = await currentUser(context);
  if (!user) return json({ message: "Please log in to continue." }, 401);
  const isAdmin = user.role === "admin";

  if (method === "GET" && path === "/auth/me") return json({ user });

  if (path === "/profile" && method === "GET") return json(user);
  if (path === "/profile" && method === "PUT") {
    const name = String(data.name ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    const address = String(data.address ?? "").trim();
    if (!name || !phone) return json({ message: "Name and phone number are required." }, 400);
    if (!validPhone(phone)) return json({ message: "Phone number must contain exactly 10 digits." }, 400);
    await db.sql`UPDATE users SET name = ${name}, phone = ${phone}, address = ${address} WHERE id = ${user.id}`;
    return json(await getUser(user.id));
  }

  if (method === "PUT" && path === "/profile/password") {
    const newPassword = String(data.new_password ?? "");
    if (newPassword.length < 8) return json({ message: "New password must be at least 8 characters." }, 400);
    const [row] = await db.sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
    if (!(await checkPassword(row.password_hash, String(data.current_password ?? "")))) {
      return json({ message: "Current password is incorrect." }, 400);
    }
    await db.sql`UPDATE users SET password_hash = ${await hashPassword(newPassword)} WHERE id = ${user.id}`;
    return json({ message: "Password updated." });
  }

  if (path === "/bookings" && method === "GET") {
    return json(isAdmin
      ? await db.sql`SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC`
      : await db.sql`SELECT * FROM bookings WHERE user_id = ${user.id} ORDER BY date DESC, time DESC, id DESC`);
  }

  if (path === "/bookings" && method === "POST") {
    if (!validPhone(data.phone)) return json({ message: "Phone number must contain exactly 10 digits." }, 400);
    if (!SERVICES.some((s) => s.name === data.service)) {
      return json({ message: "Please select an available service." }, 400);
    }
    if (!validAppointment(data)) return json({ message: "Please choose a valid date today or later." }, 400);
    const b = Object.fromEntries(FIELDS.map((f) => [f, typeof data[f] === "string" ? data[f].trim() : ""]));
    if (FIELDS.some((f) => !b[f])) return json({ message: "Please fill all fields." }, 400);
    const [created] = await db.sql`
      INSERT INTO bookings (name, phone, car_model, service, date, time, user_id)
      VALUES (${b.name}, ${b.phone}, ${b.car_model}, ${b.service}, ${b.date}, ${b.time}, ${user.id})
      RETURNING id`;
    return json({ message: "Booking saved successfully!", id: created.id }, 201);
  }

  const own = path.match(/^\/bookings\/(\d{1,9})(?:\/(cancel|reschedule|review))?$/);
  if (own) {
    const [, id, action] = own;
    if (!action && method === "GET") {
      const booking = await getBooking(Number(id), isAdmin ? null : user.id);
      if (!booking) return json({ message: "Booking not found." }, 404);
      return json({ ...booking, price: SERVICES.find((s) => s.name === booking.service)?.price ?? null });
    }
    if (action && method === "POST") {
      const booking = await getBooking(Number(id), user.id);
      if (!booking) return json({ message: "Booking not found." }, 404);

      if (action === "cancel") {
        if (!isOpen(booking)) return json({ message: "This booking can no longer be cancelled." }, 400);
        await db.sql`UPDATE bookings SET status = 'Cancelled' WHERE id = ${booking.id}`;
        return json({ message: "Booking cancelled." });
      }
      if (action === "reschedule") {
        if (!isOpen(booking)) return json({ message: "This booking cannot be rescheduled." }, 400);
        if (!validAppointment(data)) return json({ message: "Choose a valid future date and time." }, 400);
        await db.sql`UPDATE bookings SET reschedule_date = ${data.date}, reschedule_time = ${data.time}
                     WHERE id = ${booking.id}`;
        return json({ message: "Reschedule request sent for admin review." });
      }
      // review
      if (booking.status !== "Completed") {
        return json({ message: "Reviews are available after a completed service." }, 400);
      }
      const rating = Number.parseInt(data.rating, 10);
      const review = String(data.review ?? "").trim();
      if (!(rating >= 1 && rating <= 5) || !review) {
        return json({ message: "Choose a rating and write a review." }, 400);
      }
      await db.sql`UPDATE bookings SET review_rating = ${rating}, review_text = ${review} WHERE id = ${booking.id}`;
      return json({ message: "Thank you for your review." });
    }
  }

  // ---------- admin routes ----------
  const admin = path.match(/^\/admin\/bookings(?:\/(\d{1,9})(\/reschedule)?)?$/);
  if (admin) {
    if (!isAdmin) return json({ message: "Admin access required." }, 403);
    const [, id, reschedule] = admin;
    if (!id && method === "GET") {
      return json(await db.sql`SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC`);
    }
    if (id && method === "PUT") {
      const booking = await getBooking(Number(id), null);
      if (!booking) return json({ message: "Booking not found." }, 404);
      if (!reschedule) {
        if (!STATUSES.includes(data.status)) return json({ message: "Choose a valid booking status." }, 400);
        await db.sql`UPDATE bookings SET status = ${data.status} WHERE id = ${booking.id}`;
        return json({ message: "Booking status updated." });
      }
      if (!booking.reschedule_date || !booking.reschedule_time) {
        return json({ message: "No reschedule request found." }, 404);
      }
      if (data.decision === "approve") {
        if (!validAppointment({ date: booking.reschedule_date, time: booking.reschedule_time })) {
          return json({ message: "The requested date is no longer valid." }, 400);
        }
        await db.sql`UPDATE bookings SET date = reschedule_date, time = reschedule_time,
                     reschedule_date = NULL, reschedule_time = NULL WHERE id = ${booking.id}`;
      } else if (data.decision === "reject") {
        await db.sql`UPDATE bookings SET reschedule_date = NULL, reschedule_time = NULL WHERE id = ${booking.id}`;
      } else {
        return json({ message: "Decision must be approve or reject." }, 400);
      }
      return json({ message: "Reschedule request updated." });
    }
  }

  return json({ message: "Not found." }, 404);
}

export default async (req, context) => {
  try {
    return await handle(req, context);
  } catch (error) {
    console.error(error);
    return json({ message: "Something went wrong. Please try again." }, 500);
  }
};

export const config = { path: "/api/*" };
