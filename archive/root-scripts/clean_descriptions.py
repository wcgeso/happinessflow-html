import re

def clean_desc(desc):
    # Happiness story
    desc = re.sub(r'抽到卡片的玩家，跟.*?就能獲得幸福值\s*\d+\s*點。?', '', desc)
    # Happiness cost
    desc = re.sub(r'抽到卡片的玩家，自由決定是否要花費.*?，.*?來獲得幸福點\s*\d+\s*點。?', '', desc)
    # Opportunity purchase
    desc = re.sub(r'購買者願意以一間.*?的價格購買，擁有.*?的所有玩家，都可以自由決定是否依此價格出售.*?仍有房屋貸款者，所得款項須要先行扣除貸款金額。?[个-]*', '', desc)
    desc = re.sub(r'購買者願意以高於房屋總價.*?的價格購買，擁有.*?的所有玩家，都可以自由決定是否依此價.?[格]?出售。?頁?出售後取消其租金收入，仍有房屋貸款者，所得款項須要先行扣除貸款金額。?', '', desc)
    # H021
    if "在頂級的餐廳用餐" in desc:
        desc = "一場溫馨快樂的家庭聚會無價！"
    
    # Clean up empty lines and trailing spaces
    return desc.strip()

with open('src/constants/cards.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    prefix = match.group(1)
    quote = match.group(2)
    text = match.group(3)
    suffix = match.group(4)
    cleaned = clean_desc(text)
    return f"{prefix}{quote}{cleaned}{suffix}"

content = re.sub(r'(description:\s*)([\'"`])(.*?)([\'"`]\s*[,}])', replacer, content, flags=re.DOTALL)

with open('src/constants/cards.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleaned!")
