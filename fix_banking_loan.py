with open('src/components/banking/BankingView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change usage from 'loan' to 'cash' and source to 'loan'
old_borrow = """      onTransaction({
        name: '信用貸款',
        amount: amount,
        cashChange: amount,
        usage: 'loan',
        liabilityChange: {"""

new_borrow = """      onTransaction({
        name: '信用貸款',
        amount: amount,
        cashChange: amount,
        source: 'loan',
        usage: 'cash',
        liabilityChange: {"""
content = content.replace(old_borrow, new_borrow)

with open('src/components/banking/BankingView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
