// Shared data layer and rendering for the voting page, presenter board and slide embed.
import { FIREBASE_CONFIG, ADMIN_EMAIL, DEFAULT_SESSION } from "./config.js";
import { SESSIONS } from "./polls.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

export const params = new URLSearchParams(location.search);
export const SID = (params.get("s") || DEFAULT_SESSION).toLowerCase().replace(/[^a-z0-9-]/g, "");
export const DEMO = params.has("demo") || !FIREBASE_CONFIG.apiKey;
export const SET = SESSIONS[SID.split("-")[0]] || Object.values(SESSIONS)[0];
export const POLLS = SET.polls;
export const pollById = id => POLLS.find(p => p.id === id) || null;
export const letter = i => String.fromCharCode(65 + i);

// Session accent (only Session 7 for now; matches SESSION_ACCENTS in btp_template.js)
const ACCENTS = { 7: ["#7B6FA6", "#595078", "#A9A1C5"], 8: ["#6B8FAD", "#4D677C", "#A1BACE"] };
const acc = ACCENTS[SET.session];
if (acc) {
  const s = document.documentElement.style;
  s.setProperty("--accent", acc[0]); s.setProperty("--accent-dark", acc[1]); s.setProperty("--accent-light", acc[2]);
}

export const joinUrl = () => {
  const u = new URL("./", location.href);
  if (SID !== DEFAULT_SESSION) u.searchParams.set("s", SID);
  if (DEMO && params.has("demo")) u.searchParams.set("demo", "");
  return u.href.replace(/=$/, "").replace(/=&/g, "&");
};

// ------------------------------------------------------------------
// Backend: Firebase Realtime Database, or an in-browser demo store.
// Paths: live/<sid>/control {poll, open, show, compare, t}
//        live/<sid>/votes/<pollId>/<uid> {c: "0" or "0,2", t}
// ------------------------------------------------------------------
export async function connect({ anonymous = false } = {}) {
  return DEMO ? demoBackend() : firebaseBackend(anonymous);
}

async function firebaseBackend(anonymous) {
  const [{ initializeApp }, A, D] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-database.js"),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app), db = D.getDatabase(app);
  const base = `live/${SID}`;
  let user = null;
  const userCbs = new Set();
  const ready = new Promise(res => A.onAuthStateChanged(auth, u => { user = u; userCbs.forEach(f => f(u)); res(); }));
  await ready;
  if (anonymous && !user) await A.signInAnonymously(auth);
  return {
    demo: false,
    onUser(f) { userCbs.add(f); f(user); },
    user: () => auth.currentUser || user,
    isAdmin: () => !!user && !user.isAnonymous && (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    onConnected: f => D.onValue(D.ref(db, ".info/connected"), s => f(!!s.val())),
    onControl: f => D.onValue(D.ref(db, base + "/control"), s => f(s.val() || {})),
    onVotes: (pid, f) => D.onValue(D.ref(db, `${base}/votes/${pid}`), s => f(s.val() || {})),
    // Use the live auth state, not a cached one, and sign in again if the phone has lost its ID.
    async vote(pid, choices) {
      if (!auth.currentUser) await A.signInAnonymously(auth);
      return D.set(D.ref(db, `${base}/votes/${pid}/${auth.currentUser.uid}`), { c: choices.join(","), t: D.serverTimestamp() });
    },
    setControl: patch => D.update(D.ref(db, base + "/control"), { ...patch, t: D.serverTimestamp() }),
    resetVotes: pid => D.remove(D.ref(db, `${base}/votes/${pid}`)),
    signIn: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    signOut: () => A.signOut(auth),
  };
}

function demoBackend() {
  const KEY = "btp-demo-" + SID;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { control: {}, votes: {} }; } catch { return { control: {}, votes: {} }; } };
  const subs = new Set();
  const emit = () => { const s = read(); subs.forEach(f => f(s)); };
  const write = mut => { const s = read(); mut(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} emit(); };
  addEventListener("storage", e => { if (e.key === KEY) emit(); });
  let uid = sessionStorage.getItem("btp-demo-uid");
  if (!uid) { uid = "demo-" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("btp-demo-uid", uid); }
  const user = { uid, isAnonymous: false, email: "demo" };
  // ?fill=40 seeds random votes so the board can be previewed without phones
  const fill = parseInt(params.get("fill") || "0", 10);
  if (fill) write(s => {
    for (const p of POLLS) {
      s.votes[p.id] = {};
      for (let i = 0; i < fill; i++) {
        const w = p.options.map((_, k) => Math.random() * (p.compareWith ? (k === 0 ? 3 : 1) : (k < 2 ? 2.5 : 1)));
        const pick = w.indexOf(Math.max(...w));
        s.votes[p.id]["seed" + i] = { c: p.multi ? [pick, (pick + 2) % p.options.length].join(",") : String(pick), t: Date.now() };
      }
    }
  });
  return {
    demo: true,
    onUser(f) { f(user); },
    user: () => user,
    isAdmin: () => true,
    onConnected: f => f(true),
    onControl(f) { const g = s => f(s.control || {}); subs.add(g); g(read()); return () => subs.delete(g); },
    onVotes(pid, f) { const g = s => f((s.votes || {})[pid] || {}); subs.add(g); g(read()); return () => subs.delete(g); },
    vote: (pid, choices) => write(s => { (s.votes[pid] ||= {})[uid] = { c: choices.join(","), t: Date.now() }; }),
    setControl: patch => write(s => { Object.assign(s.control, patch, { t: Date.now() }); }),
    resetVotes: pid => write(s => { delete s.votes[pid]; }),
    signIn: async () => {}, signOut: async () => {},
  };
}

// ------------------------------------------------------------------
// Rendering helpers
// ------------------------------------------------------------------
export function tally(votes, nOptions) {
  const counts = new Array(nOptions).fill(0);
  let n = 0;
  for (const v of Object.values(votes || {})) {
    const picks = String(v.c ?? "").split(",").filter(x => x !== "").map(Number).filter(i => i >= 0 && i < nOptions);
    if (!picks.length) continue;
    n++;
    new Set(picks).forEach(i => counts[i]++);
  }
  const pct = counts.map(c => (n ? Math.round((100 * c) / n) : 0));
  return { counts, n, pct };
}

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function patientCard(p, { collapsible = false, open = true } = {}) {
  if (!p.patient) return "";
  const lines = p.patient.lines.map(l => (l === "" ? '<div class="gap"></div>' : `<p>${esc(l)}</p>`)).join("");
  const head = `<span class="patient__name">${esc(p.patient.name)}</span>
      ${p.patient.when ? `<span class="patient__when">${esc(p.patient.when)}</span>` : ""}`;
  const body = `<div class="patient__body">${lines}${p.patient.tag ? `<span class="patient__tag">${esc(p.patient.tag)}</span>` : ""}</div>`;
  return collapsible
    ? `<details class="patient case" ${open ? "open" : ""}><summary class="patient__head">${head}</summary>${body}</details>`
    : `<section class="patient"><div class="patient__head">${head}</div>${body}</section>`;
}

// Build the bar rows once, then update widths so the bars animate.
export function barsMarkup(p, { compare = false, short = false } = {}) {
  const lines = `${compare ? `<div class="bar-line"><div class="bar-track"><div class="bar-fill prev"></div></div><span class="bar-pct prev"></span></div>` : ""}
        <div class="bar-line"><div class="bar-track"><div class="bar-fill now"></div></div><span class="bar-pct now"></span></div>`;
  return `<div class="bars${compare && !short ? " compare" : ""}">${p.options.map((o, i) => `
    <div class="bar-row" data-i="${i}">
      <span class="badge">${letter(i)}</span>
      <div class="bar-row__main">
        ${short ? "" : `<div class="bar-row__label">${esc(o)}</div>`}
        ${compare && !short ? `<div>${lines}</div>` : lines}
      </div>
    </div>`).join("")}</div>`;
}

export function updateBars(root, now, prev, { hidden = false } = {}) {
  const bars = root.querySelector(".bars");
  if (!bars) return;
  bars.classList.toggle("is-hidden", hidden);
  const top = now.n ? Math.max(...now.pct) : -1;
  bars.querySelectorAll(".bar-row").forEach(row => {
    const i = +row.dataset.i;
    row.querySelector(".bar-fill.now").style.width = now.pct[i] + "%";
    row.querySelector(".bar-pct.now").textContent = now.n ? now.pct[i] + "%" : "";
    row.classList.toggle("is-top", !hidden && now.n > 0 && now.pct[i] === top);
    const pf = row.querySelector(".bar-fill.prev");
    if (pf && prev) {
      pf.style.width = prev.pct[i] + "%";
      row.querySelector(".bar-pct.prev").textContent = prev.n ? prev.pct[i] + "%" : "";
    }
  });
}

export function qrSvg(text, px = 220) {
  // eslint-disable-next-line no-undef
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const cells = qr.getModuleCount();
  const cell = Math.max(2, Math.floor(px / (cells + 2)));
  return qr.createSvgTag({ cellSize: cell, margin: cell, scalable: true });
}

export function offlineBanner(api) {
  const el = document.createElement("div");
  el.className = "offline hidden";
  el.textContent = "Reconnecting...";
  document.body.appendChild(el);
  let timer = null;
  api.onConnected(ok => {
    clearTimeout(timer);
    if (ok) el.classList.add("hidden");
    else timer = setTimeout(() => el.classList.remove("hidden"), 2500);
  });
}
