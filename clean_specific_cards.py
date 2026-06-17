import re

def clean_desc(card_id, desc):
    if card_id == 'C034':
        return '某間跨國的商業集團有意併購你所投資的企業。'
    elif card_id == 'C035':
        return '爆發流感事件！你的運氣不好，感染了新型的病毒，必須住院治療。若有購買醫療保險則可申請理賠。'
    elif card_id == 'C036':
        return '食物中毒！你沒有注意飲食安全，不小心食用到不新鮮的食品，造成上吐下瀉，必須住院治療。若有購買醫療保險則可申請理賠。'
    elif card_id == 'C037':
        return '發生意外！你運動時不小心跌倒，撞到了頭，被救護車送到了醫院。若有購買醫療保險則可申請理賠。'
    elif card_id == 'C038':
        return '飛行器被偷！一夜起來，發現你的飛行器被偷了，連忙報案處理。若有買飛行器產物保險則可申請理賠。'
    elif card_id == 'C039':
        return '發生飛禍！開飛行器時使用通訊工具，未注意飛行安全，不小心撞到路旁的大樹，飛行器嚴重受損。若有買保險則可申請理賠。'
    elif card_id == 'C040':
        return '發生飛禍！開飛行器時未注意安全距離，不小心撞到前方的飛行器，造成雙方飛行器嚴重受損。若有買保險則可申請理賠。'
    elif card_id == 'C041':
        return '發生地震造成出租的房子需要修繕！房客向你反應，房屋的外牆出現裂縫，需要修理。若有房屋保險則由保險支付。'
    elif card_id == 'C042':
        return '線路起火！出租住宅的管線起火需重新修繕。若有房屋保險則由保險支付。'
    elif card_id == 'C043':
        return '出租的房子因年久失修需要修繕！房客向你反應，房屋的裝潢需要整修。若有房屋保險則由保險支付。'
    elif card_id == 'C044':
        return '錢包被盜！因為不小心遺失了錢包，需要重新辦理重要證件。'
    elif card_id == 'C045':
        return '因為種植農作物的成本提高，造成食品價格上漲。'
    elif card_id == 'C046':
        return '因為制衣的原物料成本上漲，造成服飾的價格提升。'
    elif card_id == 'C047':
        return '因為能源礦產的減少，造成油價提升。'
    elif card_id == 'C048':
        return '因為整體物價節節上升，提高了日用品的價格。'
    elif card_id == 'C049':
        return '違反交通規則。你因為貪圖方便，沒有遵守交通規則，過馬路闖紅燈被拍到。'
    elif card_id == 'C050':
        return '又在亂花錢！？你發現一款新上市的包包，非常喜歡它，衝動地把它買回家（雖然你已經有三個類似的包包了）。'
    elif card_id == 'C051':
        return '拾金不昧。你撿到了一筆錢，交給警察局後，失主為了感謝你，給了你一筆答謝金。'
    elif card_id == 'C052':
        return '粗心大意。你不小心遺失了鑰匙，找鎖匠來幫忙開鎖和換鎖。'
    elif card_id == 'C053':
        return '熱心助人。你熱心幫助社區清理環境，社區管委會為了感謝你，給你發了一筆獎金。'
    elif card_id == 'C054':
        return '你開始重視環境保護，開始學習並養成如何回收資源的方法或做法。'
    elif card_id == 'C055':
        return '奉獻所得。你願意每一個月固定捐贈一小筆錢，來幫助需要幫助的人們。'
    elif card_id == 'N055':
        return '知名大型遊樂園將建設新館，計畫徵求合夥投資人。'
    elif card_id == 'N056':
        return '最近創業貸款政策推出，提供低利息無擔保的創業貸款。只要擲骰子大於等於5，成功者可使兼職工作室升等為小型企業！'
    elif card_id == 'N058':
        return '最近創業貸款政策推出，提供低利息無擔保的創業貸款。只要擲骰子大於等於5，成功者可使兼職工作室升等為小型企業！'
    return desc

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    prefix = match.group(1)
    card_id = match.group(2)
    middle = match.group(3)
    desc_prefix = match.group(4)
    quote = match.group(5)
    text = match.group(6)
    suffix = match.group(7)
    
    cleaned = clean_desc(card_id, text)
    return f"{prefix}{card_id}{middle}{desc_prefix}{quote}{cleaned}{suffix}"

# Match id: 'XXXX', ... description: '...'
pattern = r"(id:\s*['\"])(C03[4-9]|C04[0-9]|C05[0-6]|N05[568])(['\"].*?)(description:\s*)(['\"`])(.*?)(['\"`]\s*[,}])"
content = re.sub(pattern, replacer, content, flags=re.DOTALL)

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Targeted cleaning done!")
