import { getDatabase } from "@netlify/database";

const db = getDatabase();
const FIELDS = ["name", "phone", "car_model", "service", "date", "time"];

// GET    /api/bookings      -> all bookings
// POST   /api/bookings      -> save a new booking
// DELETE /api/bookings/:id  -> delete one booking
export default async (req, context) => {
  const id = context.params.id;

  if (req.method === "GET" && !id) {
    return Response.json(await db.sql`SELECT * FROM bookings ORDER BY id`);
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
    await db.sql`DELETE FROM bookings WHERE id = ${Number(id)}`;
    return Response.json({ message: "Booking deleted." });
  }

  return Response.json({ message: "Not found." }, { status: 404 });
};

export const config = { path: ["/api/bookings", "/api/bookings/:id"] };
