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

### Sign up / log in

| | |
|---|---|
| ![Login](screenshots/login.png) | ![Sign up](screenshots/signup1.png) |
| ![OTP verification](screenshots/signup2.png) | ![Login, Shadow theme](screenshots/darkmode5.png) |

### Chat

Kairos recalling facts about you and adding them naturally into the conversation:

![Chat, empty state](screenshots/chat1.png)
![Chat, remembering a fact](screenshots/chat2.png)
![Chat, using what it remembers](screenshots/chat3.png)
![Chat, Shadow theme](screenshots/darkmode1.png)

### Kairos Code

![Kairos Code, giving a step-by-step guide](screenshots/code1.png)
![Kairos Code, example with a code block](screenshots/code2.png)
![Kairos Code, Shadow theme](screenshots/darkmode2.png)

### Docs Q&A

Upload documents, then ask questions that get answered from their content:

![Docs Q&A, uploaded documents](screenshots/docs.png)
![Docs Q&A, uploading](screenshots/docs1.png)
![Docs Q&A, answer sourced from an uploaded doc](screenshots/docs2.png)
![Docs Q&A, Shadow theme](screenshots/darkmode3.png)

### Notes

Manual notes, arithmetic auto-calculation, and Kairos writing its own notes and asking before deleting one:

![Notes, list](screenshots/notes.png)
![Notes, arithmetic line computed automatically](screenshots/notes1.png)
![Notes, editing](screenshots/notes2.png)
![Notes, edit form](screenshots/edit_notes.png)
![Notes, an auto-generated note from conversation](screenshots/auto_generated_note.png)
![Notes, confirming a delete](screenshots/delete_note.png)
![Notes, Shadow theme](screenshots/darkmode4.png)

### Memories

Everything Kairos has picked up about you, with per-item and forget-all controls:

![Memories, list](screenshots/memories1.png)
![Memories, more examples](screenshots/memories2.png)
![Memories, confirming forget-all](screenshots/memories3.png)

### Roast Battle

![Roast Battle, round 1](screenshots/roast1.png)
![Roast Battle, confirming abandon](screenshots/roast_giveup.png)

### About

Full architecture, database schema, and data-flow diagrams, plus a chat to ask Kairos about itself:

![About, stack overview + DB schema diagram](screenshots/about1.png)
![About, architecture diagram](screenshots/about2.png)
![About, document embedding/search flow](screenshots/about3.png)
![About, data flow steps](screenshots/about4.png)
![About, ask Kairos about itself](screenshots/about5.png)

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
