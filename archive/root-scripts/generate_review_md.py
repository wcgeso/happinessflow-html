import json

with open('project_cards_0611.json', 'r', encoding='utf-8') as f:
    project_cards = json.load(f)

with open('card_fixes.json', 'r', encoding='utf-8') as f:
    fixes = json.load(f)

with open('card_review.md', 'w', encoding='utf-8') as out:
    out.write("# 卡片 OCR 校對檔\n\n")
    out.write("這份清單列出了即將從「實體卡片圖片 OCR」套用到「遊戲程式」中的文字變更。\n")
    out.write("請您幫忙檢查 **新標題** 與 **新敘述** 是否有 OCR 辨識錯誤的地方。\n\n")
    out.write("| 代號 | 舊標題 (程式目前) | 新標題 (將更新為) | 新敘述 (將新增/更新為) |\n")
    out.write("|---|---|---|---|\n")

    for pc in project_cards:
        card_id = pc.get('id')
        if not card_id or card_id not in fixes:
            continue
        
        fix = fixes[card_id]
        new_title = fix['title'].replace('\n', ' ')
        new_desc = fix['desc'].replace('\n', '<br>')
        old_title = pc.get('title', '')
        old_desc = pc.get('description', '')
        
        # Only show if there's a difference
        # But wait, we want to show all proposed fixes so user can review the OCR quality
        if new_title or new_desc:
            out.write(f"| **{card_id}** | {old_title} | {new_title if new_title else '(保留原標題)'} | {new_desc if new_desc else '(無)'} |\n")

