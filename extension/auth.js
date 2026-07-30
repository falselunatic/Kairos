import { CONFIG } from "./config.js";

const AUTH_URL = `${CONFIG.SUPABASE_URL}/auth/v1`;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function signUp(email, password) {
  const res = await fetch(`${AUTH_URL}/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Sign up failed");
  return data;
}

export async function verifyOtp(email, token) {
  const res = await fetch(`${AUTH_URL}/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "signup", email, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Verification failed");
  await saveSession(data);
  return data;
}

export async function signInWithPassword(email, password) {
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Login failed");
  await saveSession(data);
  return data;
}

export async function refreshSession(refresh_token) {
  const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Session refresh failed");
  await saveSession(data);
  return data;
}

async function saveSession(data) {
  await chrome.storage.local.set({
    session: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      email: data.user?.email,
    },
  });
}

export async function clearSession() {
  await chrome.storage.local.remove(["session", "pendingBattle"]);
}

// Returns a valid access token, refreshing it first if it's expired or close to it.
export async function getValidAccessToken() {
  const { session } = await chrome.storage.local.get("session");
  if (!session) return null;

  const isExpiringSoon = Date.now() > session.expires_at - 60_000;
  if (!isExpiringSoon) return session.access_token;

  try {
    const refreshed = await refreshSession(session.refresh_token);
    return refreshed.access_token;
  } catch {
    await clearSession();
    return null;
  }
}
