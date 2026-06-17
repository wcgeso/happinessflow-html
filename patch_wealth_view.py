with open('src/components/banking/WealthView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rename 終身醫療險 to 醫療險
content = content.replace("終身醫療險", "醫療險")

# 2. Update handleBuyInsurance payload (cash cost 0, expense 2000)
old_buy = """  const handleBuyInsurance = () => {
    onTransaction({
      name: '購買醫療保險',
      amount: insuranceCost,
      cashChange: -insuranceCost,
      source: 'cash',
      usage: 'insurance',
      insuranceChange: 1
    });
  };"""

new_buy = """  const handleBuyInsurance = () => {
    onTransaction({
      name: '購買醫療險',
      amount: 0,
      cashChange: 0,
      source: 'cash',
      usage: 'insurance',
      insuranceType: 'medical',
      insurancePayload: { medicalQty: 1 },
      expensePayload: { category: 'otherMedicalChild', amount: 2000, isIncrease: true }
    });
  };"""
content = content.replace(old_buy, new_buy)

# 3. Update the UI text and disable logic
old_ui = """              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">購買費用 (月薪的 10%)</span>
                <span className="text-2xl font-black text-white">${insuranceCost.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleBuyInsurance}
              disabled={cash < insuranceCost}
              className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all ${
                cash < insuranceCost
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]'
              }`}
            >
              確認購買保險"""

new_ui = """              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">購買費用 (月支出增加)</span>
                <span className="text-2xl font-black text-white">$2,000</span>
              </div>
            </div>

            <button
              onClick={handleBuyInsurance}
              disabled={medicalInsuranceCount >= 1}
              className={`w-full py-4 rounded-2xl font-black tracking-widest text-[16px] transition-all ${
                medicalInsuranceCount >= 1
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]'
              }`}
            >
              {medicalInsuranceCount >= 1 ? '已達購買上限 (1份)' : '確認購買保險'}"""
content = content.replace(old_ui, new_ui)

with open('src/components/banking/WealthView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
