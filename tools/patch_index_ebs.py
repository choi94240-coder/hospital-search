# -*- coding: utf-8 -*-
"""index.html 내 SEED_DOCTORS의 ebs 항목에 reserveUrl/affilHospital 동기화 + UI 렌더링 개선."""
import json, re, io

BASE = r'C:\Users\82104\Desktop\work2\work1'
with io.open(BASE + r'\server\seed.json', encoding='utf-8') as f:
    seed = json.load(f)
ebs_map = {d['id']: (d.get('affilHospital', ''), d.get('reserveUrl', '')) for d in seed if d.get('hospital') == 'ebs'}

p = BASE + r'\index.html'
with io.open(p, encoding='utf-8') as f:
    html = f.read()

# 1) ebs 항목에 reserveUrl/affilHospital 주입 (멱등)
count = 0
def repl(m):
    global count
    full = m.group(0)
    eid = m.group(1)
    if eid not in ebs_map:
        return full
    affil, url = ebs_map[eid]
    if 'reserveUrl' in full:
        return full
    count += 1
    affil_esc = affil.replace('\\', '\\\\').replace('"', '\\"')
    # verifiedAt:SEED_DATE,status:"활성",demo:false} 로 끝나는 패턴에 필드 추가
    tail = 'verifiedAt:SEED_DATE,status:"활성",demo:false,reserveUrl:"' + url + '",affilHospital:"' + affil_esc + '"}'
    return full.replace('verifiedAt:SEED_DATE,status:"활성",demo:false}', tail)

html2, n = re.subn(r'\{id:"(ebs\d+)",hospital:"ebs",.*?\}', repl, html, flags=re.DOTALL)
print("injected:", count)

# 2) LSKEY v8 -> v9 (로컬 캐시된 구시드 갱신)
html2 = html2.replace('const LSKEY="univ_hosp_mvp_v8"', 'const LSKEY="univ_hosp_mvp_v9"')
html2 = html2.replace('공식 홈페이지 조사 기반 시드 791명 로드', '공식 홈페이지 조사 기반 시드 791명 로드(기타병원 소속병원 예약링크 포함)')

# 3) docCard: ebs는 소속병원 예약 링크 사용
old_card = '''<div class="row" style="margin-top:8px"><button class="btn sm" onclick="openDetail('${d.id}')">상세 보기</button>${d.profileUrl?`<a class="btn sm ghost" style="text-decoration:none;padding:7px 11px" href="${esc(d.profileUrl)}" target="_blank" rel="noopener">공식 프로필 보기</a>`:""}<a class="btn sm ghost" style="text-decoration:none;padding:7px 11px" href="${esc((HOSPITALS.find(h=>h.id===d.hospital)||{}).reserve||"#")}" target="_blank" rel="noopener">공식 예약 페이지</a></div></div>`;'''
new_card = '''<div class="row" style="margin-top:8px"><button class="btn sm" onclick="openDetail('${d.id}')">상세 보기</button>${d.profileUrl?`<a class="btn sm ghost" style="text-decoration:none;padding:7px 11px" href="${esc(d.profileUrl)}" target="_blank" rel="noopener">공식 프로필 보기</a>`:""}<a class="btn sm ghost" style="text-decoration:none;padding:7px 11px" href="${esc(d.reserveUrl||(HOSPITALS.find(h=>h.id===d.hospital)||{}).reserve||"#")}" target="_blank" rel="noopener" title="${esc(d.affilHospital||"")}">소속병원 예약${d.hospital==="ebs"&&d.affilHospital?` · ${esc(d.affilHospital.length>28?d.affilHospital.slice(0,28)+"…":d.affilHospital)}`:""}</a></div>${d.hospital==="ebs"&&d.affilHospital?`<div class="small muted" style="margin-top:6px">소속(엑셀 기재): ${esc(d.affilHospital)} · 병원급 공식 예약 링크(이름별 연결, 개인 프로필 아님)</div>`:""}</div>`;'''
assert old_card in html2, "docCard pattern not found"
html2 = html2.replace(old_card, new_card)

# 4) openDetail: ebs 소속병원 예약 행 추가
old_src = '''<tr><th>공식 출처</th><td>${d.profileUrl?`<a href="${esc(d.profileUrl)}" target="_blank" rel="noopener">${esc(d.profileUrl)}</a>`:"없음"}<br><span class="small muted">발췌: ${esc(d.excerpt||"없음")} · 검증: ${esc(d.verified||"검증 필요")} · 최종확인: ${esc(d.verifiedAt||"없음")}</span></td></tr>${d.ebs?`<tr><th>EBS명의 출연</th><td>${esc(d.ebs)}</td></tr>`:""}</table>'''
new_src = '''<tr><th>공식 출처</th><td>${d.profileUrl?`<a href="${esc(d.profileUrl)}" target="_blank" rel="noopener">${esc(d.profileUrl)}</a>`:"없음(병원급 링크로 대체)"}<br><span class="small muted">발췌: ${esc(d.excerpt||"없음")} · 검증: ${esc(d.verified||"검증 필요")} · 최종확인: ${esc(d.verifiedAt||"없음")}</span></td></tr>${d.hospital==="ebs"?`<tr><th>소속병원 예약</th><td>${d.reserveUrl?`<a href="${esc(d.reserveUrl)}" target="_blank" rel="noopener">${esc(d.reserveUrl)}</a>`:"없음"}<br><span class="small muted">소속(엑셀 기재): ${esc(d.affilHospital||hospName(d.hospital))} · 이름별 병원 홈페이지 공식 예약 링크(개인 프로필 URL 아님)</span></td></tr>`:""}${d.ebs?`<tr><th>EBS명의 출연</th><td>${esc(d.ebs)}</td></tr>`:""}</table>'''
assert old_src in html2, "openDetail pattern not found"
html2 = html2.replace(old_src, new_src)

# 5) renderHosp: ebs 탭 안내 문구
old_else = '''}else{
byDept=DEPTS.map(dp=>{const l=docs.filter(d=>d.dept===dp);if(!l.length)return"";'''
new_else = '''}else if(curHosp==="ebs"){
byDept=`<div class="alert blue small">기타병원(EBS명의) ${docs.length}명 — 각 의료진 카드의 <b>소속병원 예약</b> 버튼이 엑셀 기재 소속 병원의 <b>공식 홈페이지 예약 페이지</b>로 이름별로 연결됩니다. 개인 프로필 URL이 아닌 병원급 공식 링크이며, 출처 미검증(<span class="kbd">검증 필요</span>) 상태입니다. 진료 가능 여부는 해당 병원 페이지에서 이름을 검색해 확인하세요.</div>`+DEPTS.map(dp=>{const l=docs.filter(d=>d.dept===dp);if(!l.length)return"";'''
assert old_else in html2, "renderHosp else pattern not found"
html2 = html2.replace(old_else, new_else)

with io.open(p, 'w', encoding='utf-8') as f:
    f.write(html2)
print("index.html updated OK")
