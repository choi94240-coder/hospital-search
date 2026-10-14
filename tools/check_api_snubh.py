# -*- coding: utf-8 -*-
import json
import time
import urllib.request

for _ in range(20):
    try:
        d = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/doctors', timeout=5))
        break
    except Exception:
        time.sleep(1)
else:
    print('SERVER NOT UP')
    raise SystemExit(1)

docs = d['doctors']
ebs = [x for x in docs if x.get('hospital') == 'ebs']
snubh = [x for x in ebs if x.get('reserveUrl') == 'https://www.snubh.org/index.do']
print('total:', len(docs), 'ebs:', len(ebs), 'snubh-new:', len(snubh))
print('sample:', snubh[0]['id'], snubh[0]['name'], snubh[0].get('affilHospital'))
print('check-log:', d is not None)
logs = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/admin/logs', timeout=5)) if False else None
