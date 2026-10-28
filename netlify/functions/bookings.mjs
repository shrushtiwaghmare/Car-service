import { getDatabase } from "@netlify/database";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const db = getDatabase();
const FIELDS = ["name", "phone", "car_model", "service", "date", "time"];
const ADMIN_EMAIL = "admin22@gmail.com";
const SESSION_COOKIE = "carcare_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const BOOKING_STATUSES = ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled"];

function safeEqual(value, expected) {
  const valueHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(valueHash, expectedHash);
}

function makeSession(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token || !process.env.ADMIN_SESSION_SECRET) return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.email === ADMIN_EMAIL && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

function sessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${secure}`;
}

function requireAdmin(request) {
  return readSession(request);
}

// GET    /api/bookings      -> all bookings
// POST   /api/bookings      -> save a new booking
// DELETE /api/bookings/:id  -> delete one booking
export default async (req, context) => {
  const id = context.params.id;
  const path = new URL(req.url).pathname;

  if (path === "/api/admin/login" && req.method === "POST") {
    if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
      return json({ message: "Admin sign-in is not configured on the server." }, 503);
    }
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    if (email !== ADMIN_EMAIL || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
      return json({ message: "Email or password is incorrect." }, 401);
    }
    return json({ email: ADMIN_EMAIL }, 200, {
      "Set-Cookie": sessionCookie(req, makeSession(ADMIN_EMAIL), SESSION_DURATION_SECONDS),
    });
  }

  if (path === "/api/admin/logout" && req.method === "POST") {
    return json({ message: "Signed out." }, 200, { "Set-Cookie": sessionCookie(req, "", 0) });
  }

  if (path === "/api/admin/session" && req.method === "GET") {
    const session = requireAdmin(req);
    return session
      ? json({ email: session.email })
      : json({ message: "Please sign in as the administrator." }, 401);
  }

  if (path === "/api/admin/bookings" && req.method === "GET") {
    if (!requireAdmin(req)) return json({ message: "Administrator sign-in required." }, 401);
    return json(await db.sql`SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC`);
  }

  if (path.startsWith("/api/admin/bookings/") && path.endsWith("/status") && req.method === "PUT") {
    if (!requireAdmin(req)) return json({ message: "Administrator sign-in required." }, 401);
    if (!/^\d+$/.test(id ?? "")) return json({ message: "Booking not found." }, 404);
    const body = await req.json().catch(() => ({}));
    if (!BOOKING_STATUSES.includes(body?.status)) {
      return json({ message: "Choose a valid service status." }, 400);
    }
    const [booking] = await db.sql`
      UPDATE bookings SET status = ${body.status} WHERE id = ${Number(id)} RETURNING *`;
    return booking ? json(booking) : json({ message: "Booking not found." }, 404);
  }

  if (req.method === "GET" && !id) {
    if (!requireAdmin(req)) return json({ message: "Administrator sign-in required." }, 401);
    return json(await db.sql`SELECT * FROM bookings ORDER BY id`);
  }

  if (req.method === "POST" && !id) {
    const body = await req.json().catch(() => ({}));
    // trim every field so "   " counts as empty
    const b = Object.fromEntries(FIELDS.map((f) => [f, String(body?.[f] ?? "").trim()]));
    if (FIELDS.some((f) => !b[f])) {
      return Response.json({ message: "Please fill all fields." }, { status: 400 });
    }
    await db.sql`
      INSERT INTO bookings (name, phone, car_model, service, date, time)
      VALUES (${b.name}, ${b.phone}, ${b.car_model}, ${b.service}, ${b.date}, ${b.time})`;
    return Response.json({ message: "Booking saved successfully!" });
  }

  if (req.method === "DELETE" && /^\d+$/.test(id ?? "")) {
    if (!requireAdmin(req)) return json({ message: "Administrator sign-in required." }, 401);
    await db.sql`DELETE FROM bookings WHERE id = ${Number(id)}`;
    return json({ message: "Booking deleted." });
  }

  return json({ message: "Not found." }, 404);
};

export const config = {
  path: [
    "/api/admin/login",
    "/api/admin/logout",
    "/api/admin/session",
    "/api/admin/bookings",
    "/api/admin/bookings/:id/status",
    "/api/bookings",
    "/api/bookings/:id",
  ],
};
