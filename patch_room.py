import re

with open('src/context/RoomContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# In buildNewsCardMeta:
# We need to rewrite it to handle small_business, large_enterprise, etc. exactly like boardCardDisplay does.
replacement = '''const buildNewsCardMeta = (cardId: string) => {
    const card = NEWS_CARDS.find(item => item.id === cardId);
    if (!card) return null;

    if (card.type === 'real_estate') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: `${card.subtype} ${card.id}`,
            description: card.description || '請依房市卡內容選擇自用或出租購買。',
            effectLines: [
                `代號 ${card.id} ・ ${card.propertyLabel}`,
                `總價：${card.totalPrice.toLocaleString()} H`,
                `頭期款：${card.downPayment.toLocaleString()} H`,
                `貸款：${card.loanAmount.toLocaleString()} H`,
                `貸款利息（月）：${card.monthlyPayment.toLocaleString()} H`,
                `租金收入（月）：${card.rent.toLocaleString()} H`,
                `淨租金（月）：${card.netRentIncome > 0 ? '+' : ''}${card.netRentIncome.toLocaleString()} H`,
                ...(card.canSelfUse ? [`自用幸福：+${card.happinessBonus}`] : [])
            ]
        };
    }

    if (card.type === 'small_business') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: `${card.subtype} ${card.id}`,
            description: card.description || '兼職工作室貸款專案。所有玩家皆可申請。',
            effectLines: [
                `代號 ${card.id} ・ 兼職工作室 ${card.loanAmount}`,
                `貸款金額：${card.loanAmount.toLocaleString()} H`,
                `企業收益（月）：+${card.investmentPerMonth.toLocaleString()} H`,
                `企業貸款利息（月）：-${card.interestPerMonth.toLocaleString()} H`,
                `淨現金流（月）：+${(card.investmentPerMonth - card.interestPerMonth).toLocaleString()} H`
            ]
        };
    }

    if (card.type === 'large_enterprise') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: `${card.subtype} ${card.id}`,
            description: card.description || '大型企業投資機會。所有玩家皆可投資。',
            effectLines: [
                `代號 ${card.id} ・ ${card.businessName}`,
                `最高投資額度：${card.maxInvestment.toLocaleString()} H`,
                `投資報酬率：每投資 1,000,000 H，月收益 +${card.monthlyReturnPerMillion.toLocaleString()} H`
            ]
        };
    }

    if (card.type === 'cash_dividend') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: `${card.subtype} ${card.id}`,
            description: card.description || '系統將自動根據您持有的股票發放現金股利。',
            effectLines: Object.entries(card.dividendPerShare).map(([code, dps]) =>
                `${code}：每張配發 ${(dps * 100).toLocaleString()} H`
            )
        };
    }

    if (card.type === 'stock_dividend') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: `${card.subtype} ${card.id}`,
            description: card.description || '系統將自動根據您持有的股票發放股票股息。',
            effectLines: Object.entries(card.dividendRate).map(([code, rate]) =>
                `${code}：配股率 ${(rate * 100).toLocaleString()}%`
            )
        };
    }

    return {
        deck: 'news' as const,
        title: card.title,
        subtitle: `${card.subtype} ${card.id}`,
        description: (card as any).description || '請依新聞卡內容進行財務與市場調整。',
        effectLines: [
            ...(card.type === 'stock_price'
                ? Object.entries(card.prices).map(([code, price]) => `${code}：${price.toLocaleString()} H`)
                : [])
        ]
    };
};'''

content = re.sub(r'const buildNewsCardMeta = \(cardId: string\) => \{.*?(?=const handleDrawCard)', replacement + '\n\n', content, flags=re.DOTALL)

with open('src/context/RoomContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
