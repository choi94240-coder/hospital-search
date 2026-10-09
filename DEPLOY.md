# 24시간 운영 배포하기 (PC를 꺼도 휴대폰 검색 가능)

PC를 끄면 집 PC 서버도 같이 꺼집니다. PC 없이 24시간 돌리려면
**클라우드 컴퓨터(호스팅)에 이 프로젝트를 올려야** 합니다.
여기서는 초보자에게 가장 쉬운 **Railway** 기준으로 설명합니다.

왜 Railway인가: Render 무료는 일정 시간 뒤 잠들어서(sleep) 24시간 요구에 맞지 않습니다.
Railway는 (무료 크레딧 한도 안에서) 계속 켜져 있고, 디스크(볼륨) 연결로 데이터도 유지됩니다.

전체 흐름: 내 PC 파일 → GitHub에 올림 → Railway가 가져가서 실행 → 인터넷 주소 발급

---

## 1단계. Git 설치 확인 (1회)

파워셸에 입력:

```
git --version
```

버전 숫자가 나오면 넘어가세요. 안 나오면 https://git-scm.com 에서
Git for Windows를 설치하고 파워셸을 다시 여세요.

## 2단계. GitHub에 프로젝트 올리기 (1회)

1. https://github.com 에서 회원가입·로그인합니다.
2. 우측 상단 `+` → `New repository` → 이름 예: `hospital-search` →
   Public/Private 중 **Private**(비공개) 권장 → `Create repository`.
3. PC 파워셸에서 `work1` 폴더로 이동 후 아래를 **한 줄씩** 실행합니다.
   (`YOURNAME`은 본인 GitHub 아이디, `hospital-search`는 위 저장소 이름)

```
cd C:\Users\82104\Desktop\work1
git init
git add index.html server Dockerfile railway.json .gitignore .dockerignore MOBILE.md test-auth.js test-api.js
git commit -m "hospital search mvp"
git branch -M main
git remote add origin https://github.com/YOURNAME/hospital-search.git
git push -u origin main
```

4. 중간에 GitHub 로그인 창이 뜨면 로그인합니다.
   (비밀번호 대신 토큰을 요구하면: GitHub → Settings → Developer settings →
   Personal access tokens → 토큰 발급 후 비밀번호란에 붙여넣기)
5. 브라우저에서 본인 저장소 주소에 파일들이 보이면 성공입니다.

> `server/data` 폴더는 `.gitignore`에 의해 **올라가지 않습니다.**
> 비밀번호 해시·DB가 GitHub에 노출되지 않게 일부러 뺀 것입니다.

## 3단계. Railway에 올리기

1. https://railway.app 에서 **Login with GitHub**으로 가입·로그인합니다.
2. `+ New` → `Deploy from GitHub repo` → `hospital-search` 선택 →
   `Deploy Now`. (처음 1~3분 빌드 시간이 걸립니다.)
3. 배포가 끝나면 서비스 화면에 인터넷 주소(도메인)가 생깁니다.
   `Settings → Networking → Generate Domain`에서 발급받으세요.
   예: `https://hospital-search-production.up.railway.app`

## 4단계. 데이터 디스크 + 비밀번호 설정 (중요!)

이걸 안 하면 (a) 재배포 때마다 데이터가 날아가고, (b) 초기 비번 그대로 노출됩니다.

1. Railway 서비스 화면 → `+ New` → `Volume` 추가 →
   서비스에 연결(Mount)하고 마운트 경로를 `/data` 로 지정합니다.
2. `Variables` 탭에서 아래 3개를 등록합니다.

| 변수 | 값 | 이유 |
|---|---|---|
| `DATA_DIR` | `/data` | DB·해시를 디스크에 저장 (재배포에도 유지) |
| `ADMIN_INIT_PASSWORD` | **16자 이상 아무도 모르는 문자열** | 최초 관리자 비번 (소스 기본값 대신 사용) |
| `COOKIE_SECURE` | `1` | HTTPS 쿠키 보호 |
| `TRUST_PROXY` | `1` | 접속자 IP 기준 rate-limit |

3. 저장하면 자동 재배포됩니다. `Deployments` 탭에서 초록색 `Active`를 확인하세요.

## 5단계. 휴대폰에서 확인

1. 휴대폰 브라우저에 3단계의 `https://...` 주소를 입력합니다.
2. 검색·병원별·의료진 목록이 뜨는지 확인합니다.
3. 관리자 탭 → 4단계에서 정한 비밀번호로 로그인 →
   **비밀번호 변경** 버튼으로 한 번 더 바꿉니다.
4. PC를 완전히 끄고 휴대폰 데이터 통신으로 다시 열어보세요.
   그대로 열리면 24시간 운영 완성입니다.

## 6단계. 이후 업데이트 방법

PC에서 파일을 고친 뒤:

```
cd C:\Users\82104\Desktop\work1
git add -A
git commit -m "수정한 내용 한 줄 설명"
git push
```

Railway가 자동으로 다시 배포합니다. DB는 볼륨(`/data`)에 있어 유지됩니다.

## 솔직한 주의사항

- Railway 신규 계정에는 소액의 무료 크레딧이 주어지며, 사용량에 따라 소진됩니다.
  `Usage` 탭에서 잔량을 보세요. 크레딧이 다 떨어지면 서비스가 멈춥니다.
  (이 앱은 가볍고 무의존성이라 소모가 적지만, 공짜 영원 보장은 아닙니다.)
- 무료 크레딧 이후에도 완전 무료 24시간을 원하면 Oracle Cloud 평생 무료 VM이 대안이지만,
  서버 직접 관리가 필요해 초보자에겐 어렵습니다. 필요하면 그 단계도 안내합니다.
- 그래도 PC를 켜고 쓰는 방식(집 와이파이·터널)은 계속 무료로 병행할 수 있습니다.
  자세한 건 `MOBILE.md` 참고.

## 안 될 때 체크리스트

- 빌드 실패: `Dockerfile`이 GitHub에 올라갔는지 확인 (`git add` 누락이 가장 흔함)
- `Application failed to respond`: 1~2분 더 기다리기 (첫 기동은 느림).
  계속되면 `Deploy Logs`에서 `[mvp] http://...` 줄이 있는지 확인
- 로그인 401: `ADMIN_INIT_PASSWORD` 값을 정확히 입력했는지 확인
- 데이터가 리셋됨: 볼륨이 연결됐는지, `DATA_DIR=/data`인지 확인
