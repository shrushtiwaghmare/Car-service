# 3M Car Care

A simple car service booking website made as a college project.

- Frontend: React + Vite + Tailwind CSS
- Backend: Netlify Function (`netlify/functions/api.mjs`)
- Database: Netlify Database (Postgres)

## Pages

- Sign in / Register - accounts need a Gmail address and an 8+ character password
- Dashboard - booking counts, upcoming bookings and services
- Services - all services with price
- Book a service - booking form (10-digit phone, date today or later)
- My Bookings / History - your own bookings, filter by status
- Booking detail - cancel, request a reschedule, review after a completed service
- My Profile - name, phone, address and password change
- Contact

Each user only sees their own bookings. To make an admin account, set the
`CARCARE_ADMIN_EMAIL` environment variable in Netlify before that email registers;
the admin can see all bookings through `/api/bookings` and the `/api/admin/...` routes.

## How to run locally

```bash
npm install                 # backend dependency (@netlify/database)
npm --prefix frontend install
npx netlify-cli dev         # starts Vite + the API + a local Postgres database
```

The first time (and after pulling a new migration), update the local database:

```bash
npx netlify-cli database migrations apply
```

The website runs on http://localhost:8888 (Vite itself runs on 5180 behind it).

## How to deploy on Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new project → Import from Git** and pick this repo.
   Build settings are read from `netlify.toml`, so nothing needs to be filled in.
3. Deploy. Netlify creates the database and runs the migrations in
   `netlify/database/migrations/` automatically on every deploy.

## API routes

| Method | Route | What it does |
| ------ | ----- | ------------ |
| GET | /api/services | list of services |
| POST | /api/auth/register, /api/auth/login | create an account / sign in (sets a session cookie) |
| POST | /api/auth/logout | sign out |
| GET | /api/auth/me | the signed-in account |
| GET, PUT | /api/profile | view / update profile |
| PUT | /api/profile/password | change password |
| GET, POST | /api/bookings | your bookings / new booking |
| GET | /api/bookings/&lt;id&gt; | one booking |
| POST | /api/bookings/&lt;id&gt;/cancel, /reschedule, /review | booking actions |
| GET | /api/admin/bookings | all bookings (admin) |
| PUT | /api/admin/bookings/&lt;id&gt; | change status (admin) |
| PUT | /api/admin/bookings/&lt;id&gt;/reschedule | approve or reject a reschedule (admin) |

## Tests

With `npx netlify-cli dev` running, run `npm test` (API tests in `tests/api.test.mjs`).

## Database tables

See `netlify/database/migrations/`:

- `bookings` - id, name, phone, car_model, service, date, time, user_id, status,
  payment_status, reschedule_date, reschedule_time, review_rating, review_text
- `users` - id, name, email, password_hash, phone, address, role
- `sessions` - token, user_id, created_at (sign-ins last 30 days)

To change a table, add a new migration file (e.g. `0003_add_email.sql`) instead of editing the old ones.
