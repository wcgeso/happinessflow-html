import json
import re

def normalize(text):
    if not text:
        return ""
    text = text.replace("臺", "台")
    text = re.sub(r"[\s\u3000]+", "", text)
    text = re.sub(r"[【】〔〕（）()、，。．：:；;！!？?「」『』‧·\-]", "", text)
    return text.lower()

# Load OCR cards
with open('../../card_audit_output/physical_card_ocr.json', 'r', encoding='utf-8') as f:
    ocr_cards = json.load(f)

# Build a mapping of OCR cards by ID
ocr_map = {}
for c in ocr_cards:
    joined = "".join(c['lines'])
    match = re.search(r"([HCN]\d{3})", joined)
    if match:
        ocr_map[match.group(1)] = {
            'text': "\n".join(c['lines']),
            'lines': c['lines']
        }

# Load Project Cards
with open('project_cards_0611.json', 'r', encoding='utf-8') as f:
    project_cards = json.load(f)

discrepancies = []

for pc in project_cards:
    card_id = pc.get('id')
    if not card_id or card_id not in ocr_map:
        continue
    
    ocr_obj = ocr_map[card_id]
    ocr_text = ocr_obj['text']
    norm_ocr = normalize(ocr_text)
    
    title = pc.get('title', '')
    desc = pc.get('description', '')
    
    title_mismatch = normalize(title) not in norm_ocr
    
    desc_mismatch = False
    if desc and normalize(desc) not in norm_ocr:
        # Exclude real estate default descriptions that aren't on card
        if not (card_id.startswith('N') and pc.get('type') == 'real_estate' and desc == '請依房市卡內容選擇是否購買。'):
            desc_mismatch = True

    if title_mismatch or desc_mismatch:
        # Try to find what the OCR title is (usually lines[1] or [2] inside 【】)
        ocr_lines = ocr_obj['lines']
        ocr_title = next((l for l in ocr_lines if '【' in l), ocr_lines[1] if len(ocr_lines)>1 else '')
        
        discrepancies.append({
            'id': card_id,
            'title_mismatch': title_mismatch,
            'desc_mismatch': desc_mismatch,
            'code_title': title,
            'ocr_title': ocr_title,
            'code_desc': desc,
            'ocr_full': "\\n".join(ocr_lines[:5]) + "..."
        })

with open('report.md', 'w', encoding='utf-8') as f:
    f.write("# 卡片比對異常報告\n\n")
    f.write("| 代號 | 程式內標題 | 圖片OCR標題 | 程式內敘述 | 圖片OCR前5行 |\n")
    f.write("|---|---|---|---|---|\n")
    for d in discrepancies:
        f.write(f"| {d['id']} | {d['code_title']} | {d['ocr_title']} | {d['code_desc']} | {d['ocr_full']} |\n")

