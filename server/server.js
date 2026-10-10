"use strict";
/* 의료정보 검색 플랫폼 백엔드 (무의존성, Node 18+)
 * 1) 관리자 인증: scrypt 해시 + 서버 세션 + HttpOnly 쿠키 + rate-limit
 * 2) 의료진 데이터 CRUD: 서버가 소유 (server/data/db.json), 쓰기 전체 인증 필요
 */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PORT = +(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const DB_FILE = path.join(DATA_DIR, "db.json");
const INIT_PW = process.env.ADMIN_INIT_PASSWORD || "c01045719064";
const SESSION_TTL_MS = (+(process.env.SESSION_TTL_H || 12)) * 3600 * 1000;
const COOKIE_NAME = "mvp_admin_session";
const SECURE_COOKIE = process.env.COOKIE_SECURE === "1";
const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 60000;
const WRITE_MAX = 120;
const WRITE_WINDOW_MS = 60000;
const MIN_PW_LEN = 8;
const SEED = require("./seed.json");

const HOSPITAL_IDS = ["snuh", "sev", "samsung", "asan", "cmc", "ebs"];
const DEPTS = ["내과","심장내과","신경과","신경외과","정형외과","소화기내과","호흡기내과","내분비내과","종양내과","혈액내과","알레르기내과","류마티스내과","가정의학과","마취통증의학과","혈관외과","성형외과","치과","외과","심장외과","산부인과","소아청소년과","피부과","안과","이비인후과","비뇨의학과","정신건강의학과","재활의학과","영상의학과","신장내과"];

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- 인증 저장소 ---------- */
const b64 = (b) => Buffer.from(b).toString("base64");
const unb64 = (s) => Buffer.from(s, "base64");
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });

function loadAuth() {
  try {
    const j = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    if (j && j.salt && j.hash) return j;
  } catch (e) { /* 최초 실행: 아래에서 생성 */ }
  const salt = crypto.randomBytes(16);
  const rec = {
    salt: b64(salt), hash: b64(hashPw(INIT_PW, salt)),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(rec, null, 2), { mode: 0o600 });
  console.log("[auth] 관리자 비밀번호를 초기화했습니다. 로그인 후 즉시 변경하세요.");
  return rec;
}
let AUTH = loadAuth();

function verifyPw(pw) {
  try {
    const a = hashPw(pw, unb64(AUTH.salt));
    const b = unb64(AUTH.hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}
function setPw(pw) {
  const salt = crypto.randomBytes(16);
  AUTH = { salt: b64(salt), hash: b64(hashPw(pw, salt)), createdAt: AUTH.createdAt, updatedAt: new Date().toISOString() };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(AUTH, null, 2), { mode: 0o600 });
}

/* ---------- 세션 ---------- */
const sessions = new Map();
setInterval(() => {
  const n = Date.now();
  for (const [k, v] of sessions) if (v.exp < n) sessions.delete(k);
}, 15 * 60 * 1000).unref();

function clientIp(req) {
  if (TRUST_PROXY) {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf) return cf.split(",")[0].trim();
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "?";
}
function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function sessionCookie(token) {
  let c = `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  if (SECURE_COOKIE) c += "; Secure";
  return c;
}
const clearCookie = `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
function authed(req) {
  const t = parseCookies(req)[COOKIE_NAME];
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return false;
  const s = sessions.get(t);
  if (!s || s.exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}

/* ---------- rate-limit ---------- */
function limiter(max, windowMs) {
  const m = new Map();
  return (key) => {
    const n = Date.now();
    const e = m.get(key) || { n: 0, reset: n + windowMs };
    if (n > e.reset) { e.n = 0; e.reset = n + windowMs; }
    e.n += 1;
    m.set(key, e);
    return e.n > max;
  };
}
const loginLimit = limiter(LOGIN_MAX, LOGIN_WINDOW_MS);
const writeLimit = limiter(WRITE_MAX, WRITE_WINDOW_MS);

/* ---------- 의료진 DB (서버 소유) ---------- */
const SEED_VERSION = "2026-10-10-ebs-merged";
function freshDb() {
  return {
    seedVersion: SEED_VERSION,
    doctors: JSON.parse(JSON.stringify(SEED)),
    logs: [{ t: new Date().toISOString().slice(0, 19).replace("T", " "), msg: `공식 홈페이지 조사 기반 시드 ${SEED.length}명 로드` }],
  };
}
function loadDb() {
  try {
    const j = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (j && Array.isArray(j.doctors) && Array.isArray(j.logs)) {
      if (!j.seedVersion) j.seedVersion = "legacy";
      if (j.seedVersion !== SEED_VERSION) {
        const have = new Set(j.doctors.map((d) => d.id));
        let added = 0;
        for (const s of SEED) {
          if (!have.has(s.id)) { j.doctors.push(JSON.parse(JSON.stringify(s))); added++; }
        }
        j.seedVersion = SEED_VERSION;
        j.logs.unshift({ t: new Date().toISOString().slice(0, 19).replace("T", " "), msg: `시드 동기화: ${added}명 추가 (기존 데이터 유지)` });
        j.logs = j.logs.slice(0, 60);
        saveDb(j);
      }
      return j;
    }
  } catch (e) { /* 최초 실행: 시드로 생성 */ }
  const db = freshDb();
  saveDb(db);
  return db;
}
function saveDb(db) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
let DB = loadDb();
function addLog(msg) {
  DB.logs.unshift({ t: new Date().toISOString().slice(0, 19).replace("T", " "), msg: String(msg).slice(0, 200) });
  DB.logs = DB.logs.slice(0, 60);
}
function newId() {
  let id;
  do {
    id = "s" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  } while (DB.doctors.some((d) => d.id === id));
  return id;
}
const today = () => new Date().toISOString().slice(0, 10);
const str = (v, max) => String(v ?? "").trim().slice(0, max || 2000);

function validateDoctor(d) {
  if (!d || typeof d !== "object") return "잘못된 요청입니다.";
  if (!HOSPITAL_IDS.includes(d.hospital)) return "병원을 확인하세요.";
  if (!d.name || !String(d.name).trim() || String(d.name).trim().length > 100) return "이름을 확인하세요.";
  if (!DEPTS.includes(d.dept)) return "진료과를 확인하세요.";
  if (typeof d.profileUrl !== "string" || (d.profileUrl.trim() !== "" && !/^https?:\/\/.{1,2000}/.test(d.profileUrl.trim()))) return "공식 프로필 URL 형식이 올바르지 않습니다. (엑셀 기반 자료는 비워둘 수 있음)";
  if (d.gradYear !== null && d.gradYear !== undefined && d.gradYear !== "") {
    const g = +d.gradYear;
    if (!Number.isInteger(g) || g < 1950 || g > new Date().getFullYear()) return "졸업 연도 범위를 확인하세요.";
  }
  if (d.status !== undefined && d.status !== "활성" && d.status !== "비활성") return "상태값을 확인하세요.";
  return null;
}
function cleanDoctor(d, isNew) {
  const g = d.gradYear === null || d.gradYear === undefined || d.gradYear === "" ? null : +d.gradYear;
  return {
    hospital: d.hospital,
    name: str(d.name, 100),
    dept: d.dept,
    title: str(d.title, 100),
    specialty: str(d.specialty),
    clinical: str(d.clinical),
    university: str(d.university, 200),
    gradYear: g,
    edu: str(d.edu),
    career: str(d.career),
    profileUrl: str(d.profileUrl),
    excerpt: str(d.excerpt),
    verified: isNew ? "검증 필요" : (d.verified === "검증됨" ? "검증됨" : "검증 필요"),
    verifiedAt: d.verifiedAt || today(),
    status: d.status === "비활성" ? "비활성" : "활성",
    demo: !!d.demo,
  };
}
function findDoctor(id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id || "")) return null;
  return DB.doctors.find((d) => d.id === id) || null;
}

/* ---------- HTTP 유틸 ---------- */
function send(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Length": Buffer.byteLength(body),
    ...(extraHeaders || {}),
  });
  res.end(body);
}
function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > (maxBytes || 10 * 1024)) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch (e) { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}
const WEBROOT = path.join(__dirname, "..");
function serveIndex(res) {
  fs.readFile(path.join(WEBROOT, "index.html"), (err, data) => {
    if (err) { send(res, 500, { error: "index.html not found" }); return; }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Length": data.length,
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const ip = clientIp(req);
    const p = url.pathname;

    if (req.method === "GET" && (p === "/" || p === "/index.html")) { serveIndex(res); return; }

    /* --- 인증 (공개: login/me, 인증필요: logout/change) --- */
    if (req.method === "POST" && p === "/api/auth/login") {
      if (loginLimit(ip)) { send(res, 429, { error: "too many attempts" }); return; }
      let body;
      try { body = await readJson(req); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      if (!body || typeof body.password !== "string" || !verifyPw(body.password)) {
        send(res, 401, { error: "invalid credentials" });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { exp: Date.now() + SESSION_TTL_MS, ip });
      send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(token) });
      return;
    }
    if (req.method === "GET" && p === "/api/auth/me") { send(res, 200, { authed: authed(req) }); return; }
    if (req.method === "GET" && p === "/api/health") { send(res, 200, { ok: true }); return; }
    if (req.method === "POST" && p === "/api/auth/logout") {
      const t = parseCookies(req)[COOKIE_NAME];
      if (t) sessions.delete(t);
      send(res, 200, { ok: true }, { "Set-Cookie": clearCookie });
      return;
    }
    if (req.method === "POST" && p === "/api/auth/change-password") {
      if (!authed(req)) { send(res, 401, { error: "unauthorized" }); return; }
      let body;
      try { body = await readJson(req); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      if (!body || typeof body.current !== "string" || !verifyPw(body.current)) {
        send(res, 401, { error: "current password mismatch" });
        return;
      }
      if (typeof body.next !== "string" || body.next.length < MIN_PW_LEN) {
        send(res, 400, { error: "new password too short (min 8)" });
        return;
      }
      setPw(body.next);
      send(res, 200, { ok: true });
      return;
    }

    /* --- 의료진 조회 (공개) --- */
    if (req.method === "GET" && p === "/api/doctors") { send(res, 200, { doctors: DB.doctors }); return; }

    /* --- 관리자 쓰기 (전부 인증 필요) --- */
    const needAuth = (req.method === "POST" || req.method === "PATCH") && (p === "/api/admin/doctors" || p.startsWith("/api/admin/doctors/") || p.startsWith("/api/admin/"));
    if (needAuth || (req.method === "GET" && p === "/api/admin/logs")) {
      if (!authed(req)) { send(res, 401, { error: "unauthorized" }); return; }
    }
    if (needAuth && writeLimit(ip)) { send(res, 429, { error: "too many requests" }); return; }

    if (req.method === "GET" && p === "/api/admin/logs") { send(res, 200, { logs: DB.logs }); return; }
    if (req.method === "POST" && p === "/api/admin/log") {
      let body;
      try { body = await readJson(req); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      if (!body || typeof body.msg !== "string" || !body.msg.trim()) { send(res, 400, { error: "bad request" }); return; }
      addLog(body.msg); saveDb(DB);
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && p === "/api/admin/doctors") {
      let body;
      try { body = await readJson(req, 100 * 1024); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      const err = validateDoctor(body);
      if (err) { send(res, 400, { error: err }); return; }
      const doc = { id: newId(), ...cleanDoctor(body, true) };
      DB.doctors.push(doc);
      addLog(`의료진 저장: ${doc.name}`);
      saveDb(DB);
      send(res, 201, { doctor: doc });
      return;
    }
    const mPatch = req.method === "PATCH" && p.match(/^\/api\/admin\/doctors\/([A-Za-z0-9_-]{1,64})$/);
    if (mPatch) {
      const doc = findDoctor(mPatch[1]);
      if (!doc) { send(res, 404, { error: "not found" }); return; }
      let body;
      try { body = await readJson(req, 100 * 1024); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      const merged = { ...doc, ...body, id: doc.id, demo: doc.demo };
      const err = validateDoctor(merged);
      if (err) { send(res, 400, { error: err }); return; }
      Object.assign(doc, cleanDoctor(merged, false), { id: doc.id, demo: doc.demo });
      addLog(`의료진 수정: ${doc.name}`);
      saveDb(DB);
      send(res, 200, { doctor: doc });
      return;
    }
    const mVerify = req.method === "POST" && p.match(/^\/api\/admin\/doctors\/([A-Za-z0-9_-]{1,64})\/verify$/);
    if (mVerify) {
      const doc = findDoctor(mVerify[1]);
      if (!doc) { send(res, 404, { error: "not found" }); return; }
      if (!doc.profileUrl || !/^https?:\/\//.test(doc.profileUrl)) { send(res, 400, { error: "공식 프로필 URL이 유효하지 않아 검증할 수 없습니다." }); return; }
      doc.verified = "검증됨";
      doc.verifiedAt = today();
      addLog(`출처 검증됨: ${doc.name}`);
      saveDb(DB);
      send(res, 200, { doctor: doc });
      return;
    }
    const mStatus = req.method === "POST" && p.match(/^\/api\/admin\/doctors\/([A-Za-z0-9_-]{1,64})\/status$/);
    if (mStatus) {
      const doc = findDoctor(mStatus[1]);
      if (!doc) { send(res, 404, { error: "not found" }); return; }
      let body;
      try { body = await readJson(req); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      if (!body || (body.status !== "활성" && body.status !== "비활성")) { send(res, 400, { error: "상태값을 확인하세요." }); return; }
      doc.status = body.status;
      addLog(`상태 변경: ${doc.name} → ${doc.status}`);
      saveDb(DB);
      send(res, 200, { doctor: doc });
      return;
    }
    if (req.method === "POST" && p === "/api/admin/import") {
      let body;
      try { body = await readJson(req, 1024 * 1024); } catch (e) { send(res, 400, { error: "bad request" }); return; }
      const rows = body && Array.isArray(body.rows) ? body.rows.slice(0, 500) : null;
      if (!rows) { send(res, 400, { error: "bad request" }); return; }
      let ok = 0, fail = 0;
      for (const r of rows) {
        const d = {
          hospital: r.hospital || "snuh", name: r.name, dept: r.department || r.dept || "내과",
          title: r.title || "", specialty: r.specialty || "", clinical: r.clinical || "",
          university: r.university || "", gradYear: r.gradYear ?? null,
          edu: "", career: "", profileUrl: r.profileUrl, excerpt: "CSV 가져오기",
          verified: "검증 필요", verifiedAt: today(), status: "활성", demo: false,
        };
        if (!d.profileUrl || !/^https?:\/\//.test(d.profileUrl.trim()) || validateDoctor(d)) { fail++; continue; }
        DB.doctors.push({ id: newId(), ...cleanDoctor(d, true) });
        ok++;
      }
      addLog(`CSV 가져오기: 성공 ${ok}, 실패 ${fail}`);
      saveDb(DB);
      send(res, 200, { ok, fail });
      return;
    }
    if (req.method === "POST" && p === "/api/admin/demo") {
      const t = today();
      const base = Date.now();
      const demo = [
        { name: "김데모(데모)", hospital: "snuh", dept: "심장내과", gradYear: 2003 },
        { name: "이데모(데모)", hospital: "snuh", dept: "심장내과", gradYear: 1995 },
        { name: "박데모(데모)", hospital: "asan", dept: "소화기내과", gradYear: 2004 },
        { name: "최데모(데모)", hospital: "asan", dept: "소화기내과", gradYear: 1993 },
      ];
      demo.forEach((d, i) => DB.doctors.push({
        id: newId() + i, title: "교수(가상)", specialty: "데모 전문분야", clinical: "데모 진료분야",
        university: "가상대학교", edu: "데모 학력", career: "데모 경력(가상)",
        profileUrl: "https://example.com/demo/" + (base + i), excerpt: "데모 데이터 - 공식 출처 아님",
        verified: "검증 필요", verifiedAt: t, status: "활성", demo: true, ...d,
      }));
      addLog("데모 데이터 로드(가상)");
      saveDb(DB);
      send(res, 200, { added: 4 });
      return;
    }
    if (req.method === "POST" && p === "/api/admin/revalidate") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      let n = 0;
      for (const d of DB.doctors) {
        if (!d.verifiedAt || new Date(d.verifiedAt) < cutoff) { d.verified = "검증 필요"; n++; }
      }
      addLog(`재검증 표시: ${n}건 (90일 초과)`);
      saveDb(DB);
      send(res, 200, { n });
      return;
    }
    if (req.method === "POST" && p === "/api/admin/reset") {
      DB = { doctors: [], logs: [] };
      addLog("DB 초기화");
      saveDb(DB);
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && p === "/api/admin/restore-seed") {
      DB = freshDb();
      addLog(`시드 복원 ${DB.doctors.length}명`);
      saveDb(DB);
      send(res, 200, { count: DB.doctors.length });
      return;
    }
    if (req.method === "GET" && p === "/api/admin/ping") {
      if (!authed(req)) { send(res, 401, { error: "unauthorized" }); return; }
      send(res, 200, { ok: true, time: new Date().toISOString() });
      return;
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    try { send(res, 500, { error: "internal error" }); } catch (_) { /* noop */ }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[mvp] http://${HOST}:${PORT} (DATA_DIR=${DATA_DIR}, doctors=${DB.doctors.length})`);
  if (HOST === "0.0.0.0") {
    for (const lan of lanIps()) console.log(`[mvp] 같은 와이파이 휴대폰 접속: http://${lan}:${PORT}`);
  } else {
    console.log("[mvp] 휴대폰 접속은 start-lan.bat 실행(같은 와이파이) 또는 MOBILE.md 참고");
  }
});
function lanIps() {
  const out = [];
  try {
    for (const ifs of Object.values(os.networkInterfaces())) {
      for (const a of ifs || []) {
        if (a.family === "IPv4" && !a.internal) out.push(a.address);
      }
    }
  } catch (e) { /* noop */ }
  return out;
}
