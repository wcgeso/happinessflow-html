import fs from 'fs';
import { HAPPINESS_CARDS, OPPORTUNITY_CARDS, NEWS_CARDS } from './src/constants/cards';

const buildHappinessCardMeta = (cardId: string) => {
    const card = HAPPINESS_CARDS.find(item => item.id === cardId);
    if (!card) return null;
    return {
        deck: 'happiness' as const,
        title: card.title,
        subtitle: card.type,
        description: card.description || '請依幸福卡內容進行結算。',
        effectLines: [
            ...(card.diceRequirement ? [`判定需求：至少 ${card.diceRequirement} 點`] : []),
            ...(card.happinessPoints ? [`幸福 +${card.happinessPoints}`] : []),
            ...(card.cost ? [`費用 ${card.cost.toLocaleString()}`] : []),
            ...(card.investmentTarget ? [`投資標的 ${card.investmentTarget}`] : []),
            ...(card.investmentAmount ? [`投資金額 ${card.investmentAmount.toLocaleString()}`] : []),
            ...(card.annualReturn ? [`年報酬率 ${card.annualReturn}%`] : []),
            ...(card.cashLoss ? [`現金 -${card.cashLoss.toLocaleString()}`] : []),
            ...(card.cashGain ? [`現金 +${card.cashGain.toLocaleString()}`] : [])
        ]
    };
};

const buildOpportunityCardMeta = (cardId: string) => {
    const card = OPPORTUNITY_CARDS.find(item => item.id === cardId);
    if (!card) return null;
    return {
        deck: 'opportunity' as const,
        title: card.title,
        subtitle: card.type,
        description: card.description,
        effectLines: [
            ...(card.schoolFee ? [`學費 ${card.schoolFee.toLocaleString()}`] : []),
            ...(card.diceRequirement ? [`判定需求：至少 ${card.diceRequirement} 點`] : []),
            ...(card.purchasePrice ? [`價格 ${card.purchasePrice.toLocaleString()}`] : []),
            ...(card.purchasePercent ? [`成交比例 ${card.purchasePercent}%`] : []),
            ...(card.acquisitionMultiple ? [`收購倍率 ${card.acquisitionMultiple} 倍月收益`] : []),
            ...(card.cashLoss ? [`現金 -${card.cashLoss.toLocaleString()}`] : []),
            ...(card.cashGain ? [`現金 +${card.cashGain.toLocaleString()}`] : []),
            ...(card.monthlyExpenseChange ? [`月支出 ${card.monthlyExpenseChange > 0 ? '+' : ''}${card.monthlyExpenseChange.toLocaleString()}`] : []),
            ...(card.happinessLoss ? [`幸福 -${card.happinessLoss}`] : []),
            ...(card.missRounds ? [`暫停 ${card.missRounds} 回合`] : []),
            ...(card.drawCard ? [`再抽一張${card.drawCard === 'happiness' ? '幸福' : '新聞'}卡`] : []),
            ...(card.affectsAllPlayers ? ['影響全部玩家'] : []),
            ...(card.requiresStorySharing ? ['需要完成口頭分享'] : [])
        ]
    };
};

const buildNewsCardMeta = (cardId: string) => {
    const card = NEWS_CARDS.find(item => item.id === cardId);
    if (!card) return null;

    if (card.type === 'real_estate') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '請依房市卡內容選擇自用或出租購買。',
            effectLines: [
                `總價：${card.totalPrice?.toLocaleString() || ''}`,
                `頭期款：${card.downPayment?.toLocaleString() || ''}`,
                `貸款：${card.loanAmount?.toLocaleString() || ''}`,
                `貸款利息（月）：${card.monthlyPayment?.toLocaleString() || ''}`,
                `租金收入（月）：${card.rent?.toLocaleString() || ''}`,
                `淨租金（月）：${card.netRentIncome > 0 ? '+' : ''}${card.netRentIncome?.toLocaleString() || ''}`,
                ...(card.canSelfUse ? [`自用幸福：+${card.happinessBonus}`] : [])
            ]
        };
    }

    if (card.type === 'small_business') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '兼職工作室貸款專案。所有玩家皆可申請。',
            effectLines: [
                `投資金額：${card.investmentPerMonth?.toLocaleString() || ''}`,
                `貸款金額：${card.loanAmount?.toLocaleString() || ''}`,
                `企業貸款利息（月）：-${card.interestPerMonth?.toLocaleString() || ''}`
            ]
        };
    }

    if (card.type === 'large_enterprise') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '大型企業投資機會。所有玩家皆可投資。',
            effectLines: [
                `最高投資額度：${card.maxInvestment?.toLocaleString() || ''}`,
                `投資報酬率：每投資 1,000,000，月收益 +${card.monthlyReturnPerMillion?.toLocaleString() || ''}`
            ]
        };
    }

    if (card.type === 'cash_dividend') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '系統將自動根據您持有的股票發放現金股利。',
            effectLines: Object.entries(card.dividendPerShare || {}).map(([code, dps]) =>
                `${code}：每張配發 ${(dps * 100).toLocaleString()}`
            )
        };
    }

    if (card.type === 'stock_dividend') {
        return {
            deck: 'news' as const,
            title: card.title,
            subtitle: card.subtype,
            description: card.description || '系統將自動根據您持有的股票發放股票股息。',
            effectLines: Object.entries(card.dividendRate || {}).map(([code, rate]) =>
                `${code}：配股率 ${(rate * 100).toLocaleString()}%`
            )
        };
    }

    return {
        deck: 'news' as const,
        title: card.title,
        subtitle: card.subtype,
        description: card.description || '請依新聞卡內容進行財務與市場調整。',
        effectLines: [
            ...(card.type === 'stock_price'
                ? Object.entries(card.prices || {}).map(([code, price]) => `${code}：${price.toLocaleString()}`)
                : [])
        ]
    };
};

let output = `# 遊戲卡片抽屜內容總表\n\n`;
output += `這份總表顯示了每一張卡片在**遊戲畫面的抽屜中**，實際會渲染出的「標題」、「副標題」、「卡片說明」與「完整資訊」。\n\n`;

const processCards = (cards, builderFn, categoryName) => {
    output += `## ${categoryName}\n\n`;
    output += `| 代號 | 副標題 | 標題 | 卡片說明 | 完整資訊 |\n`;
    output += `|---|---|---|---|---|\n`;
    
    cards.forEach(c => {
        const meta = builderFn(c.id);
        if (meta) {
            const desc = (meta.description || '').replace(/\n/g, '<br>');
            const effects = (meta.effectLines || []).join('<br>');
            output += `| **${c.id}** | ${meta.subtitle || ''} | ${meta.title || ''} | ${desc || '*(無)*'} | ${effects || '*(無額外條列資訊)*'} |\n`;
        }
    });
    output += `\n`;
};

processCards(HAPPINESS_CARDS, buildHappinessCardMeta, "幸福卡 (Happiness Cards)");
processCards(OPPORTUNITY_CARDS, buildOpportunityCardMeta, "機會卡 (Opportunity Cards)");
processCards(NEWS_CARDS, buildNewsCardMeta, "新聞卡 (News Cards)");

fs.writeFileSync('drawer_content_review.md', output, 'utf-8');
console.log('Done');
