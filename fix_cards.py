import json
import re

with open('../../card_audit_output/physical_card_ocr.json', 'r', encoding='utf-8') as f:
    ocr_cards = json.load(f)

fixes = {}

for c in ocr_cards:
    lines = c['lines']
    joined = "\n".join(lines)
    match = re.search(r'\b([HCN]\d{3})\b', joined)
    if not match:
        continue
    
    card_id = match.group(1)
    
    title = ""
    desc = ""
    
    # Clean OCR common errors
    def clean(t):
        t = t.replace('肌士六=', '股市新訊')
        t = t.replace('2翌', '2點')
        t = t.replace('HA0？', '')
        t = t.replace('。', '。')
        return t.strip()

    if card_id.startswith('H'):
        title_cand = next((l for l in lines if '【' in l), None)
        if title_cand:
            title = title_cand.replace('【', '').replace('】', '')
        else:
            title = lines[1] if len(lines) > 1 else ""
            
        if card_id == 'H003' and not title: title = '特別成就' # from looking at ocr earlier
        
        # for H cards, description isn't shown in the same way, but let's keep it empty unless it's a family milestone
        desc = ""
        if "家庭的重要歷程" in joined:
            desc = "家庭的重要歷程"

    elif card_id.startswith('C') or card_id.startswith('N'):
        title_cand = next((l for l in lines if '【' in l), None)
        if title_cand:
            title = title_cand.replace('【', '').replace('】', '')
            title = clean(title)
        else:
            title = lines[1] if len(lines) > 1 else ""
            
        # extract description: everything after the title, excluding lines that look like prices or stats
        desc_lines = []
        started = False
        for l in lines:
            if l == title_cand or l == title:
                started = True
                continue
            if started:
                # ignore '股票價格', 'A10...', '單間小套房', '房型：'
                if re.match(r'^([A-Z]\d{2}|單間|兩室|三室|五室|小型|中型|大型|房型：|房屋總價：)', l) or '股票價格' in l:
                    break
                # ignore card IDs
                if re.match(r'^[HCN]\d{3}$', l):
                    continue
                # ignore empty
                if not l.strip():
                    continue
                desc_lines.append(l)
        
        desc = "".join(desc_lines)
        desc = clean(desc)

    title = clean(title)
    
    if title:
        fixes[card_id] = {
            'title': title,
            'desc': desc
        }

with open('card_fixes.json', 'w', encoding='utf-8') as f:
    json.dump(fixes, f, ensure_ascii=False, indent=2)

