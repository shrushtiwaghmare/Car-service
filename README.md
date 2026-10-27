# 3M Car Care

A simple car service booking website made as a college project.

- Frontend: React + Vite + Tailwind CSS
- Backend: Netlify Function (`netlify/functions/bookings.mjs`)
- Database: Netlify Database (Postgres)

## Pages

- Home - navbar, hero section and service cards
- Services - list of all services with price
- Book Service - booking form
- Bookings - table of all bookings with a Delete button

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

## How to deploy on Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new project → Import from Git** and pick this repo.
   Build settings are read from `netlify.toml`, so nothing needs to be filled in.
3. Deploy. Netlify creates the database and runs the migrations in
   `netlify/database/migrations/` automatically on every deploy.

## API routes

| Method | Route                | What it does        |
| ------ | -------------------- | ------------------- |
| GET    | /api/bookings        | get all bookings    |
| POST   | /api/bookings        | save a new booking  |
| DELETE | /api/bookings/&lt;id&gt;   | delete one booking  |

## Database table

One table called `bookings` (see `netlify/database/migrations/0001_create_bookings.sql`) with columns:
`id, name, phone, car_model, service, date, time`

To change the table, add a new migration file (e.g. `0002_add_email.sql`) instead of editing the old one.
