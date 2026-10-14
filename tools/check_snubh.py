# -*- coding: utf-8 -*-
import re
t = open('index.html', encoding='utf-8').read()
print('snubh new:', t.count('https://www.snubh.org/index.do'))
print('snubh old bare:', t.count('reserveUrl:"https://www.snubh.org"'))
m = re.search(r'<script>(.*)</script>', t, re.S)
open('C:\\Users\\82104\\AppData\\Local\\Temp\\opencode\\inline2.js', 'w', encoding='utf-8').write(m.group(1))
print('extracted')
