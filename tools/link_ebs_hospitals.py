# -*- coding: utf-8 -*-
"""EBS명의 기타병원 의료진에 소속병원 공식 예약 링크 연결."""
import json, re, io

BASE = r'C:\Users\82104\Desktop\work2\work1'
SEED_JSON = BASE + r'\server\seed.json'
INDEX_HTML = BASE + r'\index.html'
SERVER_JS = BASE + r'\server\server.js'

# (키워드튜플, 표준병원명, 예약URL) — URL은 webfetch/urllib로 실존 확인済
MAP = [
    (("서울아산병원", "서울아산"), "서울아산병원", "https://www.amc.seoul.kr/asan/staff/base/staffBaseInfoList.do"),
    (("삼성서울병원",), "삼성서울병원", "https://www.samsunghospital.com/home/reservation/doctorDetailInfo.do"),
    (("삼성창원",), "삼성창원병원", "https://www.samsunghospital.com"),
    (("강남세브란스",), "강남세브란스병원", "https://gs.severance.healthcare"),
    (("용인세브란스",), "용인세브란스병원", "https://yi.severance.healthcare/"),
    (("원주세브란스",), "원주세브란스기독병원", "https://www.ywmc.or.kr"),
    (("신촌세브란스", "연세세브란스"), "신촌세브란스병원", "https://sev.severance.healthcare/sev/doctor/doctor.do"),
    (("세브란스병원", "세브란스어린이", "세브란스"), "세브란스병원", "https://sev.severance.healthcare/sev/doctor/doctor.do"),
    (("서울대치과",), "서울대학교치과병원", "https://www.snudh.org"),
    (("서울대병원", "서울대학교병원", "서울대 어린이", "서울대어린이"), "서울대학교병원", "https://www.snuh.org/reservation/meddept/main.do"),
    (("서울대",), "서울대학교병원", "https://www.snuh.org/reservation/meddept/main.do"),
    (("분당서울대",), "분당서울대학교병원", "https://www.snubh.org"),
    (("서울보라매", "보라매병원"), "서울특별시보라매병원", "https://www.brmh.org"),
    (("서울백병원", "서울백",), "서울백병원", "https://www.paik.ac.kr/seoul"),
    (("상계백",), "상계백병원", "https://www.paik.ac.kr/sanggye"),
    (("부산백", "인제대",), "인제대학교 부산백병원", "https://www.paik.ac.kr/busan"),
    (("강남성모병원",), "서울성모병원(구 강남성모)", "https://www.cmcseoul.or.kr/page/department/A"),
    (("은평성모",), "은평성모병원", "https://www.cmcep.or.kr"),
    (("여의도성모",), "여의도성모병원", "https://www.cmcsungmo.or.kr"),
    (("성빈센트",), "성빈센트병원", "https://www.cmcvincent.or.kr"),
    (("서울성모", "가톨릭대 서울성모"), "서울성모병원", "https://www.cmcseoul.or.kr/page/department/A"),
    (("인천성모",), "인천성모병원", "https://www.cmcseoul.or.kr/page/department/A"),
    (("강동경희대", "강동경희"), "강동경희대학교병원", "https://www.khnmc.or.kr"),
    (("경희대학교치과",), "경희대학교치과병원", "https://www.khmc.or.kr"),
    (("경희대병원", "경희의료원", "경희대"), "경희의료원·경희대병원", "https://www.khmc.or.kr"),
    (("고려대구로", "고대구로"), "고려대학교 구로병원", "https://guro.kumc.or.kr"),
    (("고대안산",), "고려대학교 안산병원", "https://ansan.kumc.or.kr"),
    (("고려대안암", "고대안암"), "고려대학교 안암병원", "https://anam.kumc.or.kr"),
    (("아주대학교병원", "아주대병원", "아주대"), "아주대학교병원", "https://hosp.ajoumc.or.kr"),
    (("가천대길", "가천대 길"), "가천대 길병원", "https://www.gilhospital.com"),
    (("순천향",), "순천향대학교병원", "https://www.schmc.ac.kr"),
    (("건국대학교병원", "건국대병원", "건국대"), "건국대학교병원", "https://www.kuh.ac.kr"),
    (("건양대",), "건양대학교병원", "https://www.kyuh.ac.kr"),
    (("국립암센터",), "국립암센터", "https://www.ncc.re.kr"),
    (("강북삼성",), "강북삼성병원", "https://www.kbsmc.co.kr"),
    (("국민건강보험 일산병원",), "국민건강보험 일산병원", "https://www.nhimc.or.kr"),
    (("일산차병원", "일산차"), "일산차병원", "https://www.chamc.co.kr"),
    (("분당차병원", "분당차"), "분당차병원", "https://www.chamc.co.kr"),
    (("차병원",), "차병원", "https://www.chamc.co.kr"),
    (("화순전남대",), "화순전남대학교병원", "https://www.cnuhh.com/"),
    (("전남대병원", "전남대"), "전남대학교병원", "https://www.cnuh.com/"),
    (("칠곡경북대",), "칠곡경북대학교병원", "https://www.knuch.kr"),
    (("경북대병원", "대구경북대", "경북대"), "경북대학교병원", "https://knuh.kr"),
    (("부산대병원", "부산대"), "부산대학교병원", "https://www.pnuh.or.kr"),
    (("동아대학교병원", "동아대병원", "동아대"), "동아대학교병원", "https://www.damc.or.kr"),
    (("계명대 동산", "동산병원"), "계명대학교 동산병원", "https://www.dsmc.or.kr"),
    (("원광대",), "원광대학교병원", "https://www.wkuh.org"),
    (("전북대",), "전북대학교병원", "https://www.jbuh.co.kr"),
    (("대구가톨릭대",), "대구가톨릭대학교병원", "https://www.dcmc.co.kr"),
    (("인하대",), "인하대병원", "https://www.inha.com"),
    (("한림대", "한강성심", "강남성심", "동탄성심", "평촌성심"), "한림대학교의료원", "https://www.hallym.or.kr"),
    (("원자력병원", "원자력"), "원자력병원", "https://www.kirams.re.kr"),
    (("중앙대광명",), "중앙대학교 광명병원", "https://gh.cauhs.or.kr"),
    (("중앙대학교병원", "중앙대병원", "중앙대"), "중앙대학교병원", "https://ch.cauhs.or.kr/"),
    (("중앙보훈",), "중앙보훈병원", "https://seoul.bohun.or.kr"),
    (("영남대",), "영남대학교병원", "https://www.yumc.ac.kr"),
    (("연세대 치과", "치과대학병원"), "연세대학교 치과대학병원", "https://dental.severance.healthcare/dental/index.do"),
    (("한양대", "구리 한양대"), "한양대학교병원", "https://www.hyumc.com"),
    (("이대서울",), "이대서울병원", "https://seoul.eumc.ac.kr"),
    (("이대목동",), "이대목동병원", "https://mokdong.eumc.ac.kr"),
    (("노원을지대", "노원을지", "대전을지", "서울을지", "을지대", "을지병"), "을지대학교병원", "https://www.eulji.ac.kr"),
    (("대항병원", "대항"), "대항병원", "https://www.daehang.com"),
    (("해운대부민", "부민병원", "부민"), "부민병원", "https://www.bumin.co.kr"),
    (("고신대복음",), "고신대복음병원", "https://www.ebs.co.kr"),
]

EBS_GENERIC = "https://www.ebs.co.kr"

def match(affil_full):
    tokens = [p.strip() for p in re.split(r'\s*/\s*', affil_full.strip()) if p.strip()]
    # 각 토큰 순서대로 매칭, EBS-generic이 아닌 실제 병원 링크 우선
    fallback_hit = None
    for tok in tokens:
        for keys, canon, url in MAP:
            for k in keys:
                if k and k in tok:
                    if url != EBS_GENERIC:
                        return canon, url, True
                    if fallback_hit is None:
                        fallback_hit = (canon, url)
    if fallback_hit:
        return fallback_hit[0], fallback_hit[1], True
    first = tokens[0] if tokens else ""
    for keys, canon, url in MAP:
        for k in keys:
            if k and (k in first or k in affil_full):
                # first 토큰 우선, 없으면 전체에서 매칭 — first 기준 재확인
                if k in first:
                    return canon, url, True
    # fallback: 전체 문자열에서 재탐색
    for keys, canon, url in MAP:
        for k in keys:
            if k and k in affil_full:
                return canon, url, False
    return None, EBS_GENERIC, False

with io.open(SEED_JSON, encoding='utf-8') as f:
    seed = json.load(f)

n_updated = 0
n_fallback = 0
unmatched = set()
for d in seed:
    if d.get('hospital') != 'ebs':
        continue
    m = re.search(r'소속:\s*(.*?)\s*\|\s*진료과', d.get('excerpt', ''))
    affil_full = m.group(1).strip() if m else ""
    canon, url, first_hit = match(affil_full)
    if canon is None:
        n_fallback += 1
        unmatched.add(affil_full)
        d['affilHospital'] = affil_full or "미상(EBS 기재 없음)"
        d['reserveUrl'] = EBS_GENERIC
    else:
        parts = [p.strip() for p in re.split(r'\s*/\s*', affil_full) if p.strip()]
        label = affil_full if len(parts) <= 1 else f"{canon} 외 {len(parts)-1}곳 ({affil_full})"
        d['affilHospital'] = label
        d['reserveUrl'] = url
        n_updated += 1
        if url == EBS_GENERIC:
            n_fallback += 1
            unmatched.add(affil_full)

with io.open(SEED_JSON, 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False, indent=1)
    f.write('\n')

print(f"ebs total: {sum(1 for d in seed if d.get('hospital')=='ebs')}")
print(f"matched hospital link: {n_updated}, fallback(EBS): {n_fallback}")
print("UNMATCHED/FALLBACK:")
for u in sorted(unmatched):
    print(" -", u)
