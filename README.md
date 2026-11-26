# Subdivision Connect

A student project for subdivision reports, visitors, and gate records.

## What is already here?

- **Frontend:** the HTML pages, CSS design, and JavaScript that people see and click.
- **Backend:** Node.js with Express. It checks logins and handles saving and loading.
- **Database:** PostgreSQL through PGlite for localhost. It saves records in `data/pgdata` on your computer.

Think of it like this: the frontend is the form, the backend checks the form, and the database keeps the answers.

## Run on your computer

Install Node.js 22 or newer first (Node.js 24 is recommended).

Open a terminal inside this folder and run:

```sh
npm install
npm start
```

Open **http://127.0.0.1:3000** in your browser. http://localhost:3000 also works on a machine where localhost resolves to IPv4. Use the same address throughout a session so your login cookie stays with it.

You do not need a separate database installation for localhost. The app creates its tables on startup. It also creates these sample accounts when the database is empty:

| Role | Email | Password |
| --- | --- | --- |
| Resident | maria.santos@carmela.ph | StudentDemo123! |
| Admin | admin@carmela.ph | StudentDemo123! |
| Guard | guard.tony@carmela.ph | StudentDemo123! |

These are sample accounts for development, not real accounts for a public deployment. You can set `DEMO_PASSWORD` before the first run to choose a different sample password. Changing it later does not reset existing accounts.

Stop the app with Ctrl+C. Start it again with `npm start`. Your records stay saved. Keep a backup of `data/` while the app is stopped if you want a copy of the local database. Do not commit this folder or `.env` to GitHub.

## Try it step by step

1. Log in as the resident and submit a report. A photo is optional.
2. Refresh the page. The report should still be there.
3. Log out and sign in as admin. Open Reports, choose the report, change its status, and write an update.
4. Sign in as the resident again. Check the report and the notification bell.
5. Register a visitor and copy the visitor code.
6. Sign in as guard. Search for the code, check the visitor in, and mark them left afterward.
7. Open Gate log. The entry and exit should both be recorded. You can download a CSV copy.
8. As admin, post an announcement. Residents see it on their home page; guards see it on the gate page.

Admin can also add accounts from the dashboard. For a resident, enter their block and lot. More than one resident can belong to the same household. Visitors are private to the resident who registered them; guards and admins can see all visitors. Reports are visible to residents as community concerns, so avoid putting private information in report descriptions or photos.

## Main features

- Real password login, password hashing, an 8-hour login session, and logout.
- Separate resident, admin, and guard permissions checked on the server.
- Reports with a category, location, urgency, optional photo, affected-resident count, and update history.
- Admin status changes, responsible-party assignment, and follow-up notes.
- Visitor registration, unique codes, cancellation, check-in, denial, checkout, and confirmed walk-ins.
- Gate history and CSV export.
- Announcements with pinning and deletion.
- Saved in-app notifications. These do not send email, SMS, or phone push notifications.
- Search, filters, account creation, and totals calculated from saved records.

Lists have a Refresh button where useful. Reload the page to see another account's latest changes. Forms are not cleared just because you switch windows. This version does not connect to an AI service; report categories are chosen by the resident.

## Use a separate PostgreSQL server later

PGlite is a local PostgreSQL build, good for running this project on one computer. For a shared deployment, use a normal PostgreSQL server and set its connection string:

1. Copy `.env.example` to `.env`.
2. Put your PostgreSQL connection string in `DATABASE_URL`.
3. Run `npm start`.

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE
SEED_DEMO=false
```

The same `server/schema.sql` creates the tables in either mode. Data is **not automatically copied** between PGlite and a separate PostgreSQL database. Leave `DATABASE_URL` empty to return to the local database.

For a clean shared database, create the first admin in a controlled setup by temporarily enabling demo seeding with a private `DEMO_PASSWORD`, then disable seeding. The admin can create the real accounts. Password reset, email verification, account disabling, and a dedicated first-admin setup screen are future additions.

For HTTPS hosting, set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain.example`, `SEED_DEMO=false`, and `DATABASE_URL`. If a reverse proxy is used, configure its trusted-hop setting before relying on request IPs. The server binds to `127.0.0.1` by default; `HOST` and `PORT` can override it. The local database should be opened by only one app process at a time. The public website will need a Node.js host; GitHub Pages alone cannot run this backend.

## Where things are

```text
index.html, login.html       Role selection and login
resident/, admin/, guard/    Page layouts for each role
css/                        Page styling
js/app.js                   Frontend actions and API requests
js/login.js                 Login form
server/app.js               Backend routes and permission checks
server/schema.sql           Database tables and relationships
server/db.js                Local or separate PostgreSQL connection
server/seed.js              Sample accounts
test/app.test.js            Tests using a temporary database
data/pgdata/                 Local saved database (ignored by Git)
```

Database tables: `users`, `households`, `sessions`, `reports`, `report_updates`, `report_supporters`, `visits`, `gate_events`, `announcements`, and `notifications`. A user's `household_id` links them to their household.

## Test

```sh
npm test
```

The test uses its own temporary on-disk PGlite database. It checks login, permissions, account creation, reports, photos, support counts, admin updates, visitor ownership, gate transitions, announcements, notifications, logout, and persistence after reopening the database. It does not touch your local app data. A GitHub Actions workflow runs the same test when changes are pushed or a pull request is opened.

The separate PostgreSQL connection is supported in the code; the automated integration test currently verifies PGlite. Browser checks should also be done before using the app with real residents.
