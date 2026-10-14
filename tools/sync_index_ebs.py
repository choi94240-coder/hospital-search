# -*- coding: utf-8 -*-
"""seed.json의 reserveUrl/affilHospital을 index.html ebs 항목에 덮어쓰기 동기화."""
import json, re, io

BASE = r'C:\Users\82104\Desktop\work2\work1'
with io.open(BASE + r'\server\seed.json', encoding='utf-8') as f:
    seed = json.load(f)
ebs_map = {d['id']: (d.get('affilHospital', ''), d.get('reserveUrl', '')) for d in seed if d.get('hospital') == 'ebs'}

p = BASE + r'\index.html'
with io.open(p, encoding='utf-8') as f:
    html = f.read()

count = 0
def repl(m):
    global count
    full = m.group(0)
    eid = m.group(1)
    if eid not in ebs_map:
        return full
    affil, url = ebs_map[eid]
    affil_esc = affil.replace('\\', '\\\\').replace('"', '\\"')
    new_full, n = re.subn(r'reserveUrl:"[^"]*",affilHospital:"(?:[^"\\]|\\.)*"',
                          'reserveUrl:"' + url + '",affilHospital:"' + affil_esc + '"', full)
    if n:
        count += 1
        return new_full
    return full

html2 = re.sub(r'\{id:"(ebs\d+)",hospital:"ebs",.*?\}', repl, html, flags=re.DOTALL)
with io.open(p, 'w', encoding='utf-8') as f:
    f.write(html2)
print("synced:", count)
