// API checks for the Netlify function. Start `npx netlify-cli dev` first, then: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
const run = Date.now();
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

// a tiny client that keeps its own session cookie, like one browser
function client() {
  let cookie = "";
  return async (method, path, body) => {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}

async function signedIn(name) {
  const api = client();
  const r = await api("POST", "/auth/register", {
    name, email: `${name.toLowerCase()}${run}@gmail.com`, password: "valid-password-123",
  });
  assert.equal(r.status, 201);
  return api;
}

const booking = (extra = {}) => ({
  name: "Alice", phone: "5550101234", car_model: "Honda Civic", service: "Oil Change",
  date: today, time: "10:30", ...extra,
});

test("bookings need login", async () => {
  assert.equal((await client()("GET", "/bookings")).status, 401);
  assert.equal((await client()("GET", "/services")).data.length, 6);
});

test("register needs gmail, login and logout work", async () => {
  const api = client();
  const email = `carol${run}@gmail.com`;
  assert.equal((await api("POST", "/auth/register", { name: "Carol", email: "c@example.com", password: "valid-password-123" })).status, 400);
  assert.equal((await api("POST", "/auth/register", { name: "Carol", email, password: "valid-password-123" })).status, 201);
  assert.equal((await api("POST", "/auth/register", { name: "Carol", email, password: "valid-password-123" })).status, 409);
  assert.equal((await api("POST", "/auth/logout")).status, 200);
  assert.equal((await api("GET", "/auth/me")).status, 401);
  assert.equal((await api("POST", "/auth/login", { email, password: "wrong-password" })).status, 401);
  assert.equal((await api("POST", "/auth/login", { email, password: "valid-password-123" })).status, 200);
  assert.equal((await api("GET", "/auth/me")).data.user.email, email);
});

test("users only see and manage their own bookings", async () => {
  const alice = await signedIn("Alice");
  const created = await alice("POST", "/bookings", booking());
  assert.equal(created.status, 201);
  const id = created.data.id;

  const bob = await signedIn("Bob");
  assert.deepEqual((await bob("GET", "/bookings")).data, []);
  assert.equal((await bob("GET", `/bookings/${id}`)).status, 404);
  assert.equal((await bob("POST", `/bookings/${id}/cancel`)).status, 404);
  assert.equal((await bob("PUT", `/admin/bookings/${id}`, { status: "Completed" })).status, 403);
});

test("booking rejects bad service, time, phone and name", async () => {
  const api = await signedIn("Dan");
  assert.equal((await api("POST", "/bookings", booking({ service: "Unknown service" }))).status, 400);
  assert.equal((await api("POST", "/bookings", booking({ time: "29:91" }))).status, 400);
  assert.equal((await api("POST", "/bookings", booking({ name: 42 }))).status, 400);
  assert.equal((await api("POST", "/bookings", booking({ phone: "123-456-7890" }))).status, 400);
  assert.equal((await api("POST", "/bookings", booking({ date: "2020-01-01" }))).status, 400);
});

test("reschedule request keeps the date, then cancel", async () => {
  const api = await signedIn("Eve");
  const { id } = (await api("POST", "/bookings", booking())).data;
  assert.equal((await api("POST", `/bookings/${id}/reschedule`, { date: tomorrow, time: "11:45" })).status, 200);
  const b = (await api("GET", `/bookings/${id}`)).data;
  assert.equal(b.date, today);
  assert.equal(b.reschedule_date, tomorrow);
  assert.equal(b.status, "Pending");
  assert.equal(b.price, 999);
  assert.equal((await api("POST", `/bookings/${id}/cancel`)).status, 200);
  assert.equal((await api("GET", `/bookings/${id}`)).data.status, "Cancelled");
  assert.equal((await api("POST", `/bookings/${id}/review`, { rating: 5, review: "Nice" })).status, 400);
});

test("profile and password are per user", async () => {
  const api = await signedIn("Frank");
  assert.equal((await api("PUT", "/profile", { name: "Frank", phone: "123456789", address: "" })).status, 400);
  assert.equal((await api("PUT", "/profile", { name: "Frank Updated", phone: "5550101234", address: "Main Street" })).status, 200);
  const profile = (await api("GET", "/profile")).data;
  assert.equal(profile.name, "Frank Updated");
  assert.equal(profile.address, "Main Street");
  assert.equal((await (await signedIn("Grace"))("GET", "/profile")).data.name, "Grace");
  assert.equal((await api("PUT", "/profile/password", { current_password: "nope-nope", new_password: "another-pass-1" })).status, 400);
  assert.equal((await api("PUT", "/profile/password", { current_password: "valid-password-123", new_password: "another-pass-1" })).status, 200);
});
