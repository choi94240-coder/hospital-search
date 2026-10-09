# GitHub Pages에 올리기 (무료·PC 꺼도 24시간 검색 가능)

GitHub Pages는 **정적 홈페이지 무료 호스팅**입니다.
올려두면 PC를 꺼도 `https://내아이디.github.io/hospital-search/` 주소로
휴대폰에서 24시간 검색할 수 있습니다.

먼저 꼭 아세요 (중요):

- Pages에는 **백엔드가 없습니다.** 이 페이지는 그걸 자동으로 감지해서
  **로컬 모드**로 동작합니다 (서버 대신 브라우저 저장소 사용).
- 그래서 **관리자 암호 변경·의료진 추가 같은 변경은 그 기기(그 브라우저)에만 저장**되고,
  다른 사람 휴대폰이나 PC와 공유되지 않습니다.
  → **검색용 공개 페이지로는 최고, 함께 관리하는 운영용으로는 Railway(`DEPLOY.md`)를 쓰세요.**
- 무료 Pages는 저장소가 **Public(공개)** 이어야 합니다.
  소스코드가 공개되므로, 첫 로그인 후 관리자 비번을 반드시 바꾸세요
  (소스 안의 초기 비번이 그대로 보이기 때문입니다).

---

## 1단계. 저장소를 Public으로 준비

`DEPLOY.md` 1~2단계를 했다면 저장소가 이미 있습니다.

1. https://github.com → 본인 저장소(`hospital-search`)에 들어갑니다.
2. `Settings` → 맨 아래 `Danger Zone` → `Change visibility` →
   `Change to public`을 눌러 공개로 바꿉니다.
   (이유: 무료 Pages는 공개 저장소에서만 됩니다.)
3. PC에 최신 파일이 다 올라가 있는지 확인합니다.
   (`index.html` 하나만 있어도 Pages는 동작합니다.)

아직 GitHub에 안 올렸다면 `DEPLOY.md`의 1~2단계(저장소 만들기·`git push`)를
먼저 하되, 저장소를 **Public**으로 만드세요.

## 2단계. Pages 켜기 (클릭 3번)

1. 저장소 화면에서 **`Settings`** 탭을 누릅니다.
2. 왼쪽 메뉴에서 **`Pages`** 를 누릅니다.
3. `Build and deployment` 아래를 이렇게 맞춥니다.
   - Source: **Deploy from a branch**
   - Branch: **main** + **/(root)** 선택 → **`Save`** 클릭
4. 1~3분 기다렸다가 페이지를 새로고침하면 맨 위에 주소가 뜹니다.
   예: `https://YOURNAME.github.io/hospital-search/`

## 3단계. 휴대폰에서 확인

1. 휴대폰 브라우저에 위 주소를 입력합니다 (데이터 통신でも 됩니다).
2. 메인 검색에 `가슴이 아프고 숨이 차요`를 입력해 보세요.
   진료과 추천 + 의료진이 나오면 성공입니다.
3. 관리자 탭은 로컬 잠금으로 동작합니다 (초기 비번 `c01045719064`).
   바꾼 비번·추가한 의료진은 **그 휴대폰에만** 저장됩니다.

## 4단계. 파일 고쳤을 때 반영하기

PC에서 `index.html`을 고친 뒤:

```
cd C:\Users\82104\Desktop\work1
git add -A
git commit -m "수정한 내용 한 줄 설명"
git push
```

1~2분 뒤 Pages 주소에 자동 반영됩니다.

## 안 될 때 체크리스트

- `404 There isn't a GitHub Pages site here`: 배포 후 1~3분 더 기다리기.
  그래도 안 되면 Settings → Pages에서 Branch가 `main` + `/(root)`인지 확인.
- 주소 뒤에 저장소 이름이 빠짐: `https://YOURNAME.github.io/` 만 치면 안 되고
  `https://YOURNAME.github.io/hospital-search/` 까지 다 입력해야 합니다.
- 관리자 변경이 PC에 안 보임: 정상입니다. Pages는 기기별 저장이라 공유 안 됩니다.
  공유 DB가 필요하면 Railway(`DEPLOY.md`)를 쓰세요.
- 저장소를 Public으로 바꾸기 싫음: 비공개 유지는 Pages 무료로 안 됩니다.
  비공개 + 공유 DB 원하면 Railway 쪽을 쓰세요.
