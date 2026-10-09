// 백엔드 인증 자가 테스트: 서버를 자식으로 띄우고 API를 검증한 뒤 종료한다.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3107;
const DATA_DIR = path.join(__dirname, ".tmp-auth-test");
const BASE = `http://127.0.0.1:${PORT}`;
try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) {}

const child = spawn(process.execPath, [path.join(__dirname, "server", "server.js")], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR, ADMIN_INIT_PASSWORD: "c01045719064" },
  stdio: ["ignore", "pipe", "pipe"],
});
let out = "";
child.stdout.on("data", (d) => { out += d; });
child.stderr.on("data", (d) => { out += d; });

async function waitReady() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE + "/api/auth/me");
      if (r.ok) return;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server not ready: " + out);
}
async function req(method, p, body, cookie) {
  const r = await fetch(BASE + p, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j, setCookie: r.headers.get("set-cookie") };
}
function cookieOf(res) {
  if (!res.setCookie) return "";
  return res.setCookie.split(";")[0];
}
let pass = 0;
function ok(name, cond) {
  if (!cond) throw new Error("FAIL: " + name);
  pass++;
  console.log("ok - " + name);
}

(async () => {
  await waitReady();
  let r = await req("GET", "/api/auth/me");
  ok("me 초기값 false", r.status === 200 && r.body && r.body.authed === false);

  r = await req("POST", "/api/auth/login", { password: "wrong" });
  ok("오답 401", r.status === 401);

  r = await req("POST", "/api/auth/login", { password: "c01045719064" });
  ok("정답 200 + HttpOnly 쿠키", r.status === 200 && r.body.ok === true && /HttpOnly/.test(r.setCookie || ""));
  const ck = cookieOf(r);

  r = await req("GET", "/api/auth/me", null, ck);
  ok("쿠키로 me=true", r.body && r.body.authed === true);

  r = await req("GET", "/api/admin/ping");
  ok("미인증 ping 401", r.status === 401);
  r = await req("GET", "/api/admin/ping", null, ck);
  ok("인증 ping 200", r.status === 200 && r.body.ok === true);

  r = await req("POST", "/api/auth/change-password", { current: "nope", next: "newpass12" }, ck);
  ok("변경 오답 401", r.status === 401);
  r = await req("POST", "/api/auth/change-password", { current: "c01045719064", next: "short" }, ck);
  ok("짧은 비번 400", r.status === 400);
  r = await req("POST", "/api/auth/change-password", { current: "c01045719064", next: "newpass12" }, ck);
  ok("변경 성공 200", r.status === 200);

  r = await req("POST", "/api/auth/login", { password: "c01045719064" });
  ok("구 비번 401", r.status === 401);
  r = await req("POST", "/api/auth/login", { password: "newpass12" });
  ok("새 비번 200", r.status === 200);
  const ck2 = cookieOf(r);

  r = await req("POST", "/api/auth/logout", {}, ck2);
  ok("로그아웃 200", r.status === 200);
  r = await req("GET", "/api/auth/me", null, ck2);
  ok("로그아웃 후 me=false", r.body && r.body.authed === false);

  // rate-limit: 6연속 오답 중 429가 나와야 함
  let got429 = false;
  for (let i = 0; i < 7; i++) {
    r = await req("POST", "/api/auth/login", { password: "nope" + i });
    if (r.status === 429) got429 = true;
  }
  ok("rate-limit 429 발생", got429);

  // auth.json에 평문이 없는지 확인
  const raw = fs.readFileSync(path.join(DATA_DIR, "auth.json"), "utf8");
  ok("해시 파일에 평문 없음", !raw.includes("newpass12") && !raw.includes("c01045719064"));

  console.log(`ALL PASS (${pass})`);
  process.exitCode = 0;
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
}).finally(() => {
  child.kill();
  setTimeout(() => {
    try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) {}
  }, 300);
});
