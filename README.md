# Prasanna Thapa - AI-Powered Portfolio Platform

A high-performance, full-stack Portfolio Progressive Web App (PWA). This is not just a static site; it is a **dynamic data delivery system** featuring granular access control, an autonomous AI agent for communication, and a robust security layer.

## 🚀 Key Features

### Frontend (React + TypeScript)
- **Monochromatic Aesthetic**: Clean, high-contrast UI using Tailwind CSS.
- **PWA Ready**: Installable on mobile devices with offline capabilities.
- **Internationalization (i18n)**: Built-in support for multiple languages (English, Hindi, Bengali, Tamil, Telugu, Nepali).
- **Framer Motion**: Smooth, layout-aware animations for state transitions.
- **Dynamic Content**: Renders Markdown and utilizes a custom recursive renderer for complex data structures.

### Backend (Node.js + SQLite + Gemini AI)
- **Granular Access Control**: A unique **Recursive Filter Engine** that serves different data subsets based on the user's "Access Level" (Public vs. VIP vs. Admin).
- **Autonomous AI Agent**: Uses **Google Gemini 2.5** to analyze incoming contact requests/job offers and draft context-aware email responses automatically.
- **Resilient Task Queue**: Asynchronous processing for AI and Email tasks with exponential backoff retry logic.
- **Security First**: Implements SQL Injection protection, Honeypot traps for bots, IP-based rate limiting, and JWT authentication.
- **Admin Dashboard**: Server-side rendered dashboard to manage user access levels and view analytics.

---

## 🛠 Architecture & Logic

### 1. The Recursive Access Filter (`utils.js`)
The core of the backend is the `recursiveFilter` function. Data stored in `data.json` is never sent raw to the client.

1.  **Users have levels**: `-1` (Blocked), `0` (Public), `1` (Basic), `5` (VIP).
2.  **Data has levels**: Every object in `data.json` can have an `access` property.
3.  **Filtering**:
    *   If `UserLevel < ObjectAccessLevel`, the object is stripped from the response.
    *   **Arrays**: It intelligently groups items (like emails/phones) and returns only the "best" contact method the user is allowed to see.
    *   **Projects**: Always visible to encourage discovery.

### 2. The AI & Queue System (`queue.js` & `server.js`)
When a user submits the "Contact" or "Request Resume" form:
1.  **Immediate Response**: The UI gets a success message instantly.
2.  **Queueing**: A task is added to an in-memory `TaskQueue`.
3.  **Processing**:
    *   **Gemini AI** analyzes the message context (Job Offer vs. General Hello).
    *   It generates a JSON response containing a subject line, HTML body, and a decision on whether to attach the PDF resume.
    *   **Nodemailer** sends the email.
4.  **Reliability**: If the AI API fails (Rate Limit/500), the queue retries with exponential backoff (2s, 4s, 8s...).

---

## 📦 Project Structure

```bash
├── frontend/             # React Application
│   ├── src/
│   │   ├── components/   # UI Components
│   │   ├── services/     # API Connectors
│   │   ├── types.ts      # TypeScript Interfaces
│   │   └── App.tsx       # Main Logic
│   └── public/           # Static Assets
│
├── backend/
│   ├── data.json         # The Source of Truth (Content)
│   ├── database.js       # SQLite Connection & Schema
│   ├── server.js         # Express App & Routes
│   ├── queue.js          # Async Task Queue
│   ├── security.js       # Honeypots & Blacklists
│   ├── utils.js          # Access Logic & File I/O
│   └── resume.pdf        # Asset for email attachments
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js v18+
- Google Gemini API Key
- SMTP Credentials (Gmail/SendGrid/etc.)

### 1. Environment Variables
Create a `.env` file in the root directory:

```env
# Server Config
PORT=4000
BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173

# Security
JWT_SECRET=complex_secret_here
ADMIN_SECRET=admin_master_key_here
TRAP_SECRET=honeypot_secret_here
ADMIN_PASSWORD=password_for_json_updates

# AI Configuration
GEMINI_API_KEY=your_google_gemini_key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_TO=where_you_want_notifications@gmail.com
```

### 2. Install Dependencies

```bash
# Install root/backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

### 3. Running the App

**Development Mode:**
Open two terminals.

Terminal 1 (Backend):
```bash
npm run server
# or
node server.js
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

**Production Build:**
The server is configured to serve the static frontend build.

```bash
cd frontend
npm run build
cd ..
node server.js
```

---

## 🛡️ Security Features

- **Honeypot Endpoint**: `/api/security/verify?token=...`
    - If a bot scans and triggers this endpoint (which is hidden in emails/code), their email is immediately blacklisted in SQLite, and their access level drops to `-1`.
- **Admin Dashboard**: `/admin/dashboard?token=...`
    - Requires a signed JWT token to access. Allows the owner to manually upgrade users from "Public" to "VIP" to reveal phone numbers/resumes.
- **Data Backup**: Every time `data.json` is updated via API, a backup is automatically created in `backups/` with a timestamp.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/portfolio` | Fetches filtered portfolio data based on UUID header. |
| `POST` | `/api/request` | Submit contact form/resume request. triggers AI agent. |
| `GET` | `/admin/dashboard` | View/Edit user access levels (Requires Token). |
| `POST` | `/api/admin/data` | Update the `data.json` content remotely (CI/CD hook). |
| `GET` | `/api/unsubscribe` | Standard unsubscribe link for emails. |

---

## © License
Private Portfolio - All Rights Reserved.
