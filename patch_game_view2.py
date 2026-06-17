import re

with open('src/views/game/GameView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix PaydayModal onClose to executePayday
old_payday = """                    onClose={() => {
                        setShowPaydayModal(false);
                        setPaydayStep('confirm');
                    }}"""
new_payday = """                    onClose={() => {
                        if (paydayStep === 'confirm') {
                            executePayday();
                        }
                        setShowPaydayModal(false);
                        setPaydayStep('confirm');
                    }}"""
content = content.replace(old_payday, new_payday)

# 2. Fix handleTransaction to setBoardFinancialAction
old_handle_tx = """    const handleTransaction = (data: any) => {
        if (handleTransactionSubmit(data)) {
            // 只有一般交易才關閉視窗，股市漲幅等需要留在 Phase 3 的則由元件內部控制或不在此處關閉
            // 這裡判斷：如果是股市漲跌更新，則不立即關閉，讓 TransactionForm 顯示 Phase 3
            if (data.usage === 'stock_update' && data.stockFluctuationPayload) {
                // 不關閉，讓 TransactionForm 顯示成功畫面
                return;
            }
            setShowTransactionModal(false);
            setTransactionQuickPreset(null);
        }
    };"""

new_handle_tx = """    const handleTransaction = (data: any) => {
        setBoardFinancialAction({
            kind: 'financial',
            label: '確認交易內容',
            txData: data,
            expectedEntries: []
        });
        setShowTransactionModal(false);
        setTransactionQuickPreset(null);
    };"""
content = content.replace(old_handle_tx, new_handle_tx)

# 3. Fix market button "更新中" logic
old_market_btn = """                                        onClick={() => setShowStockMarketModal(true)}
                                        disabled={isApplyingBoardMarket || isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isApplyingBoardMarket ? '更新中...' : '前往交易'}
                                    </button>
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}"""

new_market_btn = """                                        onClick={() => setShowStockMarketModal(true)}
                                        disabled={isActiveBoardCardHandled}
                                        className="rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        前往交易
                                    </button>
                                    <button
                                        onClick={markBoardCardHandled}
                                        disabled={isActiveBoardCardHandled}"""
content = content.replace(old_market_btn, new_market_btn)

with open('src/views/game/GameView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
