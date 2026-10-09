# 휴대폰에서 접속하기

세 가지 방법이 있습니다. **A(같은 와이파이)** 가 쉽고, **B(인터넷)** 는 어디서든 됩니다.
**PC를 끄고도 24시간 돌리려면 C/D** 를 보세요.

- C: GitHub Pages — 무료·검색용 공개 페이지에 최적 (기기별 저장) → `PAGES.md`
- D: 클라우드 배포(Railway) — 공유 DB 운영용 → `DEPLOY.md`

공통: 이 페이지는 모바일 화면에 맞춰져 있습니다 (작은 화면에서는 1열로 표시).

---

## A. 같은 와이파이에서 접속 (쉬움, 5분)

PC와 휴대폰이 **같은 집/사무실 와이파이**에 연결되어 있어야 합니다.

1. PC에서 `work1` 폴더의 **`start-lan.bat`을 더블클릭**합니다.
   (검은 창에 `[mvp] 같은 와이파이 휴대폰 접속: http://192.168.x.x:3000` 같은 줄이 나옵니다.
   그 주소를 메모하세요. `192.168`으로 시작하는 PC 주소입니다.)
2. 처음 실행 시 Windows에서 "방화벽 액세스 허용" 창이 뜨면
   **개인 네트워크 체크 → 액세스 허용**을 누르세요.
   (이 창을 거절하면 휴대폰에서 안 열립니다.)
3. 휴대폰 브라우저(크롬/사파리) 주소창에 그 주소를 입력합니다.
   예: `http://192.168.0.5:3000`
4. 검색·병원별·의료진 목록이 그대로 보입니다.
   관리자 탭은 PC와 같은 비밀번호로 로그인합니다.

> PC 방화벽 창이 안 떴는데 접속이 안 되면: PC 파워셸에
> `New-NetFirewallRule -DisplayName "mvp3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow`
> 를 입력하고 다시 시도하세요.

---

## B. 인터넷 어디서든 접속 (Cloudflare Tunnel, 무료)

집 밖(데이터 통신)에서도 접속하려면 PC를 인터넷에 안전하게 공개해야 합니다.
가장 쉬운 무료 방법이 Cloudflare Tunnel입니다. 공유기 설정이 필요 없습니다.

1. PC에서 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   에 들어가 **Windows 64비트 cloudflared.exe**를 내려받아 `work1` 폴더에 둡니다.
2. 서버를 먼저 켭니다 (`node server\server.js` 또는 위 A의 bat).
3. **새 파워셸 창**을 하나 더 열고 `work1` 폴더로 이동 후 실행합니다.
   (터널 뒤에 HTTPS가 붙으므로 Secure 쿠키로 서버를 켜는 것을 권장합니다)
   ```
   set COOKIE_SECURE=1
   set TRUST_PROXY=1
   node server\server.js
   ```
   ```
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```
4. 몇 초 뒤 `https://xxxx-xxxx.trycloudflare.com` 같은 주소가 나옵니다.
   이 주소를 휴대폰 브라우저에 입력하면 **데이터 통신에서도** 접속됩니다.
5. 관리자 로그인은 PC와 같은 비밀번호입니다.

주의사항 (꼭 읽으세요):
- `trycloudflare.com` 주소는 **cloudflared를 껐다 켤 때마다 바뀝니다.**
  PC를 끄면 접속도 끊깁니다. 24시간 운영하려면 항상 켜진 PC와 계속 켜진 터널이 필요합니다.
- 인터넷에 공개되는 순간부터 전 세계가 로그인 화면을 볼 수 있습니다.
  **관리자 비밀번호를 길고 유일하게 바꾸고**(16자 이상 권장),
  사용이 끝나면 cloudflared 창을 닫아 공개를 중단하세요.
- 고정 주소·본격 운영이 필요하면 Render/Railway 같은 호스팅 이전을 권장합니다
  (원하면 그 단계도 만들어 드립니다).

---

## 환경 변수 정리

| 변수 | A(와이파이) | B(터널) |
|---|---|---|
| `HOST` | `0.0.0.0` (bat에 포함됨) | `127.0.0.1` (기본값) |
| `COOKIE_SECURE` | 미설정 | `1` |
| `TRUST_PROXY` | 미설정 | `1` (rate-limit가 접속자 IP를 보게 함) |
