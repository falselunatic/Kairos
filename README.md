# Kairos

[github.com/falselunatic/Kairos](https://github.com/falselunatic/Kairos)

A companion agent that remembers you over time - chat with it, battle it in a roast
battle, ask it coding questions, or have it answer questions about documents you
upload. Everything feeds one shared memory, so it gets to know you across all of it.

Open-source stack:

- **Backend**: FastAPI (Python)
- **Frontend**: Next.js (App Router)
- **Extension**: Chrome, Manifest V3, plain JS (no build step)
- **Database/Auth**: Supabase (Postgres + pgvector + Auth)
- **LLM**: Groq API (open-weight Llama models)
- **Embeddings**: local, via `fastembed` (ONNX)

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Frontend    │◄────►│  Backend          │◄────►│  Supabase         │
│  Next.js     │ HTTP │  FastAPI          │      │  Postgres+pgvector│
│  :3000       │      │  :8000            │      │  + Auth           │
└─────────────┘      └──────────┬────────┘      └──────────────────┘
       ▲                        │
       │                        ▼
┌─────────────┐          ┌──────────────┐
│  Extension   │◄────────►│  Groq API    │
│  (Chrome)    │  HTTP    │  (LLM calls)  │
└─────────────┘          └──────────────┘
```

The extension and frontend both talk directly to the FastAPI backend; the backend
is the only thing that talks to Supabase and Groq.

## Features

Main navigation (left sidebar): Chat, Code, Docs Q&A, Notes. Utility row
(above the theme toggle): Memories, Roast Battle, About.

| Page | What it does |
|---|---|
| `/` (Chat) | Talks to Kairos, which remembers facts about you across sessions |
| `/code` | Kairos Code - a coding-assistant chat mode, same Groq model, its own persistent chat history |
| `/docs` | Upload one or many `.txt`/`.md`/`.pdf`/`.docx` files, then ask questions about them (RAG). Prefers your docs but falls back to general knowledge when they don't cover it (and says so), supports follow-up questions ("and for X"), knows about every doc you've uploaded even if a given question doesn't match any of it, and keeps your question history across visits |
| `/notes` | Create/edit/delete notes yourself. Kairos also saves its own notes automatically from chat/Code conversations when something's worth remembering (a decision, a plan, a calculation) - no button to press. Lines that are plain arithmetic (e.g. `12 * 3 + 4`) show their computed result automatically |
| `/memories` | View/delete individual memories, or forget everything |
| `/roast` | Best-of-5 roast battle - Kairos throws jabs using what it knows about you, with a "Reset battle" option |
| `/about` | Explains the whole architecture, tech stack, and database tables in detail, with a visual architecture diagram and an embedded chat to ask Kairos questions about itself |
| Chrome extension | Proactively pings you and starts a roast battle based on your current tab; also links out to all the pages above |

All destructive actions (clear chat, forget all memories, reset battle) confirm via an
in-app dialog, never a native browser popup.

Theme toggle has two options: **Bubblegum** (light/pink) and **Shadow** (dark),
each with its own floating mascot (a cloud pup / a sleepy bat).

## Screenshots

<!--
Add screenshot files to the screenshots/ folder, then uncomment and fill in the
rows below (see screenshots/README.md for naming suggestions). Example:

![Chat](screenshots/chat.png)
![Kairos Code](screenshots/code.png)
![Docs Q&A](screenshots/docs.png)
![Notes](screenshots/notes.png)
![Memories](screenshots/memories.png)
![Roast Battle](screenshots/roast.png)
![About](screenshots/about.png)
![Chrome extension](screenshots/extension.png)
-->

---

## Getting Started

You'll need: [Git](https://git-scm.com/downloads), Python 3.11+, Node.js 18+, and
accounts on [Supabase](https://supabase.com), [Groq](https://console.groq.com), and
(optionally) Google Cloud for Google sign-in.

### 0. Clone the repo

```bash
git clone https://github.com/falselunatic/Kairos.git
cd Kairos
```

Everything below assumes your terminal is in this `Kairos/` folder unless it says
otherwise (`cd backend` / `cd frontend`).

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run each of these files, **in order**, pasting the
   contents and clicking Run (choose "Run without RLS" if prompted - the backend
   uses a privileged key that bypasses RLS anyway):
   - `backend/schema.sql`
   - `backend/schema_v2_auth.sql`
   - `backend/schema_v3_roast.sql`
   - `backend/schema_v4_docs.sql`
   - `backend/schema_v5_channels.sql`
   - `backend/schema_v6_perf.sql`
   - `backend/schema_v7_notes.sql`
3. Get your credentials:
   - **Project URL** and **Publishable key**: Settings → API Keys.
   - **Secret key** (`sb_secret_...`, formerly "service_role"): same page, click the
     eye icon to reveal it. This is privileged - never expose it to a browser/extension.
4. **Email verification (OTP codes instead of a confirmation link)**: Supabase's
   default email sender doesn't allow editing templates. To get a 6-digit code
   instead of a link:
   - Set up custom SMTP (e.g. your own Gmail): generate a
     [Gmail app password](https://myaccount.google.com/apppasswords) (requires
     2-Step Verification enabled), then in Supabase go to **Project Settings →
     Authentication → SMTP Settings**, enable custom SMTP, host `smtp.gmail.com`,
     port `587`, your Gmail address as both sender and username, the app password
     as the password.
   - Then go to **Authentication → Email Templates → Confirm signup**, click
     **Source**, and replace the body with something like:
     ```html
     <h2>Confirm your email</h2>
     <p>Your verification code is: <strong>{{ .Token }}</strong></p>
     ```
5. **Google sign-in (optional)**:
   - Create an OAuth Client ID in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     (Web application), with authorized redirect URI:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Supabase → **Authentication → Providers → Google** → paste Client ID + Secret → Save.
   - Supabase → **Authentication → URL Configuration** → Site URL = `http://localhost:3000`.

### 2. Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment (differs by OS/shell):
```bash
# Windows (PowerShell or cmd)
.venv\Scripts\activate

# macOS / Linux / Git Bash on Windows
source .venv/bin/activate   # or: source .venv/Scripts/activate on Git Bash for Windows
```

Then:
```bash
pip install -r requirements.txt
copy .env.example .env        # Windows
cp .env.example .env          # macOS/Linux
```

Fill in `.env`:
```
GROQ_API_KEY=your_groq_key            # from console.groq.com
GROQ_MODEL=llama-3.3-70b-versatile
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your_secret_key   # the sb_secret_... key, NOT publishable
```

Run it:
```bash
uvicorn app.main:app --port 8000
```

Verify: `curl http://localhost:8000/health` should return `{"status":"ok"}`.

> **Note**: don't rely on `--reload` if this repo lives in a cloud-synced folder
> (OneDrive/Dropbox/Google Drive) - file-watching can silently miss changes there.
> After any backend edit, kill the process and restart it cleanly.

### 3. Frontend

Open a **second terminal** (keep the backend running in the first one):

```bash
cd frontend
npm install
copy .env.local.example .env.local   # Windows
cp .env.local.example .env.local     # macOS/Linux
```

Fill in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key   # safe to expose, it's the public one
```

Run it:
```bash
npm run dev
```

Open http://localhost:3000, sign up (email + OTP code, or Google), and start chatting.

### Quick checklist if something doesn't work

- Backend and frontend are **two separate long-running processes** - both need to stay
  running in their own terminal at the same time.
- `curl http://localhost:8000/health` returns `{"status":"ok"}` - if not, the backend
  isn't actually up, check that terminal for an error.
- All 7 `schema*.sql` files were run in Supabase, in order - a missing one causes silent
  404s for that one feature only (e.g. skip `schema_v7_notes.sql` and Notes breaks, but
  everything else works fine).
- `.env` (backend) and `.env.local` (frontend) both exist and are filled in - neither is
  created automatically, you copy from the `.example` file yourself.

### 4. Chrome extension (optional)

1. Open `extension/config.js` and confirm `API_URL`/`FRONTEND_URL`/`SUPABASE_URL`/
   `SUPABASE_PUBLISHABLE_KEY` match your setup (defaults assume both servers running
   locally as above).
2. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   select the `extension/` folder.
3. Click the Kairos icon in your toolbar, sign up/log in.
4. Test it:
   - Click **"Start a roast battle now"** - should get an opening line and let you
     reply through 5 rounds.
   - The **Chat / Memories / Code / Docs** buttons in the popup open the
     corresponding page of the web app in a new tab.
   - The proactive check-in fires automatically every ~45 minutes (configurable via
     `CHECKIN_INTERVAL_MINUTES` in `config.js`) while Chrome is open - it reads your
     current tab's title/URL, asks the backend for a themed roast opener, and shows
     a system notification. Click the notification (or the toolbar icon) to open it.
   - If the toolbar icon doesn't respond: go to `chrome://extensions`, click the
     reload icon (↻) on the Kairos card, then check for a red "Errors" button -
     it'll show the actual JS error if something's broken.
   - `config.js`'s URLs just need to point wherever your backend/frontend are
     actually reachable, `localhost` while developing, or a deployed URL later.

---

## Resetting the database / testing from scratch

To wipe all data and re-verify everything from a clean slate, run this in
Supabase's SQL Editor (keeps the schema, deletes all rows):

```sql
truncate table roast_rounds, roast_battles, doc_chunks, documents, notes, memories, messages
  restart identity cascade;
```

This does **not** delete your Supabase Auth users - to remove test accounts too,
go to **Authentication → Users** and delete them individually (this cascades to
delete their rows in the tables above automatically, via the foreign keys).

### Suggested retest flow after resetting

1. Sign up a fresh account (email + OTP).
2. Chat a few messages that mention a fact about yourself; refresh and confirm the
   message history persists.
3. Check `/memories` - confirm it picked something up, and that "Forget all" clears it.
4. Start a `/roast` battle, play through all 5 rounds, confirm a winner is declared.
5. Ask `/code` a coding question, navigate away to `/` and back - confirm the code
   chat history is still there.
6. Upload a `.txt` and a `.pdf` (try selecting multiple files at once) on `/docs`,
   ask a question that's only answerable from the doc content, confirm it answers
   correctly (and offers a Google search link when it's uncertain).
7. On `/notes`, create a note by hand and edit it. Then chat about a plan or decision
   in `/` or `/code` and check back on `/notes` a few seconds later - Kairos should
   have saved one on its own. Write a line like `12 * 3 + 4` in a note and confirm
   the computed result shows underneath.
8. Visit `/about` and ask its embedded chat something about Kairos's own
   architecture or database.
9. Sign up a **second** account and confirm it sees none of the first account's
   memories/messages/battles/docs/notes - this is the check that actually matters
   for per-user data isolation.

## Project structure

```
backend/     FastAPI app - see backend/app/ for modules, schema*.sql for DB migrations
frontend/    Next.js app - see frontend/app/ for pages, frontend/components/ for shared UI
extension/   Chrome extension - see extension/README.md for extension-specific detail
```
