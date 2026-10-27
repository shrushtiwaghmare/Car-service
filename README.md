# 3M Car Care

A simple car service booking website made as a college project.

- Frontend: React + Vite + Tailwind CSS
- Backend: Python + Flask
- Database: SQLite

## Pages

- Sign in / Register
- User dashboard - booking counts, upcoming appointments and services
- Services - database-backed booking flow using the server-side service catalog
- Book Service - validated appointment request
- My Bookings and Booking History - private to the signed-in user
- Booking Details - cancellation, rescheduling request, and completed-service review
- My Profile - contact details and password update
- Contact - service center contact placeholder until real contact information is configured

## How to run the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend runs on http://127.0.0.1:5001 and it creates or migrates `carcare.db` automatically. Set `CARCARE_SECRET_KEY` to a long random value for a stable session secret. Set `CARCARE_ADMIN_EMAIL` before startup to assign the Admin role to an account registered with that email. All other registrations receive the User role. Existing project data is preserved; older bookings without an account remain unassigned and are not exposed to user accounts.

## How to run the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The website runs on http://localhost:5180. Vite proxies `/api` requests to Flask so the signed session cookie works in the browser.

## API routes

| Method | Route | What it does |
| ------ | ----- | ------------ |
| POST | `/api/auth/register`, `/api/auth/login` | Register or sign in with a server-side session |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Get the signed-in account |
| GET | `/api/services` | Read the available service catalog |
| GET, PUT | `/api/profile` | Read or update the signed-in user's profile |
| PUT | `/api/profile/password` | Change the signed-in user's password |
| GET, POST | `/api/bookings` | List only the signed-in user's bookings or create a booking |
| GET | `/api/bookings/&lt;id&gt;` | Read an owned booking's details |
| POST | `/api/bookings/&lt;id&gt;/cancel` | Cancel an eligible owned booking |
| POST | `/api/bookings/&lt;id&gt;/reschedule` | Submit a reschedule request for admin review |
| POST | `/api/bookings/&lt;id&gt;/review` | Review a completed owned booking |
| GET, PUT | `/api/admin/bookings` | Admin-only booking list and status updates |
| PUT | `/api/admin/bookings/&lt;id&gt;/reschedule` | Admin-only reschedule decision |

## Database table

SQLite tables are `users` and `bookings`. Startup adds the user ownership, status, payment, reschedule, and review columns to an existing bookings table without deleting rows.

## Tests

From the repository root, run `python3 -m unittest backend.test_db backend.test_api`.

The starter project did not include an authentication system or a separate Admin Panel. Admin-only API operations are now role-guarded; the existing user interface is the user panel.
