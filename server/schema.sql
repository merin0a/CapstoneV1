CREATE TABLE IF NOT EXISTS households (
 id SERIAL PRIMARY KEY, block TEXT NOT NULL, lot TEXT NOT NULL, UNIQUE(block, lot)
);
CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('resident','admin','guard')),
 household_id INTEGER REFERENCES households(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
 id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL,
 urgent BOOLEAN NOT NULL DEFAULT false, party TEXT NOT NULL DEFAULT 'unassigned'
 CHECK(party IN ('unassigned','hoa','developer','lgu')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','resolved')),
 photo TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS report_updates (
 id SERIAL PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS report_supporters (
 report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY(report_id,user_id)
);
CREATE TABLE IF NOT EXISTS visits (
 id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, host_id INTEGER NOT NULL REFERENCES users(id),
 name TEXT NOT NULL, type TEXT NOT NULL, visit_date DATE NOT NULL, visit_time TEXT NOT NULL DEFAULT '',
 plate TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'expected' CHECK(status IN ('expected','arrived','left','denied','cancelled')),
 id_left TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gate_events (
 id SERIAL PRIMARY KEY, visit_id INTEGER NOT NULL REFERENCES visits(id), guard_id INTEGER NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS announcements (
 id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 body TEXT NOT NULL, pinned BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message TEXT NOT NULL, link TEXT NOT NULL, seen BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_owner_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS visit_host_idx ON visits(host_id);
CREATE INDEX IF NOT EXISTS notification_owner_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS gate_visit_idx ON gate_events(visit_id);
