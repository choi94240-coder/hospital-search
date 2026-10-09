# 관리자 인증 백엔드

`index.html` 관리자 탭의 화면 가림용 잠금을, 운영용 서버 세션 인증으로 교체하는 미니 백엔드입니다.
무의존성(순수 Node 18+)이라 `npm install`이 필요 없습니다.

## 실행

```bat
cd C:\Users\82104\Desktop\work1
set ADMIN_INIT_PASSWORD=c01045719064
node server\server.js
```

브라우저에서 `http://127.0.0.1:3000` 으로 열면, 관리자 로그인이 이 서버를 통해 인증됩니다.
`index.html`을 파일로 직접 열면(`file://`) 기존 로컬 잠금으로 동작합니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3000` | 포트 |
| `HOST` | `127.0.0.1` | 바인드 주소 (LAN 공개 시 `0.0.0.0`, 방화벽 주의) |
| `DATA_DIR` | `server/data` | 해시 저장 위치 |
| `ADMIN_INIT_PASSWORD` | `c01045719064` | 최초 비밀번호 (첫 실행 시 1회만 사용, 즉시 변경) |
| `SESSION_TTL_H` | `12` | 세션 유효 시간 |
| `COOKIE_SECURE` | 미설정 | `1`이면 Secure 쿠키 (HTTPS 배포 시 설정) |
| `TRUST_PROXY` | 미설정 | `1`이면 프록시 전달 IP로 rate-limit (터널 사용 시 설정) |

## API

### 인증
- `POST /api/auth/login` `{password}` → 200 + HttpOnly 세션 쿠키 / 401 / 429(분당 5회 초과)
- `GET /api/auth/me` → `{authed:true|false}`
- `POST /api/auth/logout` → 세션 파기
- `POST /api/auth/change-password` `{current,next}` (인증 필요, 새 비번 8자 이상)

### 의료진 조회 (공개)
- `GET /api/doctors` → `{doctors}` (전체, 비활성 포함 — 화면에서 필터)

### 관리자 쓰기 (전부 인증 필요, 미인증 401)
- `POST /api/admin/doctors` → 201 (서버 검증: 병원·이름·진료과 필수, URL 형식, 졸업연도 1950~올해)
- `PATCH /api/admin/doctors/:id` → 수정
- `POST /api/admin/doctors/:id/verify` → 출처 검증됨 처리
- `POST /api/admin/doctors/:id/status` `{status:활성|비활성}`
- `POST /api/admin/import` `{rows:[...]}` → `{ok,fail}` (최대 500행)
- `POST /api/admin/demo` → 데모 4명 추가
- `POST /api/admin/revalidate` → 90일 초과 검증 필요 처리 `{n}`
- `POST /api/admin/reset` → 빈 DB
- `POST /api/admin/restore-seed` → 시드 복원 `{count}`
- `GET /api/admin/logs` → 수집 로그
- `POST /api/admin/log` `{msg}` → 로그 1건 추가

## 데이터 파일 (`DATA_DIR`, 기본 `server/data`)

- `auth.json` — 비밀번호 scrypt 해시 (평문 없음)
- `db.json` — 의료진 + 로그 (쓰기마다 tmp+rename 원자 저장)
- `seed.json` — 초기 시드 220명 (프론트 `SEED_DOCTORS`와 동일 내용)

시드 재생성 (`index.html` 수정 후):
```bat
node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('index.html','utf8');const s=h.indexOf('const SEED_DOCTORS=[')+'const SEED_DOCTORS='.length;const e=h.indexOf('}];\nconst norm=',s);const a=vm.runInNewContext(h.slice(s,e+3),{SEED_DATE:'2026-10-09'});fs.writeFileSync('server/seed.json',JSON.stringify(a,null,1));console.log(a.length);"
```

## 보안 설계

- 비밀번호는 scrypt 해시로만 저장 (`server/data/auth.json`, 평문 없음)
- 비교는 `timingSafeEqual`, 세션 토큰은 256비트 난수 (서버 보관)
- 세션 쿠키 HttpOnly + SameSite=Lax, JSON 바디 10KB 제한, 보안 헤더付

## 정직한 한계와 다음 단계

1. 인증 + 관리자 쓰기가 모두 서버로 이동했습니다. 다만 의료진 **조회**는 공개 API이므로
   데이터 자체는 누구나 읽을 수 있습니다 (의료진 디렉터리 서비스 특성상 의도된 공개).
2. 운영 배포 시 역방향 프록시(Nginx/Caddy) + HTTPS를 앞에 두세요.
   HTTPS에서는 `COOKIE_SECURE=1`로 실행하십시오.
3. 초기 비밀번호는 로그인 즉시 **비밀번호 변경** 버튼으로 바꾸세요.
4. 다음 단계 후보: PostgreSQL 이전, 검색 API 서버 이전(`GET /api/search?q=`),
   감사 로그 서명, 관리자 2단계 인증.

## 테스트

```bat
node test-auth.js
node test-api.js
```

인증 15개 + CRUD 24개 항목을 자동 검증합니다.
