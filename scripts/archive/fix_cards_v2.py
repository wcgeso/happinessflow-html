import json
import re
import sys

with open('../../card_audit_output/physical_card_ocr.json', 'r', encoding='utf-8') as f:
    ocr_cards = json.load(f)

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def clean(t):
    t = t.replace('肌士六=', '股市新訊')
    t = t.replace('2翌', '2點')
    t = t.replace('HA0？', '')
    t = t.replace('。', '。')
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
        else:
            title = lines[1] if len(lines) > 1 else ""
            
        if card_id == 'H003' and not title: title = '特別成就'
        title = clean(title)
        
        # update title in cards.ts for H cards
        if title:
            # find { id: 'H001', title: '...', ... }
            pattern = r"(id:\s*['\"]" + card_id + r"['\"],\s*title:\s*['\"])[^'\"]*(['\"])"
            content = re.sub(pattern, r"\g<1>" + title + r"\g<2>", content, count=1)

    elif card_id.startswith('C') or card_id.startswith('N'):
        # For C and N cards, we focus on extracting the description.
        title_cand = next((l for l in lines if '【' in l), None)
        if not title_cand and len(lines) > 1:
            title_cand = lines[1]
            
        desc_lines = []
        started = False
        for l in lines:
            if l == title_cand:
                started = True
                continue
            if started:
                # stop if we hit numbers or specific labels
                if re.match(r'^([A-Z]\d{2}|單間|兩室|三室|五室|小型|中型|大型|房型：|房屋總價：|代號|股票價格)', l) or '股票價格' in l or 'H' in l:
                    # wait, some descriptions have H in them, like C cards!
                    # For C cards, they have text like "向銀行支付2,000H。" in the description!
                    if card_id.startswith('N'):
                        break
                    else:
                        pass # For C cards, keep reading until we hit something else? Actually C cards OCR ends after the description.
                if re.match(r'^[HCN]\d{3}$', l):
                    continue
                if not l.strip():
                    continue
                desc_lines.append(l)
        
        desc = "".join(desc_lines)
        desc = clean(desc)
        
        # for C cards, let's also try to update the title since they are like "衝動消費買包包"
        if card_id.startswith('C') and title_cand:
            c_title = clean(title_cand.replace('【', '').replace('】', ''))
            if c_title != '特殊的事件':
                pass # keep as is or update? The code already has good titles like "拾金不昧". The OCR title is "特殊的事件".
                # wait, for C cards, OCR title is ALWAYS "特殊的事件". The real title is the first line of desc!
                if len(desc_lines) > 0:
                    real_title = desc_lines[0].replace('。', '')
                    # update title
                    pattern = r"(id:\s*['\"]" + card_id + r"['\"],\s*title:\s*['\"])[^'\"]*(['\"])"
                    content = re.sub(pattern, r"\g<1>" + real_title + r"\g<2>", content, count=1)
                    # desc is the rest
                    desc = "".join(desc_lines[1:])
                    desc = clean(desc)
        
        if desc:
            # We want to add or replace the description field in cards.ts!
            # The object might not have a description field.
            # Example: { id: 'N029', type: 'real_estate', title: '...', ... }
            # We can insert description: '...', after title: '...',
            
            # Check if it already has a description
            has_desc = re.search(r"id:\s*['\"]" + card_id + r"['\"].*?description:\s*['\"][^'\"]*['\"]", content, flags=re.DOTALL)
            if has_desc:
                # Replace existing description. But wait, regex with DOTALL is risky on a large file.
                pass
            
            # Safer: find the line with id: 'N029' and insert description: 'desc', after title: '...',
            pattern = r"(id:\s*['\"]" + card_id + r"['\"].*?title:\s*['\"][^'\"]*['\"])(,?)"
            content = re.sub(pattern, r"\g<1>, description: '" + desc + "'", content, count=1)

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)

