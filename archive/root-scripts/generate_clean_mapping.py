import json
import re

with open('../../card_audit_output/physical_card_ocr.json', 'r', encoding='utf-8') as f:
    ocr_cards = json.load(f)

# Extract card text cleanly
clean_map = {}
for c in ocr_cards:
    text = '\n'.join(c['lines'])
    match = re.search(r'\b([HCN]\d{3})\b', text)
    if not match:
        continue
    
    card_id = match.group(1)
    lines = c['lines']
    
    # Very basic heuristic for title and description
    title = ""
    desc = ""
    
    if card_id.startswith('H'):
        # For H cards, usually lines[1] or lines[2] is the title in brackets
        title_cand = next((l for l in lines if '【' in l), None)
        if title_cand:
            title = title_cand.replace('【', '').replace('】', '')
        else:
            title = lines[1] if len(lines) > 1 else ""
            
        desc = "" # Description is usually the rest, but let's leave empty if hard
        
    elif card_id.startswith('N') or card_id.startswith('C'):
        # Usually title is lines[1] and desc is lines[2:]
        title_cand = next((l for l in lines if '【' in l), None)
        if title_cand:
            title = title_cand.replace('【', '').replace('】', '').replace('肌士六=', '股市新訊')
        else:
            title = lines[1] if len(lines) > 1 else ""
            
    clean_map[card_id] = {
        'ocr_raw': lines[:6]
    }

with open('clean_map.json', 'w', encoding='utf-8') as f:
    json.dump(clean_map, f, ensure_ascii=False, indent=2)

