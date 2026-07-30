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

## Setup

See **[SETUP.md](SETUP.md)** for the full walkthrough: cloning, Supabase/Groq/Google
setup, running the backend and frontend, the Chrome extension, resetting the
database, and a suggested end-to-end retest flow.

## Project structure

```
backend/     FastAPI app - see backend/app/ for modules, schema*.sql for DB migrations
frontend/    Next.js app - see frontend/app/ for pages, frontend/components/ for shared UI
extension/   Chrome extension - see extension/README.md for extension-specific detail
SETUP.md     Full setup, DB reset, and retest instructions
```
