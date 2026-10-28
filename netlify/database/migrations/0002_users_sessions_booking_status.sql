CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user'
);

-- one row per signed-in browser; the cookie holds the token
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN user_id INTEGER REFERENCES users(id),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'Pending',
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  ADD COLUMN reschedule_date TEXT,
  ADD COLUMN reschedule_time TEXT,
  ADD COLUMN review_rating INTEGER,
  ADD COLUMN review_text TEXT;

CREATE INDEX bookings_user_id_idx ON bookings(user_id);
