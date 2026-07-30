# Kairos Chrome Extension

Proactively checks in on you every ~45 minutes (configurable in `config.js`), using your
current tab's title/URL as roast material, then lets you battle it out in the popup.
Also gives one-click access to the full web app (Chat/Memories/Code/Docs).

No build step - plain JS, loadable straight into Chrome.

## Setup

1. Open `config.js` and confirm the values match your setup:
   - `API_URL` - your backend (default `http://localhost:8000`)
   - `FRONTEND_URL` - your web app (default `http://localhost:3000`)
   - `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` - same values as `frontend/.env.local`

   These just need to point at wherever your backend/frontend are actually reachable
   (localhost while developing, or a deployed URL later) - the extension works the
   same either way.
2. Go to `chrome://extensions`, enable **Developer mode** (top right), click
   **Load unpacked**, and select this `extension` folder.
3. Click the Kairos icon in your toolbar, sign up (same email/OTP flow as the web app),
   and you're in.

No CORS setup needed - the backend already allows any `chrome-extension://` origin
via a wildcard regex, so it works regardless of the extension's generated ID.

## Testing checklist

- **Popup opens**: click the toolbar icon. If nothing happens, go to
  `chrome://extensions`, click reload (↻) on the Kairos card, then check for a red
  **"Errors"** button - it shows the actual JS error if the extension failed to load.
- **Auth**: sign up with a new email, verify the OTP code, confirm the popup switches
  to the battle view. Log out, log back in.
- **Manual roast battle**: click "Start a roast battle now", play a round, confirm
  scores update and the next line appears (or a winner banner after round 5).
- **Quick nav**: click each of the Chat/Memories/Code/Docs buttons - each should open
  the corresponding page of the web app in a new tab.
- **Proactive check-in**: don't wait 45 minutes to test this - temporarily lower
  `CHECKIN_INTERVAL_MINUTES` in `config.js` to `1`, reload the extension, wait a
  minute with a tab open, and a notification should appear. Set it back afterward.
- **Notification click**: click the notification - it should try to open the popup
  directly (`chrome.action.openPopup()`); if your Chrome version doesn't support
  that from a notification click, click the toolbar icon instead - the battle will
  already be waiting there.

## What it needs from the backend

- `POST /roast/start` - same endpoint the web app uses (manual "Start a roast battle now" button).
- `POST /roast/start-with-context` - same as `/roast/start`, but takes `{tab_title, tab_url}`
  in the body and generates the opening roast line referencing what the user is
  currently doing/browsing.
- `POST /roast/{battle_id}/reply` - same endpoint, reused as-is.

## How the proactive check-in works

- `background.js` runs on a Chrome alarm every `CHECKIN_INTERVAL_MINUTES`. It's
  intentionally self-contained with no `import` statements - MV3 service workers
  can fail to resolve ES module import chains with a vague "unknown error fetching
  the script," so all the logic it needs is inlined directly in the file.
- If you're logged in and don't already have an unfinished battle waiting, it reads
  your current active tab's title + URL, asks the backend for a context-aware
  opening roast, stores it, and fires a system notification with a generic "miss
  you" message (not the actual roast line - that's revealed when you open the popup).
- Clicking the notification tries to open the popup directly; if that's not
  supported in your Chrome version, just click the toolbar icon - the battle will
  be waiting there.
