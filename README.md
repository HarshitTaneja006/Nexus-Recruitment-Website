# NEXUS Recruitments '26 ⚡

> **Terminal-Themed Recruitment & Evaluation Portal for NEXUS — VIT Chennai's premier builder club.**

A high-performance, developer-first recruitment platform featuring real-time autosave drafts, strict institutional authentication, interactive interview scheduling with conflict detection, admin evaluation dashboards, live drive analytics, and an integrated SMTP notification outbox.

---

## 🚀 Key Features

### 🖥️ 1. Terminal & Hacker Aesthetic Experience
- **Retro-Modern Terminal UI**: Monospace layout, CRT scanline textures, ASCII art banners, animated glyph rain, and terminal boot sequences.
- **Command Palette & Shortcuts**: Instant navigation via keyboard shortcuts (`Ctrl/Cmd + K`), quick actions, and filter toggles.
- **Responsive Layout**: Optimized for desktop command centers as well as mobile applicant submissions.

### 🛡️ 2. Institutional Authentication & Profile Derivation
- **Strict VIT Email Validation**: Enforces `@vitstudent.ac.in` email domains.
- **Automatic Metadata Extraction**: Automatically parses registration numbers, branch codes, batch year, and derives year-of-study from the student email.
- **Dual Auth Engine**: Production-ready **Google OAuth** with automatic institutional domain locking (`hd: vitstudent.ac.in`), paired with a built-in **Sandbox Authentication Mode** for rapid offline testing.

### 📝 3. Applicant Journey & Interactive Forms
- **Domain Selection**: Support for multiple specialized tracks (**AIML**, **Web Development**, **Design & Social**, **Finance & Management**).
- **Domain-Specific & Common Questionnaires**: Tailored technical questions with client & server-side Zod validation.
- **Real-Time Draft Autosave**: Persistent local client storage with optional server-side sync and visual autosave telemetry.
- **Application Status & Interview Countdown**: Live applicant tracking dashboard with interview schedule countdown, meeting links, panel notes, and `.ics` calendar file export.

### 📊 4. Admin Review Console (`/review`)
- **Allowlisted Access Control**: Strict access restriction via `ADMIN_EMAILS` allowlist.
- **Pipeline State Machine**: Manage applicants across 7 statuses (`SUBMITTED`, `SHORTLISTED`, `INTERVIEW`, `ACCEPTED`, `REJECTED`, `WAITLISTED`, `NEEDS_INFO`).
- **Interview Scheduler with Conflict Detection**: Detects overlapping interview slots across panels (±45 min window warning).
- **Secure CSV Export**: Download filtered applicant datasets with built-in defense against **CSV Formula Injection** (`=`, `+`, `-`, `@` sanitization).

### 📈 5. Public Funnel & Drive Statistics (`/stats`)
- **Live Funnel Analytics**: Track real-time submission counts, department breakdowns, and applicant year distributions.
- **Trailing Velocity Sparklines**: IST calendar day-bucketed submission trends.
- **Admin Lock Toggle**: Public stats page is sealed by default; admins can securely unlock/lock live stats via `STATS_LOCK_SECRET`.

### 📬 6. Notification Outbox & SMTP Relay
- **Nodemailer SMTP Integration**: Automated delivery for submission receipts, status updates, interview calls, and custom admin announcements.
- **Branded Terminal HTML Emails**: High-contrast, dark-mode email templates.
- **Draft Reminder Engine**: One-click reminder sweep to notify students with saved drafts before deadlines.
- **Sandbox Fallback**: Simulates deliveries during testing when SMTP credentials are not configured.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Components, Route Handlers) |
| **Frontend** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/) |
| **Animation & Icons** | [Framer Motion](https://www.framer.com/motion/), [Lucide Icons](https://lucide.dev/) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) with Local Storage persistence |
| **Database & ORM** | [Prisma ORM](https://www.prisma.io/) with [SQLite](https://www.sqlite.org/) (Default) / [Supabase Postgres](https://supabase.com/) |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) (Google OAuth + Credentials Sandbox) |
| **Email Delivery** | [Nodemailer](https://nodemailer.com/) (SMTP Relay) |
| **Schema Validation** | [Zod](https://zod.dev/) (Client & API route validation) |
| **Runtime / Package Manager** | [Bun](https://bun.sh/) / Node.js (v20+) |

---

## 📁 Repository Structure

```
Nexus-Recruit/
├── prisma/
│   └── schema.prisma              # Prisma schema definition (User, Application, Draft, Notification, Setting)
├── public/
│   ├── logo.svg                   # NEXUS vector brand mark
│   ├── og.png                     # Open Graph recruitment banner
│   └── robots.txt                 # Search indexing policy
├── scripts/
│   └── seed-demo.cjs              # Realistic demo applicant & audit trail seeder
├── src/
│   ├── app/
│   │   ├── api/                   # REST API routes (applications, auth, admin, notifications, stats)
│   │   ├── apply/                 # Student application form & submission flow
│   │   ├── review/                # Admin evaluation & interview console
│   │   ├── stats/                 # Public / locked drive analytics
│   │   ├── globals.css            # Terminal theme, scanlines & typography
│   │   ├── layout.tsx             # Root layout with providers & global toasts
│   │   └── page.tsx               # Terminal landing page & domain cards
│   ├── components/
│   │   ├── nexus/                 # Domain-specific components (terminal, forms, admin, stats, modals)
│   │   └── ui/                    # shadcn/ui accessible component library
│   ├── hooks/                     # Custom React hooks (useToast, useMobile)
│   ├── lib/                       # Core utilities (admin auth, mailer, storage, vit parser, validation)
│   └── store/                     # Zustand stores for application form state
├── supabase/
│   └── schema.sql                 # Optional Supabase Postgres mirror schema
├── .env.example                   # Complete runtime environment variable template
├── .gitignore                     # Production-grade ignore rules
├── components.json                # shadcn/ui configuration
├── next.config.ts                 # Next.js configuration
├── package.json                   # Dependencies and scripts
├── tailwind.config.ts             # Tailwind design tokens
└── tsconfig.json                  # TypeScript compiler settings
```

---

## ⚡ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+) or [Bun](https://bun.sh/) (v1.1+)
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/HarshitTaneja006/Nexus-Recruit.git
cd Nexus-Recruit
```

### 2. Install Dependencies
```bash
# Using Bun (Recommended)
bun install

# Or using npm / pnpm
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in the essential variables:
```env
# Database (SQLite by default)
DATABASE_URL="file:./db/custom.db"

# NextAuth Configuration
NEXTAUTH_SECRET="replace-with-openssl-rand-hex-32"
NEXTAUTH_URL="http://localhost:3000"

# Admin Review Access (Comma-separated VIT student emails)
ADMIN_EMAILS="core.nexus2023@vitstudent.ac.in,your.email2024@vitstudent.ac.in"

# Public Stats Console Unlock Password
STATS_LOCK_SECRET="nexus-unlock-2026"

# Optional: Google OAuth (Required for production sign-in)
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""

# Optional: SMTP Email Relay (Required for live emails)
# SMTP_HOST="smtp.gmail.com"
# SMTP_PORT=587
# SMTP_USER=""
# SMTP_PASS=""
# MAIL_FROM="NEXUS Recruitments <recruitment@nexusvit.in>"
```

### 4. Initialize Database & Seed Demo Data
```bash
# Push schema to SQLite
bun run db:push

# Seed realistic applicant test data
bun scripts/seed-demo.cjs
```

### 5. Run Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Best Practices

- **CSV Formula Injection Shield**: All exported CSV rows are sanitized to neutralize formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`), preventing arbitrary code execution when opened in spreadsheet software.
- **Timing-Safe Unlock Verification**: Admin statistics unlock secrets use constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
- **Access Boundary Enforcement**: All `/api/admin/*` routes strictly verify session emails against the `ADMIN_EMAILS` environment variable.
- **Safe Secrets Handling**: No database files, credentials, or private keys are tracked in version control.

---

## 📜 Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `bun run dev` | Starts the Next.js development server at `localhost:3000` |
| `build` | `bun run build` | Builds the production-optimized Next.js bundle |
| `start` | `bun run start` | Runs the production server |
| `lint` | `bun run lint` | Runs ESLint check across all source files |
| `db:push` | `bun run db:push` | Pushes Prisma schema changes directly to the database |
| `db:generate` | `bun run db:generate` | Regenerates Prisma Client TypeScript types |

---

## 👤 Author

**Harshit Taneja**
- GitHub: [@HarshitTaneja006](https://github.com/HarshitTaneja006)
- Email: [harshittaneja006@gmail.com](mailto:harshittaneja006@gmail.com)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
