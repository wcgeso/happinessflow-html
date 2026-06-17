import json
import re

with open('../../card_audit_output/physical_card_ocr.json', 'r', encoding='utf-8') as f:
    ocr_cards = json.load(f)

fixes = {}

def clean(t):
    t = t.replace('肌士六=', '股市新訊')
    t = t.replace('2翌', '2點')
    t = t.replace('HA0？', '')
    t = t.replace('臺', '台')
    return t.strip()

for c in ocr_cards:
    lines = c['lines']
    joined = "\n".join(lines)
    match = re.search(r'\b([HCN]\d{3})\b', joined)
    if not match:
        continue
    
    card_id = match.group(1)
    
    title = ""
    desc = ""
    
    if card_id.startswith('H'):
        title_cand = next((l for l in lines if '【' in l), None)
        if title_cand:
            title = title_cand.replace('【', '').replace('】', '')
            # desc is everything after title
            started = False
            desc_lines = []
            for l in lines:
                if l == title_cand:
                    started = True
                    continue
                if started:
                    if re.match(r'^[HCN]\d{3}$', l): continue
                    desc_lines.append(l)
            desc = "".join(desc_lines)
        else:
            if "幸福家庭的重要歷程" in joined:
                title = "幸福家庭的重要歷程"
                # description is everything after "第二個孩子出生" or just the "抽到卡片的玩家..." parts
                desc_lines = []
                started = False
                for l in lines:
                    if "抽到卡片" in l or started:
                        started = True
                        desc_lines.append(l)
                desc = "".join(desc_lines)
            else:
                title = lines[1] if len(lines) > 1 else ""

        if card_id == 'H003' and not title: 
            title = '特別成就'
            
        desc = clean(desc)
        title = clean(title)

    elif card_id.startswith('C') or card_id.startswith('N'):
        title_cand = next((l for l in lines if '【' in l), None)
        if title_cand:
            title = title_cand.replace('【', '').replace('】', '')
            title = clean(title)
        else:
            title = lines[1] if len(lines) > 1 else ""
            
        desc_lines = []
        started = False
        for l in lines:
            if l == title_cand or l == title:
                started = True
                continue
            if started:
                if re.match(r'^([A-Z]\d{2}|單間|兩室|三室|五室|小型|中型|大型|房型：|房屋總價：)', l) or '股票價格' in l:
                    break
                if re.match(r'^[HCN]\d{3}$', l):
                    continue
                if not l.strip():
                    continue
                desc_lines.append(l)
        
        desc = "".join(desc_lines)
        desc = clean(desc)

    title = clean(title)
    
    if title or desc:
        fixes[card_id] = {
            'title': title,
            'desc': desc
        }

with open('card_fixes.json', 'w', encoding='utf-8') as f:
    json.dump(fixes, f, ensure_ascii=False, indent=2)

