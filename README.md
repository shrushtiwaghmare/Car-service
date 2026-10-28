# 3M Car Care

A simple car service booking website made as a college project.

- Frontend: React + Vite + Tailwind CSS
- Backend: Netlify Function (`netlify/functions/bookings.mjs`)
- Database: Netlify Database (Postgres)

## Pages

- Home - navbar, hero section and service cards
- Services - list of all services with price
- Book Service - booking form
- Admin - protected customer booking list and service status management

## How to run locally

```bash
npm install                 # backend dependency (@netlify/database)
npm --prefix frontend install
npx netlify-cli dev         # starts Vite + the API + a local Postgres database
```

The first time, create the table in the local database:

```bash
npx netlify-cli database migrations apply
```

The website runs on http://localhost:8888 (Vite itself runs on 5180 behind it).

## Admin access

The admin email is `admin22@gmail.com`. For local development, set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in the ignored root `.env` file. Before deploying, set both values in the Netlify site environment variables; use a strong password and a unique random session secret in production. The development password in this checkout is `admin123`.

## How to deploy on Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new project → Import from Git** and pick this repo.
   Build settings are read from `netlify.toml`, so nothing needs to be filled in.
3. Deploy. Netlify creates the database and runs the migrations in
   `netlify/database/migrations/` automatically on every deploy.

## API routes

| Method | Route                | What it does        |
| ------ | -------------------- | ------------------- |
| POST   | /api/bookings        | save a new booking  |
| POST   | /api/admin/login | Sign in as administrator |
| GET | /api/admin/session | Check administrator session |
| GET | /api/admin/bookings | List all bookings (administrator only) |
| PUT | /api/admin/bookings/&lt;id&gt;/status | Update a booking's service status (administrator only) |
| POST | /api/admin/logout | Sign out |
| DELETE | /api/bookings/&lt;id&gt; | Delete a booking (administrator only) |

## Database table

One table called `bookings` (see `netlify/database/migrations/0001_create_bookings.sql`) with columns:
`id, name, phone, car_model, service, date, time, status`

To change the table, add a new migration file (e.g. `0002_add_email.sql`) instead of editing the old one.
