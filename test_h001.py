import json
with open('../../card_audit_output/physical_card_ocr.json', 'r', encoding='utf-8') as f:
    ocr_cards = json.load(f)

for c in ocr_cards:
    if any('H001' in l for l in c['lines']):
        print(c['lines'])
