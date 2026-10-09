// 의료진 CRUD API 자가 테스트 (인증 + 검증 + 로그 + 시드 복원)
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3108;
const DATA_DIR = path.join(__dirname, ".tmp-api-test");
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
    try { const r = await fetch(BASE + "/api/auth/me"); if (r.ok) return; } catch (e) {}
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
let pass = 0;
function ok(name, cond) {
  if (!cond) throw new Error("FAIL: " + name);
  pass++;
  console.log("ok - " + name);
}
const good = {
  hospital: "snuh", name: "테스트의사", dept: "내과", title: "교수",
  specialty: "테스트", university: "테스트대", gradYear: 2003,
  profileUrl: "https://example.com/profile/test", excerpt: "테스트",
};

(async () => {
  await waitReady();

  let r = await req("GET", "/api/doctors");
  ok("공개 목록 200 + 시드 220명", r.status === 200 && r.body.doctors.length === 220);

  r = await req("POST", "/api/admin/doctors", good);
  ok("미인증 생성 401", r.status === 401);
  r = await req("GET", "/api/admin/logs");
  ok("미인증 로그 401", r.status === 401);

  r = await req("POST", "/api/auth/login", { password: "c01045719064" });
  const ck = r.setCookie.split(";")[0];
  ok("로그인 성공", r.status === 200);

  r = await req("POST", "/api/admin/doctors", { ...good, name: "" }, ck);
  ok("이름 누락 400", r.status === 400);
  r = await req("POST", "/api/admin/doctors", { ...good, profileUrl: "notaurl" }, ck);
  ok("URL 형식 400", r.status === 400);
  r = await req("POST", "/api/admin/doctors", { ...good, gradYear: 1800 }, ck);
  ok("졸업연도 범위 400", r.status === 400);
  r = await req("POST", "/api/admin/doctors", { ...good, hospital: "xx" }, ck);
  ok("병원 검증 400", r.status === 400);

  r = await req("POST", "/api/admin/doctors", good, ck);
  ok("생성 201 + 검증 필요", r.status === 201 && r.body.doctor.verified === "검증 필요" && r.body.doctor.id);
  const id = r.body.doctor.id;

  r = await req("GET", "/api/doctors", null, ck);
  ok("생성 후 221명", r.body.doctors.length === 221);

  r = await req("PATCH", "/api/admin/doctors/" + id, { specialty: "변경됨" }, ck);
  ok("수정 200", r.status === 200 && r.body.doctor.specialty === "변경됨");
  r = await req("PATCH", "/api/admin/doctors/no-such-id", { specialty: "x" }, ck);
  ok("없는 ID 수정 404", r.status === 404);

  r = await req("POST", `/api/admin/doctors/${id}/verify`, {}, ck);
  ok("검증 200", r.status === 200 && r.body.doctor.verified === "검증됨");

  r = await req("POST", `/api/admin/doctors/${id}/status`, { status: "비활성" }, ck);
  ok("비활성 200", r.status === 200 && r.body.doctor.status === "비활성");
  r = await req("POST", `/api/admin/doctors/${id}/status`, { status: "??" }, ck);
  ok("잘못된 상태 400", r.status === 400);

  r = await req("POST", "/api/admin/import", { rows: [
    { hospital: "asan", name: "가져온이", department: "외과", profileUrl: "https://example.com/a" },
    { hospital: "asan", name: "", profileUrl: "https://example.com/b" },
    { hospital: "asan", name: "나쁜URL", profileUrl: "ftp://x" },
  ] }, ck);
  ok("가져오기 ok=1 fail=2", r.status === 200 && r.body.ok === 1 && r.body.fail === 2);

  r = await req("POST", "/api/admin/demo", {}, ck);
  ok("데모 +4", r.status === 200 && r.body.added === 4);

  r = await req("GET", "/api/admin/logs", null, ck);
  ok("로그에 기록 존재", r.status === 200 && r.body.logs.length >= 5 && r.body.logs[0].t);

  r = await req("POST", "/api/admin/revalidate", {}, ck);
  ok("재검증 n>=0", r.status === 200 && typeof r.body.n === "number");

  r = await req("POST", "/api/admin/reset", {}, ck);
  ok("초기화", r.status === 200);
  r = await req("GET", "/api/doctors");
  ok("초기화 후 0명", r.body.doctors.length === 0);

  r = await req("POST", "/api/admin/restore-seed", {}, ck);
  ok("시드 복원 220명", r.status === 200 && r.body.count === 220);

  r = await req("POST", "/api/auth/logout", {}, ck);
  ok("로그아웃", r.status === 200);
  r = await req("POST", "/api/admin/reset", {}, ck);
  ok("로그아웃 후 쓰기 401", r.status === 401);

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
