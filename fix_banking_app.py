with open('src/components/banking/BankingAppModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix height: change max-h-[90vh] to fixed h-[90vh] md:h-[650px]
content = content.replace("max-h-[90vh]", "h-[90vh] md:h-[650px]")
content = content.replace("overflow-y-auto", "overflow-y-auto no-scrollbar")

with open('src/components/banking/BankingAppModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
