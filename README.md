# 3M Car Care

A simple car service booking website made as a college project.

- Frontend: React + Vite + Tailwind CSS
- Backend: Python + Flask
- Database: SQLite

## Pages

- Home - navbar, hero section and service cards
- Services - list of all services with price
- Book Service - booking form
- Bookings - table of all bookings with a Delete button

## How to run the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend runs on http://127.0.0.1:5000 and it creates `carcare.db` automatically.

## How to run the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The website runs on http://localhost:5180

## API routes

| Method | Route                | What it does        |
| ------ | -------------------- | ------------------- |
| GET    | /api/bookings        | get all bookings    |
| POST   | /api/bookings        | save a new booking  |
| DELETE | /api/bookings/&lt;id&gt;   | delete one booking  |

## Database table

One table called `bookings` with columns:
`id, name, phone, car_model, service, date, time`
