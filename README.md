# NEU Library Visitor Management System

A web-based visitor management system for the **New Era University Library**. Students and faculty check in using their institutional email, log their reason for visiting, and check out when they leave. Admins monitor live occupancy, view visit logs, manage users, and post announcements — all in real time.

**Live site:** [neu-library-visitor-log.vercel.app](https://neu-library-visitor-log.vercel.app)

---

## Features

### For Students & Faculty
- Register and log in with `@neu.edu.ph` email only
- Select a visit reason: Reading, Researching, Use of Computer, or Meeting
- Confirmation popup before logging in
- Animated check-in success screen with personal QR code
- QR code download as a full-card image (name, program, NEU branding)
- Session timer showing how long you've been inside
- Visit history showing last 5 completed visits
- Monthly visit streak tracker
- Library hours pill showing open/closed status in PH time
- Live clock in navbar showing Philippine Standard Time

### For Admins
- Password-protected admin login
- Live occupancy count, today's visits, this week, and total registered users
- Currently Inside panel with real-time pulse indicators
- Daily visits bar chart (last 7 days) via Chart.js
- Full visit log table with date/time, name, program, reason, duration, and status
- Filter by date range or keyword
- Export to CSV or PDF
- Block/unblock users and delete accounts
- **Notices tab** — post Announcements with event dates and Reminders separately
- QR Scanner access (admin-only, session-guarded)
- Real-time auto-update via Supabase Realtime WebSocket subscriptions
- Auto midnight logout — stale "inside" records cleared automatically

### QR Scanner (Admin Kiosk)
- Accessible only from the admin dashboard
- Camera-based QR code scanning using jsQR
- Check-in: shows user info and reason selection buttons
- Check-out: **instant** auto-logout when scanning a user already inside (no confirmation needed — designed for high-traffic queues)
- Resets automatically after 3–4 seconds for the next person

---

## Project Structure

```
/
├── index.html              # Login, registration, and admin login
├── visitorlog.html         # Student/faculty check-in dashboard
├── admindashboard.html     # Admin control panel
├── qrscan.html             # QR scanner kiosk (admin only)
├── css/
│   ├── index.css
│   ├── visitorlog.css
│   ├── admindashboard.css
│   └── qrscan.css
└── img/
    ├── neulogo.png
    └── backgroundimg.jpg
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (ES Modules) |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime) |
| QR Generation | [qrcodejs](https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js) |
| QR Scanning | [jsQR](https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js) |
| Charts | [Chart.js 4.4.0](https://cdn.jsdelivr.net/npm/chart.js@4.4.0) |
| Hosting | [Vercel](https://vercel.com) |
| Version Control | GitHub |

---

## Database Schema

Run these in **Supabase → SQL Editor** to set up the database:

```sql
-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  program text,
  role text DEFAULT 'student',
  is_blocked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Visit logs table
CREATE TABLE visit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  time_in timestamptz DEFAULT now(),
  time_out timestamptz,
  status text DEFAULT 'inside'
);

-- Notices / Announcements table
CREATE TABLE notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text DEFAULT 'reminder',   -- 'event' or 'reminder'
  event_date date,                -- only for type='event'
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS (all access managed at app level)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;

-- Set timezone to Philippines
ALTER DATABASE postgres SET timezone TO 'Asia/Manila';

-- Let the DB control time_in (not the browser)
ALTER TABLE visit_logs ALTER COLUMN time_in SET DEFAULT now();
```

### Enable Realtime

Run this to enable live dashboard updates:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE visit_logs, users;
```

---

## Setup & Deployment

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) → create a new project
2. Run the SQL above in **SQL Editor**
3. Go to **Authentication → Providers → Email** → turn off **Confirm email**
4. Copy your **Project URL** and **anon/public key** from **Settings → API**
5. Replace the credentials in all four HTML files:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
```

### 2. GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 3. Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub
2. Click **Add New Project** → import your repo
3. Framework preset: **Other** (plain HTML, no build step)
4. Click **Deploy**

Vercel auto-deploys on every push to `main`.

---

## Admin Credentials

The admin login is handled client-side as a simple credential check:

- **Username:** `admin`
- **Password:** `admin123`

> To change these, edit the `adminLoginForm` handler in `index.html`.

---

## Key Design Decisions

**Time handling** — All timestamps are stored via Supabase's server-side `now()` function (not the browser clock). The database timezone is set to `Asia/Manila` so all times are stored and displayed in Philippine Standard Time (PST, UTC+8).

**QR security** — The QR Scanner page (`qrscan.html`) is protected by a session token (`sessionStorage`) that is only set when the admin clicks the QR Scanner button from the dashboard. Direct URL access redirects to the login page immediately.

**No email confirmation** — Supabase email confirmation is disabled so students can register and log in immediately without waiting for a verification email.

**Realtime** — The admin dashboard subscribes to `visit_logs` and `users` table changes via Supabase Realtime WebSockets. Stats, the Currently Inside panel, and the visit log update instantly when any check-in or check-out occurs — no page refresh needed.

**Instant QR logout** — When a student's QR is scanned and they're already inside, they are logged out immediately without any confirmation button. This prevents queues forming at the scanner during busy periods.

---

## Pages Overview

### `index.html` — Login & Registration
- Left panel: background image fill
- Right panel: login form, register form, admin login tab
- Domain restricted to `@neu.edu.ph` emails
- Announcement overlay (top-right) shows active library notices from Supabase
- After registration, automatically signs in to establish a clean session

### `visitorlog.html` — Visitor Check-in
- **Left panel:** Profile card (name, email, program, library hours), session timer, streak, visit history
- **Right panel:** Reason selection (square cards — Reading, Researching, Use of Computer, Meeting), confirm popup, animated check-in modal with QR code
- Landscape two-column layout, fully responsive down to mobile
- Shows "Already checked in" banner if user has an active visit today

### `admindashboard.html` — Admin Panel
- Stats row: Live Occupancy, Visits Today, This Week, Total Registered
- Charts: Daily visits bar chart + Currently Inside table
- Tabs: Visits Log, Manage Users, Notices
- Notices tab has two columns: Announcements/Events (with date) and Reminders

### `qrscan.html` — QR Kiosk
- Camera access via `getUserMedia` (requires HTTPS)
- Scans QR → checks user exists and is not blocked → shows reason buttons (check-in) or instantly logs out (if already inside)
- Resets every 3–4 seconds for the next person

---

## Responsive Design

All pages are fully responsive using CSS `clamp()` for fluid scaling:

| Screen | Layout |
|---|---|
| 1600px+ | Full landscape, wider panels |
| 1280–1599px | Standard landscape two-column |
| 900–1279px | Slightly compressed, same layout |
| Below 900px | Single column, stacked panels |
| Below 640px | Compact mobile, tighter padding |
| Below 400px | Minimal — clock hidden, elements tightened |

---

## Browser Support

Requires a modern browser with support for:
- ES Modules (`type="module"`)
- CSS `clamp()` and `aspect-ratio`
- `getUserMedia` (for QR scanner — HTTPS required)
- `localStorage` and `sessionStorage`

Tested on Chrome, Edge, and Firefox. The QR scanner requires camera permission and works best on desktop Chrome or mobile Safari/Chrome.

---

## License

This project was built for **New Era University** internal library use.
