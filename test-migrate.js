// 구버전 DB 마이그레이션 테스트: 기존 데이터는 유지하고 새 시드만 추가되는지 검증
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3109;
const DATA_DIR = path.join(__dirname, ".tmp-migrate-test");
const BASE = `http://127.0.0.1:${PORT}`;
try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(DATA_DIR, { recursive: true });
// 구버전 DB 흉내: 시드 1개 + 관리자 추가 1개, 버전 없음
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "server", "seed.json"), "utf8"));
const custom = { id: "mine1", hospital: "snuh", name: "내가추가한의사", dept: "내과", title: "",
  specialty: "테스트", clinical: "", university: "", gradYear: null, edu: "", career: "",
  profileUrl: "https://example.com/mine", excerpt: "", verified: "검증 필요",
  verifiedAt: "2026-10-10", status: "활성", demo: false };
fs.writeFileSync(path.join(DATA_DIR, "db.json"), JSON.stringify({
  doctors: [seed[0], custom], logs: [{ t: "2026-10-01 00:00", msg: "old" }],
}));

const child = spawn(process.execPath, [path.join(__dirname, "server", "server.js")], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR },
  stdio: ["ignore", "pipe", "pipe"],
});
let pass = 0;
function ok(name, cond) {
  if (!cond) throw new Error("FAIL: " + name);
  pass++;
  console.log("ok - " + name);
}
(async () => {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + "/api/health"); if (r.ok) break; } catch (e) {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const r = await fetch(BASE + "/api/doctors");
  const j = await r.json();
  ok("구DB 2명 → 시드 병합 " + seed.length + "+1명", j.doctors.length === seed.length + 1);
  ok("관리자 추가분 유지", j.doctors.some((d) => d.id === "mine1"));
  ok("EBS 포함", j.doctors.some((d) => d.hospital === "ebs"));
  const db = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "db.json"), "utf8"));
  ok("버전 기록됨", typeof db.seedVersion === "string" && db.seedVersion.length > 0);
  ok("동기화 로그 기록", db.logs.some((l) => /시드 동기화/.test(l.msg)));
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
