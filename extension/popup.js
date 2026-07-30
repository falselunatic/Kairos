import { CONFIG } from "./config.js";
import {
  signUp,
  verifyOtp,
  signInWithPassword,
  clearSession,
  getValidAccessToken,
} from "./auth.js";

const $ = (id) => document.getElementById(id);

let pendingSignupEmail = "";

async function init() {
  const token = await getValidAccessToken();
  if (token) {
    showBattleView();
  } else {
    showAuthView();
  }
}

function showAuthView() {
  $("authView").hidden = false;
  $("battleView").hidden = true;
  $("logoutBtn").hidden = true;
}

async function showBattleView() {
  $("authView").hidden = true;
  $("battleView").hidden = false;
  $("logoutBtn").hidden = false;

  const { pendingBattle } = await chrome.storage.local.get("pendingBattle");
  if (pendingBattle && !pendingBattle.finished) {
    $("idleState").hidden = true;
    $("activeState").hidden = false;
    renderBattle(pendingBattle);
  } else {
    $("idleState").hidden = false;
    $("activeState").hidden = true;
  }
}

function renderBattle(battle) {
  $("kairosScore").textContent = battle.kairosTotal;
  $("userScore").textContent = battle.userTotal;

  const log = $("log");
  log.innerHTML = "";
  for (const r of battle.rounds) {
    const kRow = document.createElement("div");
    kRow.className = "bubbleRow kairos";
    kRow.innerHTML = `<div class="bubble kairos">${escapeHtml(r.kairosLine)}</div>`;
    log.appendChild(kRow);

    if (r.kairosScore !== undefined) {
      const tag = document.createElement("div");
      tag.className = "scoreTag";
      tag.textContent = `wit score: ${r.kairosScore}/10`;
      log.appendChild(tag);
    }

    if (r.userLine) {
      const uRow = document.createElement("div");
      uRow.className = "bubbleRow user";
      uRow.innerHTML = `<div class="bubble user">${escapeHtml(r.userLine)}</div>`;
      log.appendChild(uRow);

      const uTag = document.createElement("div");
      uTag.className = "scoreTag";
      uTag.style.textAlign = "right";
      uTag.textContent = `wit score: ${r.userScore}/10`;
      log.appendChild(uTag);
    }
  }
  log.scrollTop = log.scrollHeight;

  const winnerBanner = $("winnerBanner");
  if (battle.finished) {
    $("replyForm").hidden = true;
    winnerBanner.hidden = false;
    winnerBanner.textContent =
      battle.winner === "user"
        ? "You won this battle!"
        : battle.winner === "kairos"
          ? "Kairos won this one."
          : "It's a tie!";
  } else {
    $("replyForm").hidden = false;
    winnerBanner.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Auth view wiring ----

$("loginTab").addEventListener("click", () => {
  $("loginTab").classList.add("active");
  $("signupTab").classList.remove("active");
  $("loginForm").hidden = false;
  $("signupForm").hidden = true;
  $("otpForm").hidden = true;
});

$("signupTab").addEventListener("click", () => {
  $("signupTab").classList.add("active");
  $("loginTab").classList.remove("active");
  $("signupForm").hidden = false;
  $("loginForm").hidden = true;
  $("otpForm").hidden = true;
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").textContent = "";
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!email || !EMAIL_RE.test(email)) {
    $("loginError").textContent = "Enter a valid email address.";
    return;
  }
  if (!password) {
    $("loginError").textContent = "Enter your password.";
    return;
  }

  try {
    await signInWithPassword(email, password);
    showBattleView();
  } catch (err) {
    $("loginError").textContent = err.message;
  }
});

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("signupError").textContent = "";
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  if (!email || !EMAIL_RE.test(email)) {
    $("signupError").textContent = "Enter a valid email address.";
    return;
  }
  if (!password || password.length < 6) {
    $("signupError").textContent = "Password needs to be at least 6 characters.";
    return;
  }

  try {
    await signUp(email, password);
    pendingSignupEmail = email;
    $("otpHint").textContent = `Enter the code we emailed to ${email}.`;
    $("signupForm").hidden = true;
    $("otpForm").hidden = false;
  } catch (err) {
    $("signupError").textContent = err.message;
  }
});

$("otpForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("otpError").textContent = "";
  const code = $("otpCode").value.trim();

  if (!code) {
    $("otpError").textContent = "Enter the verification code.";
    return;
  }

  try {
    await verifyOtp(pendingSignupEmail, code);
    showBattleView();
  } catch (err) {
    $("otpError").textContent = err.message;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await clearSession();
  showAuthView();
});

// ---- Quick nav (opens the full web app for the richer views) ----

document.querySelectorAll(".navLinkBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    chrome.tabs.create({ url: `${CONFIG.FRONTEND_URL}${btn.dataset.path}` });
  });
});

// ---- Battle view wiring ----

$("startBattleBtn").addEventListener("click", async () => {
  const token = await getValidAccessToken();
  if (!token) return showAuthView();

  const res = await fetch(`${CONFIG.API_URL}/roast/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  const battle = {
    battleId: data.battle_id,
    finished: false,
    userTotal: 0,
    kairosTotal: 0,
    rounds: [{ round: data.round, kairosLine: data.kairos_line }],
  };
  await chrome.storage.local.set({ pendingBattle: battle });
  $("idleState").hidden = true;
  $("activeState").hidden = false;
  renderBattle(battle);
});

$("replyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("replyInput").value.trim();
  if (!text) return;
  $("replyInput").value = "";

  const token = await getValidAccessToken();
  if (!token) return showAuthView();

  const { pendingBattle } = await chrome.storage.local.get("pendingBattle");
  if (!pendingBattle) return;

  const res = await fetch(`${CONFIG.API_URL}/roast/${pendingBattle.battleId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: text }),
  });
  const data = await res.json();

  const rounds = [...pendingBattle.rounds];
  const last = rounds[rounds.length - 1];
  rounds[rounds.length - 1] = {
    ...last,
    userLine: data.user_line,
    kairosScore: data.kairos_score,
    userScore: data.user_score,
  };
  if (!data.finished && data.next_kairos_line) {
    rounds.push({ round: data.round + 1, kairosLine: data.next_kairos_line });
  }

  const updated = {
    ...pendingBattle,
    rounds,
    userTotal: data.user_total,
    kairosTotal: data.kairos_total,
    finished: data.finished,
    winner: data.winner,
  };
  await chrome.storage.local.set({ pendingBattle: updated });
  renderBattle(updated);
});

init();
