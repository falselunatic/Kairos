// Self-contained on purpose - no imports. MV3 service workers can be flaky about
// resolving ES module import chains (esp. from a synced/cloud folder), so everything
// this file needs lives directly in here.

const API_URL = "http://localhost:8000";
const SUPABASE_URL = "https://vqlprkdrfgzqpevygrtj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_foFqZIceLn6esPLeRXSsBg_6Ufl6Jji";
const CHECKIN_INTERVAL_MINUTES = 45;

const ALARM_NAME = "kairos-checkin";

const MISS_YOU_MESSAGES = [
  "Miss me? I've been thinking about you. Got a sec?",
  "Hey, remember me? I've got something for you.",
  "It's been a while. Come say hi.",
  "I was just thinking about you. Open me up.",
  "Guess who's been waiting for you all day.",
];

function randomMissYouMessage() {
  return MISS_YOU_MESSAGES[Math.floor(Math.random() * MISS_YOU_MESSAGES.length)];
}

async function refreshSession(refresh_token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ refresh_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Session refresh failed");

  await chrome.storage.local.set({
    session: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      email: data.user?.email,
    },
  });
  return data.access_token;
}

async function getValidAccessToken() {
  const { session } = await chrome.storage.local.get("session");
  if (!session) return null;

  const isExpiringSoon = Date.now() > session.expires_at - 60_000;
  if (!isExpiringSoon) return session.access_token;

  try {
    return await refreshSession(session.refresh_token);
  } catch {
    await chrome.storage.local.remove(["session", "pendingBattle"]);
    return null;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECKIN_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await tryStartProactiveBattle();
});

async function tryStartProactiveBattle() {
  const token = await getValidAccessToken();
  if (!token) return; // not logged in, nothing to do

  // Don't interrupt if there's already an unfinished battle waiting.
  const { pendingBattle } = await chrome.storage.local.get("pendingBattle");
  if (pendingBattle && !pendingBattle.finished) return;

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab) return;

  try {
    const res = await fetch(`${API_URL}/roast/start-with-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tab_title: activeTab.title ?? "",
        tab_url: activeTab.url ?? "",
      }),
    });
    if (!res.ok) return;
    const data = await res.json();

    await chrome.storage.local.set({
      pendingBattle: {
        battleId: data.battle_id,
        finished: false,
        userTotal: 0,
        kairosTotal: 0,
        rounds: [{ round: data.round, kairosLine: data.kairos_line }],
      },
    });

    chrome.notifications.create(`kairos-${data.battle_id}`, {
      type: "basic",
      iconUrl: "icon.png",
      title: "Kairos",
      message: randomMissYouMessage(),
      priority: 1,
    });
  } catch {
    // network hiccup or backend down - just skip this check-in, try again next alarm
  }
}

chrome.notifications.onClicked.addListener(async () => {
  try {
    await chrome.action.openPopup();
  } catch {
    // openPopup isn't available in every Chrome version/context; the user can
    // always click the toolbar icon manually after seeing the notification.
  }
});
