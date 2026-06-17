import { HAPPINESS_CARD_MAP, NEWS_CARD_MAP, OPPORTUNITY_CARD_MAP } from '../constants/cards';
import { BoardCardResult, GameState } from '../types';
import { getFamilyMilestoneStageByCardId, getFamilyMilestoneStatus } from './familyMilestones';

export const hydrateBoardCardResult = (card: BoardCardResult | null, gameState: GameState): BoardCardResult | null => {
  if (!card) return null;

  const happinessCard = HAPPINESS_CARD_MAP[card.cardId];
  if (happinessCard?.category === '家庭重要歷程') {
    const stage = getFamilyMilestoneStageByCardId(card.cardId);
    const familyMilestoneStatus = getFamilyMilestoneStatus(gameState);

    return {
      ...card,
      title: stage?.label.replace(/^\d+\.\s*/, '') || happinessCard.title,
      description: happinessCard.description || '家庭重要歷程事件。',
      familyMilestoneStatus,
      effectLines: [
        ...(happinessCard.otherPlayersCanJoin ? [`其他玩家可擲骰加入（至少 ${happinessCard.joinDiceMin || 0} 點）`] : []),
        ...(happinessCard.requiresStorySharing ? ['需要玩家分享故事'] : [])
      ]
    };
  }

  const newsCard = NEWS_CARD_MAP[card.cardId];
  if (newsCard) {
    if (newsCard.type === 'real_estate') {
      return {
        ...card,
        description: newsCard.description || '請依房市卡內容選擇自用或出租購買。',
        effectLines: [
          `總價：${newsCard.totalPrice.toLocaleString()}`,
          `頭期款：${newsCard.downPayment.toLocaleString()}`,
          `貸款：${newsCard.loanAmount.toLocaleString()}`,
          `貸款利息（月）：${newsCard.monthlyPayment.toLocaleString()}`,
          `租金收入（月）：${newsCard.rent.toLocaleString()}`,
          `淨收益（月）：${newsCard.netRentIncome > 0 ? '+' : ''}${newsCard.netRentIncome.toLocaleString()}`,
          ...(newsCard.canSelfUse ? [`自用幸福：+${newsCard.happinessBonus}`] : [])
        ]
      };
    }

    if (newsCard.type === 'small_business') {
      return {
        ...card,
        description: newsCard.description || '兼職工作室貸款專案。所有玩家皆可申請。',
        effectLines: [
          `投資金額：${newsCard.investmentPerMonth.toLocaleString()}`,
          `貸款金額：${newsCard.loanAmount.toLocaleString()}`,
          `企業貸款利息（月）：-${newsCard.interestPerMonth.toLocaleString()}`
        ]
      };
    }

    if (newsCard.type === 'large_enterprise') {
      return {
        ...card,
        description: newsCard.description || '大型企業投資機會。所有玩家皆可投資。',
        assetSymbol: newsCard.businessName,
        effectLines: [
          `最高投資額度：${newsCard.maxInvestment.toLocaleString()}`,
          `投資報酬率：每投資 1,000,000，月收益 +${newsCard.monthlyReturnPerMillion.toLocaleString()}`
        ]
      };
    }

    if (newsCard.type === 'cash_dividend') {
      return {
        ...card,
        description: newsCard.description || '系統將自動根據您持有的股票發放現金股利。',
        effectLines: Object.entries(newsCard.dividendPerShare).map(([code, dps]) =>
          `${code}：每張配發 ${(dps * 100).toLocaleString()}`
        )
      };
    }

    if (newsCard.type === 'stock_dividend') {
      return {
        ...card,
        description: newsCard.description || '系統將自動根據您持有的股票發放股票股息。',
        effectLines: Object.entries(newsCard.dividendRate).map(([code, rate]) =>
          `${code}：配股率 ${(rate * 100).toLocaleString()}%`
        )
      };
    }
  }

  const oppCard = OPPORTUNITY_CARD_MAP[card.cardId];
  if (oppCard && card.deck === 'opportunity') {
    return {
      ...card,
      subtitle: oppCard.category || '',
      description: oppCard.description,
    };
  }

  return card;
};

