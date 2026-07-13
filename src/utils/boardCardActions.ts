import { REAL_ESTATE_TYPES } from '../constants';
import { getHappinessMonthlyExpenseCategory, getMonthlyExpenseCategoryLabel, getOpportunityMonthlyExpenseCategory, NEWS_CARD_MAP, OPPORTUNITY_CARD_MAP, HAPPINESS_CARD_MAP } from '../constants/cards';
import { AccountEntry, Asset, BatchSellItem, BoardState, GameState, Liability, TransactionData } from '../types';
import { getFamilyMilestoneStageByCardId, getFamilyMilestoneStatus } from './familyMilestones';
import { getBusinessAssetLabel, getRealEstateAssetLabel } from './assetLabels';

/**
 * 單一事實來源：判斷棋盤事件是否還有玩家尚未完成共享回覆
 * （sharedCardPrompt / familyMilestoneJoinPrompt）。
 * 依 docs/gdd/CARD_SYSTEM.md Edge Cases 與 docs/gdd/FAMILY_SYSTEM.md 完成條件，
 * 只要仍有符合資格玩家未回覆，事件就不得結案。
 */
export const hasIncompleteSharedPrompts = (
  boardState: Pick<BoardState, 'sharedCardPrompt' | 'familyMilestoneJoinPrompt'> | null | undefined
): boolean => {
  if (!boardState) return false;

  const sharedPrompt = boardState.sharedCardPrompt;
  if (sharedPrompt && !sharedPrompt.targetPlayerUids.every(uid => !!sharedPrompt.responses?.[uid])) {
    return true;
  }

  const familyPrompt = boardState.familyMilestoneJoinPrompt;
  if (familyPrompt && !familyPrompt.targetPlayerUids.every(uid => !!familyPrompt.responses?.[uid])) {
    return true;
  }

  return false;
};

export interface BoardFinancialAction {
  kind: 'financial';
  label: string;
  txData: TransactionData;
  expectedEntries: AccountEntry[];
  note?: string;
  afterApply?: {
    drawCard?: 'happiness' | 'news';
    affectsAllPlayersExpense?: {
      amount: number;
      category: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
      isIncrease: boolean;
    };
    moveToSquare?: {
      squareType: 'school' | 'hospital' | 'bank';
      skipTurns?: number;
      detail?: string;
    };
  };
}

export interface BoardDirectHappinessAction {
  kind: 'happiness';
  label: string;
  title: string;
  points: number;
  txData: TransactionData;
  note?: string;
}

export interface BoardInstantEffectAction {
  kind: 'effect';
  label: string;
  title: string;
  note?: string;
  afterApply?: {
    drawCard?: 'happiness' | 'news';
  };
}

export interface BoardMarketAction {
  kind: 'market';
  label: string;
  code: string;
  prices: Record<string, number>;
  isBubble: boolean;
  note?: string;
}

export interface BoardAssetSaleCandidate {
  id: string;
  asset: Asset;
  price: number;
  liability?: Liability;
  loanBalance: number;
  netCash: number;
  summary: string;
  selectable: boolean;
  disabledReason?: string;
}

export interface BoardAssetSaleAction {
  kind: 'asset_sale';
  label: string;
  note?: string;
  emptyNote: string;
  confirmLabel: string;
  items: BoardAssetSaleCandidate[];
}

export interface BoardChoiceAction {
  kind: 'choice';
  label: string;
  note?: string;
  options: Array<{
    id: string;
    label: string;
    action: BoardFinancialAction | BoardDirectHappinessAction | BoardInstantEffectAction | { kind: 'dismiss' };
  }>;
}

export interface BoardUnsupportedAction {
  kind: 'unsupported';
  label: string;
  note: string;
}

export interface BoardInvestmentAction {
  kind: 'investment';
  label: string;
  note?: string;
  minAmount: number;
  maxAmount: number;
  step: number;
  defaultAmount: number;
  businessSymbol: string;
  businessName: string;
  monthlyReturnPerStep: number;
}

export type BoardCardActionDefinition =
  | BoardFinancialAction
  | BoardDirectHappinessAction
  | BoardInstantEffectAction
  | BoardMarketAction
  | BoardAssetSaleAction
  | BoardChoiceAction
  | BoardInvestmentAction
  | BoardUnsupportedAction;

const FORCED_OPPORTUNITY_TYPES = new Set([
  'medical',
  'aircraft_damage',
  'property_repair',
  'theft',
  'inflation',
  'penalty'
]);

const extractAssetSymbol = (name: string) => name.match(/[A-Z]\d+/)?.[0];
const stockSymbolFromAssetName = (name: string) => extractAssetSymbol(name) || name.replace('股票 ', '').trim();
const formatAmount = (value: number) => Math.abs(value).toLocaleString();

const hasOwnedHouse = (assets: Asset[]) => assets.some(asset => asset.type === '不動產');
const hasInsuredHouse = (assets: Asset[]) => assets.some(asset => asset.type === '不動產' && asset.isInsured);
const hasOwnedVehicle = (assets: Asset[]) => assets.some(asset => asset.type === '汽車' || asset.type === '飛行器');
const hasInsuredVehicle = (assets: Asset[]) => assets.some(
  asset => (asset.type === '汽車' || asset.type === '飛行器') && asset.isInsured
);

const findRelatedLiability = (asset: Asset, liabilities: Liability[] = []) => {
  const byAssetId = liabilities.find(liability => liability.linkedAssetId === asset.id);
  if (byAssetId) return byAssetId;

  const symbol = extractAssetSymbol(asset.name);
  return liabilities.find(liability =>
    !liability.linkedAssetId && (
      (asset.type === '不動產' && liability.type === '不動產貸款' && symbol && liability.name.includes(symbol)) ||
      (asset.type === '企業' && liability.type === '企業貸款' && symbol && liability.name.includes(symbol)) ||
      ((asset.type === '汽車' || asset.type === '飛行器') && (liability.type === '汽車貸款' || liability.type === '飛行器貸款'))
    )
  );
};

const realEstateKind = (asset: Asset) => {
  const symbol = extractAssetSymbol(asset.name);
  if (symbol && REAL_ESTATE_TYPES[symbol]) return REAL_ESTATE_TYPES[symbol].type;
  if (asset.name.includes('店面')) return 'store';
  return asset.houseType || '';
};

const buildAssetSaleCandidate = (asset: Asset, price: number, liabilities: Liability[], summary: string): BoardAssetSaleCandidate => {
  const liability = findRelatedLiability(asset, liabilities);
  const loanBalance = liability?.totalOwed || 0;
  const netCash = price - loanBalance;

  return {
    id: asset.id,
    asset,
    price,
    liability,
    loanBalance,
    netCash,
    summary,
    selectable: netCash > 0,
    disabledReason: netCash > 0 ? undefined : '收購價不足以清償貸款'
  };
};

const createBatchSaleFinancialAction = (title: string, items: BoardAssetSaleCandidate[]): BoardFinancialAction => {
  const batchSellList: BatchSellItem[] = items.map(item => ({
    asset: item.asset,
    price: item.price,
    liability: item.liability
  }));

  const totalSellPrice = items.reduce((sum, item) => sum + item.price, 0);
  const totalLoanBalance = items.reduce((sum, item) => sum + item.loanBalance, 0);
  const totalCashChange = items.reduce((sum, item) => sum + item.netCash, 0);
  const expectedEntries: AccountEntry[] = [];
  const addExpected = (entry: AccountEntry) => {
    if (!expectedEntries.some(item =>
      item.category === entry.category &&
      item.name === entry.name &&
      item.direction === entry.direction
    )) {
      expectedEntries.push(entry);
    }
  };

  const impacts: string[] = [];
  items.forEach(item => {
    impacts.push(`${item.asset.name} 售價 +${formatAmount(item.price)}`);
    if (item.loanBalance > 0) {
      impacts.push(`${item.asset.name} 清償貸款 -${formatAmount(item.loanBalance)}`);
    }
    impacts.push(`${item.asset.name} 入帳現金 +${formatAmount(item.netCash)}`);

    addExpected({ category: 'Assets', name: item.asset.type === '企業' ? '企業' : '不動產', direction: 'Decrease' });

    if (item.asset.cashflow > 0) {
      addExpected({
        category: 'Income',
        name: item.asset.type === '企業' ? '企業收益' : '租金收入',
        direction: 'Decrease'
      });
    }

    if (item.loanBalance > 0) {
      addExpected({
        category: 'Liabilities',
        name: item.asset.type === '企業' ? '企業貸款' : '不動產貸款',
        direction: 'Decrease'
      });
      addExpected({
        category: 'Expenses',
        name: item.asset.type === '企業' ? '企業貸款利息' : '不動產貸款利息',
        direction: 'Decrease'
      });
    }
  });

  if (totalCashChange !== 0) {
    addExpected({
      category: 'Assets',
      name: '現金',
      direction: totalCashChange > 0 ? 'Increase' : 'Decrease'
    });
  }

  return {
    kind: 'financial',
    label: '進入財務檢核',
    txData: {
      name: title,
      amount: totalSellPrice,
      cashChange: totalCashChange,
      source: 'income',
      usage: 'cash',
      batchSellList,
      impacts
    },
    expectedEntries
  };
};

export const buildBoardAssetSaleFinancialAction = (title: string, items: BoardAssetSaleCandidate[]) => {
  if (items.length === 0) return null;
  return createBatchSaleFinancialAction(title, items);
};

export const isForcedBoardCard = (cardId: string) => {
  const opportunityCard = OPPORTUNITY_CARD_MAP[cardId];
  if (opportunityCard) {
    if (FORCED_OPPORTUNITY_TYPES.has(opportunityCard.type)) return true;
    if (opportunityCard.type === 'reward' && opportunityCard.drawCard && !opportunityCard.choiceRequired) {
      return true;
    }
  }
  return false;
};

export const resolveBoardCardAction = (cardId: string, gameState: GameState): BoardCardActionDefinition => {
  let happinessCard = HAPPINESS_CARD_MAP[cardId];
  if (happinessCard) {
    let familyStage = getFamilyMilestoneStageByCardId(happinessCard.id);
    if (happinessCard.category === '家庭重要歷程') {
      const familyStatus = getFamilyMilestoneStatus(gameState);
      if (familyStatus.currentStageIndex !== -1 && familyStatus.currentStageIndex < familyStatus.stages.length) {
        const stage = familyStatus.stages[familyStatus.currentStageIndex];
        const stageCard = HAPPINESS_CARD_MAP[stage.cardId];
        if (stageCard) {
          happinessCard = stageCard;
          familyStage = getFamilyMilestoneStageByCardId(stage.cardId);
        }
      } else {
        return {
          kind: 'choice',
          label: '選擇是否接受',
          options: [
            {
              id: 'reject',
              label: '關閉 (已完成所有歷程)',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }
    }

    const effectiveCashCost = familyStage?.cashCostAmount ?? happinessCard.cashCost ?? 0;
    const effectiveMonthlyExpenseIncrease =
      familyStage?.monthlyExpenseIncreaseAmount ?? happinessCard.monthlyExpenseIncrease ?? 0;
    const effectiveHappinessPoints = familyStage?.happinessPointsValue ?? happinessCard.happinessPoints;

    const txData: TransactionData = {
      name: `幸福卡：${familyStage ? familyStage.label.replace(/^\d+\.\s*/, '') : happinessCard.title}`,
      amount: effectiveCashCost,
      cashChange: -effectiveCashCost,
      source: 'cash',
      usage: 'happiness_event',
      happinessEventPayload: {
        id: familyStage?.progressId || happinessCard.id,
        name: familyStage ? familyStage.label.replace(/^\d+\.\s*/, '') : happinessCard.title,
        amount: effectiveCashCost,
        points: effectiveHappinessPoints,
        monthlyExpenseChange: effectiveMonthlyExpenseIncrease || null,
        expenseCategory: familyStage?.progressId?.startsWith('child')
          ? 'otherMedicalChild'
          : getHappinessMonthlyExpenseCategory(happinessCard.id),
        progressId: familyStage?.progressId,
        happinessItemId: familyStage?.happinessId,
        sourceCardId: happinessCard.id
      },
      impacts: [
        ...(effectiveCashCost ? [`現金 -${effectiveCashCost.toLocaleString()}`] : []),
        ...(effectiveMonthlyExpenseIncrease ? [`${getMonthlyExpenseCategoryLabel(
          familyStage?.progressId?.startsWith('child')
            ? 'otherMedicalChild'
            : getHappinessMonthlyExpenseCategory(happinessCard.id)
        )}月支出 +${effectiveMonthlyExpenseIncrease.toLocaleString()}`] : []),
        `幸福點數 +${effectiveHappinessPoints} 點`
      ]
    };

    const expectedEntries: AccountEntry[] = [];
    if (effectiveCashCost) {
      expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
    }
    if (effectiveMonthlyExpenseIncrease) {
      expectedEntries.push({
        category: 'Expenses',
        name: getMonthlyExpenseCategoryLabel(
          familyStage?.progressId?.startsWith('child')
            ? 'otherMedicalChild'
            : getHappinessMonthlyExpenseCategory(happinessCard.id)
        ),
        direction: 'Increase'
      });
    }

    const happinessAcceptAction: BoardFinancialAction | BoardDirectHappinessAction = expectedEntries.length > 0
      ? {
          kind: 'financial',
          label: '進入財務檢核',
          txData,
          expectedEntries
        }
      : {
          kind: 'happiness',
          label: '接受',
          title: happinessCard.title,
          points: effectiveHappinessPoints,
          txData
        };

    if (happinessCard.category === '家庭重要歷程') {
      return {
        kind: 'choice',
        label: '選擇是否接受',
        options: [
          {
            id: 'accept',
            label: '接受',
            action: {
              kind: 'financial',
              label: '進入財務檢核',
              txData,
              expectedEntries
            }
          },
          {
            id: 'reject',
            label: '不接受',
            action: { kind: 'dismiss' }
          }
        ]
      };
    }

    if (expectedEntries.length > 0) {
      return {
        kind: 'choice',
        label: '選擇是否接受',
        options: [
          {
            id: 'accept',
            label: '接受',
            action: happinessAcceptAction
          },
          {
            id: 'reject',
            label: '不接受',
            action: { kind: 'dismiss' }
          }
        ]
      };
    }

    return happinessAcceptAction;
  }

  const opportunityCard = OPPORTUNITY_CARD_MAP[cardId];
  if (opportunityCard) {
    if (opportunityCard.type === 'property_repair') {
      if (!hasOwnedHouse(gameState.assets)) {
        return {
          kind: 'choice',
          label: '確認卡片',
          note: '你目前沒有持有房屋，這張卡本次不會產生付款效果。',
          options: [
            {
              id: 'dismiss',
              label: '關閉',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }

      if (hasInsuredHouse(gameState.assets)) {
        return {
          kind: 'choice',
          label: '確認卡片',
          note: '你目前持有房屋保險，本次修繕費由保險支付，不需另外付款。',
          options: [
            {
              id: 'dismiss',
              label: '關閉',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }
    }

    if (opportunityCard.type === 'aircraft_damage') {
      if (!hasOwnedVehicle(gameState.assets)) {
        return {
          kind: 'choice',
          label: '確認卡片',
          note: '你目前沒有持有汽車，這張卡本次不會產生付款效果。',
          options: [
            {
              id: 'dismiss',
              label: '關閉',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }

      if (hasInsuredVehicle(gameState.assets)) {
        return {
          kind: 'choice',
          label: '確認卡片',
          note: '你目前持有汽車保險，本次損失由保險支付，不需另外付款。',
          options: [
            {
              id: 'dismiss',
              label: '關閉',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }
    }

    if (
      opportunityCard.affectsAllPlayers &&
      !['purchase_1room', 'purchase_any_house', 'purchase_store', 'purchase_startup', 'enterprise_acquisition'].includes(opportunityCard.type)
    ) {
      if (opportunityCard.monthlyExpenseChange) {
        const category = getOpportunityMonthlyExpenseCategory(opportunityCard.id);
        const isIncrease = opportunityCard.monthlyExpenseChange > 0;
        return {
          kind: 'financial',
          label: '進入財務檢核',
          txData: {
            name: `機運卡：${opportunityCard.title}`,
            amount: Math.abs(opportunityCard.monthlyExpenseChange),
            cashChange: 0,
            source: 'income',
            usage: 'expense_update',
            expensePayload: {
              category,
              amount: Math.abs(opportunityCard.monthlyExpenseChange),
              isIncrease
            },
            impacts: [
              `${getMonthlyExpenseCategoryLabel(category)}月支出 ${isIncrease ? '+' : '-'}${Math.abs(opportunityCard.monthlyExpenseChange).toLocaleString()}`,
              ...(opportunityCard.drawCard ? [`抽取一張${opportunityCard.drawCard === 'happiness' ? '幸福卡' : '新聞卡'}`] : [])
            ]
          },
          expectedEntries: [{
            category: 'Expenses',
            name: getMonthlyExpenseCategoryLabel(category),
            direction: isIncrease ? 'Increase' : 'Decrease'
          }],
          afterApply: {
            affectsAllPlayersExpense: {
              amount: Math.abs(opportunityCard.monthlyExpenseChange),
              category,
              isIncrease
            },
            ...(opportunityCard.drawCard ? { drawCard: opportunityCard.drawCard } : {})
          }
        };
      }

      return {
        kind: 'unsupported',
        label: '需多人處理',
        note: '這張卡會影響全體玩家，建議由執行師或主持人統一處理。'
      };
    }

    if (opportunityCard.type === 'reward' && opportunityCard.drawCard) {
      const hasCashDelta = !!(opportunityCard.cashLoss || opportunityCard.cashGain);
      if (!hasCashDelta && !opportunityCard.monthlyExpenseChange) {
        if (!opportunityCard.choiceRequired) {
          return {
            kind: 'effect',
            label: `抽一張${opportunityCard.drawCard === 'happiness' ? '幸福' : '新聞'}卡`,
            title: opportunityCard.title,
            note: `本卡會直接進入後續抽${opportunityCard.drawCard === 'happiness' ? '幸福' : '新聞'}卡流程。`,
            afterApply: {
              drawCard: opportunityCard.drawCard
            }
          };
        }

        return {
          kind: 'choice',
          label: '套用效果',
          options: [
            {
              id: 'accept',
              label: '抽一張幸福卡',
              action: {
                kind: 'effect',
                label: '執行效果',
                title: opportunityCard.title,
                afterApply: {
                  drawCard: opportunityCard.drawCard
                }
              }
            },
            {
              id: 'reject',
              label: '關閉',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }
    }

    if (opportunityCard.type === 'ability_profession' || opportunityCard.type === 'ability_stock' || opportunityCard.type === 'ability_realestate') {
      const fee = opportunityCard.schoolFee || 0;
      return {
        kind: 'choice',
        label: '選擇是否接受',
        options: [
          {
            id: 'accept',
            label: '接受',
            action: {
              kind: 'financial',
              label: '進入財務檢核',
              txData: {
                name: `機運卡：${opportunityCard.title}（接受）`,
                amount: fee,
                cashChange: -fee,
                source: 'cash',
                usage: 'lifelong_learning',
                lifelongLearningPayload: {
                  learningType:
                    opportunityCard.type === 'ability_profession'
                      ? 'enhance_profession'
                      : opportunityCard.type === 'ability_stock'
                        ? 'stock_ability'
                        : 'real_estate_ability',
                  requiredRoll: opportunityCard.diceRequirement || 2
                },
                impacts: [
                  `現金 -${fee.toLocaleString()}`,
                  ...(opportunityCard.missRounds ? [`暫停 ${opportunityCard.missRounds} 回合`] : []),
                  `到學校後擲骰判定，${opportunityCard.diceRequirement || 2} 點以上生效`
                ]
              },
              expectedEntries: [
                { category: 'Assets', name: '現金', direction: 'Decrease' }
              ],
              afterApply: opportunityCard.goToSquare === 'school' ? {
                moveToSquare: {
                  squareType: 'school',
                  skipTurns: opportunityCard.missRounds || 1,
                  detail: '終身學習已接受，直接移動到學校，並暫停一回合'
                }
              } : undefined
            }
          },
          {
            id: 'reject',
            label: '不接受',
            action: { kind: 'dismiss' }
          }
        ]
      };
    }

    if (
      opportunityCard.type === 'purchase_1room' ||
      opportunityCard.type === 'purchase_any_house' ||
      opportunityCard.type === 'purchase_store' ||
      opportunityCard.type === 'purchase_startup' ||
      opportunityCard.type === 'enterprise_acquisition'
    ) {
      let items: BoardAssetSaleCandidate[] = [];
      let emptyNote = '目前沒有符合這張卡條件的資產。';

      if (opportunityCard.type === 'purchase_1room') {
        const candidates = gameState.assets.filter(asset => asset.type === '不動產' && realEstateKind(asset) === '1room');
        items = candidates.map(asset =>
          buildAssetSaleCandidate(
            asset,
            opportunityCard.purchasePrice || 0,
            gameState.liabilities,
            `固定收購價 ${formatAmount(opportunityCard.purchasePrice || 0)}`
          )
        );
        emptyNote = '你目前沒有可出售的單間小套房。';
      }

      if (opportunityCard.type === 'purchase_any_house') {
        const candidates = gameState.assets.filter(asset => {
          if (asset.type !== '不動產') return false;
          const kind = realEstateKind(asset);
          if (['C017', 'C018', 'C019', 'C020', 'C021', 'C022'].includes(opportunityCard.id)) {
            return kind === '2room' || kind === '3room';
          }
          return kind !== 'store';
        });

        items = candidates.map(asset => {
          const percent = opportunityCard.purchasePercent || 0;
          const price = Math.floor(asset.cost * ((100 + percent) / 100));
          return buildAssetSaleCandidate(
            asset,
            price,
            gameState.liabilities,
            `依房屋總價加價 ${percent}% 收購，售價 ${formatAmount(price)}`
          );
        });
        emptyNote = '你目前沒有符合條件的住宅可出售。';
      }

      if (opportunityCard.type === 'purchase_store') {
        const candidates = gameState.assets.filter(asset => asset.type === '不動產' && realEstateKind(asset) === 'store');
        items = candidates.map(asset => {
          const percent = opportunityCard.purchasePercent || 0;
          const price = Math.floor(asset.cost * (percent / 100));
          return buildAssetSaleCandidate(
            asset,
            price,
            gameState.liabilities,
            `依店面總價 ${percent}% 收購，售價 ${formatAmount(price)}`
          );
        });
        emptyNote = '你目前沒有可出售的店面資產。';
      }

      if (opportunityCard.type === 'purchase_startup') {
        const candidates = gameState.assets.filter(asset =>
          asset.type === '企業' &&
          asset.name.includes('兼職工作室') &&
          !asset.isUpgraded
        );
        items = candidates.map(asset =>
          buildAssetSaleCandidate(
            asset,
            opportunityCard.purchasePrice || 0,
            gameState.liabilities,
            `固定收購價 ${formatAmount(opportunityCard.purchasePrice || 0)}`
          )
        );
        emptyNote = '你目前沒有可出售的兼職工作室。';
      }

      if (opportunityCard.type === 'enterprise_acquisition') {
        const multiple = opportunityCard.acquisitionMultiple || 0;
        const candidates = gameState.assets.filter(asset => asset.type === '企業');
        items = candidates.map(asset => {
          const monthlyCashflow = Number(asset.cashflow) || 0;
          const price = Math.floor(monthlyCashflow * multiple);
          return buildAssetSaleCandidate(
            asset,
            price,
            gameState.liabilities,
            `企業月收益 ${monthlyCashflow.toLocaleString()} × ${multiple} 倍，收購價 ${formatAmount(price)}`
          );
        });
        emptyNote = '你目前沒有可出售的企業資產。';
      }

      return {
        kind: 'asset_sale',
        label: '選擇出售資產',
        note: '勾選要出售的物件後，會直接帶入財務檢核。',
        emptyNote,
        confirmLabel: '前往出售',
        items
      };
    }

    if (opportunityCard.cashLoss || opportunityCard.cashGain) {
      const cashDelta = (opportunityCard.cashGain || 0) - (opportunityCard.cashLoss || 0);
      
      const expectedEntries: AccountEntry[] = [];
      if (cashDelta !== 0) {
        expectedEntries.push({
          category: 'Assets',
          name: '現金',
          direction: cashDelta > 0 ? 'Increase' : 'Decrease'
        });
      }

      let expensePayload;
      if (opportunityCard.monthlyExpenseChange) {
        const category = getOpportunityMonthlyExpenseCategory(opportunityCard.id);
        const isIncrease = opportunityCard.monthlyExpenseChange > 0;
        expectedEntries.push({
          category: 'Expenses',
          name: getMonthlyExpenseCategoryLabel(category),
          direction: isIncrease ? 'Increase' : 'Decrease'
        });
        expensePayload = {
          category,
          amount: Math.abs(opportunityCard.monthlyExpenseChange),
          isIncrease
        };
      }

      if (expectedEntries.length > 0) {
        const financialAction: BoardFinancialAction = {
          kind: 'financial',
          label: '進入財務檢核',
          txData: {
            name: `機運卡：${opportunityCard.title}`,
            amount: Math.abs(cashDelta),
            cashChange: cashDelta,
            source: cashDelta >= 0 ? 'income' : 'cash',
            usage: cashDelta >= 0 ? 'cash' : 'expense',
            expensePayload,
            impacts: [
              ...(cashDelta !== 0 ? [`現金 ${cashDelta > 0 ? '+' : '-'}${Math.abs(cashDelta).toLocaleString()}`] : []),
              ...(opportunityCard.monthlyExpenseChange ? [`${expensePayload ? getMonthlyExpenseCategoryLabel(expensePayload.category) : ''}月支出 ${opportunityCard.monthlyExpenseChange > 0 ? '+' : '-'}${Math.abs(opportunityCard.monthlyExpenseChange).toLocaleString()}`] : []),
              ...(opportunityCard.happinessLoss ? [`幸福點數 -${opportunityCard.happinessLoss} 點`] : []),
              ...(opportunityCard.drawCard ? [`抽取一張${opportunityCard.drawCard === 'happiness' ? '幸福卡' : '新聞卡'}`] : [])
            ]
          },
          expectedEntries,
          note: opportunityCard.insurancePays ? '若你要改用保險理賠，請改走保險流程。' : undefined,
          ...(opportunityCard.drawCard ? {
            afterApply: {
              drawCard: opportunityCard.drawCard
            }
          } : {})
        };

        if (opportunityCard.type === 'reward' && opportunityCard.choiceRequired) {
          return {
            kind: 'choice',
            label: '選擇是否接受',
            options: [
              {
                id: 'accept',
                label: '接受',
                action: financialAction
              },
              {
                id: 'reject',
                label: '不接受',
                action: { kind: 'dismiss' }
              }
            ]
          };
        }

        return financialAction;
      }
    }

    if (opportunityCard.monthlyExpenseChange && !(opportunityCard.cashLoss || opportunityCard.cashGain)) {
      const category = getOpportunityMonthlyExpenseCategory(opportunityCard.id);
      const isIncrease = opportunityCard.monthlyExpenseChange > 0;
      const financialAction: BoardFinancialAction = {
        kind: 'financial',
        label: '進入財務檢核',
        txData: {
          name: `機運卡：${opportunityCard.title}`,
          amount: Math.abs(opportunityCard.monthlyExpenseChange),
          cashChange: 0,
          source: 'income',
          usage: 'expense_update',
          expensePayload: {
            category,
            amount: Math.abs(opportunityCard.monthlyExpenseChange),
            isIncrease
          },
          impacts: [
            `${getMonthlyExpenseCategoryLabel(category)}月支出 ${isIncrease ? '+' : '-'}${Math.abs(opportunityCard.monthlyExpenseChange).toLocaleString()}`,
            ...(opportunityCard.happinessLoss ? [`幸福點數 -${opportunityCard.happinessLoss} 點`] : []),
            ...(opportunityCard.drawCard ? [`抽取一張${opportunityCard.drawCard === 'happiness' ? '幸福卡' : '新聞卡'}`] : [])
          ]
        },
        expectedEntries: [{
          category: 'Expenses',
          name: getMonthlyExpenseCategoryLabel(category),
          direction: isIncrease ? 'Increase' : 'Decrease'
        }],
        ...(opportunityCard.drawCard ? {
          afterApply: {
            drawCard: opportunityCard.drawCard
          }
        } : {})
      };

      if (opportunityCard.type === 'reward' && opportunityCard.choiceRequired) {
        return {
          kind: 'choice',
          label: '選擇是否接受',
          options: [
            {
              id: 'accept',
              label: '接受',
              action: financialAction
            },
            {
              id: 'reject',
              label: '不接受',
              action: { kind: 'dismiss' }
            }
          ]
        };
      }

      return financialAction;
    }

    return {
      kind: 'unsupported',
      label: '待補流程',
      note: '這張卡目前沒有可直接套用的金流或幸福流程。'
    };
  }

  const newsCard = NEWS_CARD_MAP[cardId];
  if (newsCard) {
    if (newsCard.type === 'stock_price') {
      return {
        kind: 'market',
        label: '套用股市行情',
        code: newsCard.id,
        prices: newsCard.prices,
        isBubble: !!newsCard.specialRule?.includes('減半'),
        note: newsCard.specialRule
      };
    }

    if (newsCard.type === 'cash_dividend') {
      const total = gameState.assets
        .filter(asset => asset.type === '股票' && asset.quantity)
        .reduce((sum, asset) => {
          const symbol = stockSymbolFromAssetName(asset.name) as keyof typeof newsCard.dividendPerShare;
          const perShare = newsCard.dividendPerShare[symbol] || 0;
          return sum + ((asset.quantity || 0) * 100 * perShare);
        }, 0);

      if (total <= 0) {
        return {
          kind: 'unsupported',
          label: '目前無可領股利',
          note: '你目前沒有可套用這張股利卡的持股。'
        };
      }

      return {
        kind: 'financial',
        label: '進入財務檢核',
        txData: {
          name: `新聞卡：${newsCard.title}`,
          amount: total,
          cashChange: total,
          source: 'income',
          usage: 'cash',
          impacts: [`現金 +${total.toLocaleString()}`]
        },
        expectedEntries: [{
          category: 'Assets',
          name: '現金',
          direction: 'Increase'
        }]
      };
    }

    if (newsCard.type === 'stock_dividend') {
      const items = gameState.assets
        .filter(asset => asset.type === '股票' && asset.quantity)
        .map(asset => {
          const symbol = stockSymbolFromAssetName(asset.name) as keyof typeof newsCard.dividendRate;
          const addedQty = Math.ceil((asset.quantity || 0) * (newsCard.dividendRate[symbol] || 0));
          return { assetId: asset.id, addedQty };
        })
        .filter(item => item.addedQty > 0);

      if (items.length === 0) {
        return {
          kind: 'unsupported',
          label: '目前無可配股持股',
          note: '你目前沒有可套用這張股票股息卡的持股。'
        };
      }

      return {
        kind: 'financial',
        label: '進入財務檢核',
        txData: {
          name: `新聞卡：${newsCard.title}`,
          amount: 0,
          cashChange: 0,
          source: 'income',
          usage: 'stock_update',
          stockDividendPayload: { items },
          impacts: ['股票張數增加']
        },
        expectedEntries: [{
          category: 'Assets',
          name: '股票',
          direction: 'Increase'
        }]
      };
    }

    if (newsCard.type === 'real_estate') {
      const buildTx = (isSelfUse: boolean): BoardFinancialAction => {
        const assetName = getRealEstateAssetLabel(newsCard.id, newsCard.propertyLabel);
        const impacts = [
          ...(newsCard.downPayment > 0 ? [`現金 -${newsCard.downPayment.toLocaleString()}`] : []),
          `${assetName} +${(newsCard.downPayment + newsCard.loanAmount).toLocaleString()}`,
          ...(newsCard.loanAmount > 0 ? [`不動產貸款 +${newsCard.loanAmount.toLocaleString()}`] : []),
          ...(newsCard.loanAmount > 0 ? [`不動產貸款利息(月) +${newsCard.monthlyPayment.toLocaleString()}`] : []),
          ...(!isSelfUse ? [`租金收入(月) +${newsCard.rent.toLocaleString()}`] : []),
          ...(isSelfUse && newsCard.happinessBonus > 0 ? [`幸福點數 +${newsCard.happinessBonus} 點`] : [])
        ];

        const txData: TransactionData = {
          name: `新聞卡：${newsCard.title}${isSelfUse ? '（自用）' : '（出租）'}`,
          amount: newsCard.totalPrice,
          cashChange: -newsCard.downPayment,
          source: 'loan',
          usage: 'asset',
          assetDetails: {
            type: '不動產',
            cashflow: isSelfUse ? 0 : newsCard.rent,
            downPayment: newsCard.downPayment,
            loanAmount: newsCard.loanAmount,
            loanInterest: newsCard.monthlyPayment,
            symbol: newsCard.id,
            isSelfUse,
            houseType: newsCard.houseType,
            happyPoints: isSelfUse ? newsCard.happinessBonus : 0
          },
          impacts
        };

        const expectedEntries: AccountEntry[] = [
          { category: 'Assets', name: assetName, direction: 'Increase' },
          ...(newsCard.downPayment > 0 ? [{ category: 'Assets', name: '現金', direction: 'Decrease' } as AccountEntry] : []),
          ...(newsCard.loanAmount > 0 ? [{ category: 'Liabilities', name: '不動產貸款', direction: 'Increase' } as AccountEntry] : []),
          ...(newsCard.loanAmount > 0 ? [{ category: 'Expenses', name: '不動產貸款利息', direction: 'Increase' } as AccountEntry] : []),
          ...(!isSelfUse ? [{ category: 'Income', name: '租金收入', direction: 'Increase' } as AccountEntry] : [])
        ];

        return {
          kind: 'financial',
          label: isSelfUse ? '自用購買' : '購買',
          txData,
          expectedEntries
        };
      };

      if (newsCard.canSelfUse) {
        return {
          kind: 'choice',
          label: '選擇購買方式',
          note: '可選擇自用或出租，兩者會導向不同的財務檢核。',
          options: [
            { id: 'self_use', label: '自用購買', action: buildTx(true) },
            { id: 'rental', label: '出租購買', action: buildTx(false) }
          ]
        };
      }

      return buildTx(false);
    }

    if (newsCard.type === 'small_business') {
      const businessLabel = getBusinessAssetLabel(newsCard.id, newsCard.title);
      const investmentAmount = newsCard.investmentPerMonth;
      return {
        kind: 'financial',
        label: '進入財務檢核',
        txData: {
          name: `新聞卡：${newsCard.title}`,
          amount: investmentAmount,
          cashChange: newsCard.loanAmount - investmentAmount,
          source: 'loan',
          usage: 'asset',
          assetDetails: {
            type: '企業',
            cashflow: 0,
            downPayment: investmentAmount,
            loanAmount: newsCard.loanAmount,
            loanInterest: newsCard.interestPerMonth,
            symbol: newsCard.id
          },
          impacts: [
            `現金 -${investmentAmount.toLocaleString()}`,
            `現金（企業貸款） +${newsCard.loanAmount.toLocaleString()}`,
            `${businessLabel} +${investmentAmount.toLocaleString()}`,
            `企業貸款 +${newsCard.loanAmount.toLocaleString()}`,
            `企業貸款利息(月) +${newsCard.interestPerMonth.toLocaleString()}`,
          ]
        },
        expectedEntries: [
          { category: 'Assets', name: '現金', direction: 'Decrease' },
          { category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' },
          { category: 'Assets', name: businessLabel, direction: 'Increase' },
          { category: 'Liabilities', name: '企業貸款', direction: 'Increase' },
          { category: 'Expenses', name: '企業貸款利息', direction: 'Increase' }
        ]
      };
    }

    if (newsCard.type === 'large_enterprise') {
      return {
        kind: 'investment',
        label: '輸入投資金額',
        note: `請以 ${formatAmount(1000000)} 為單位輸入投資金額，最高 ${formatAmount(newsCard.maxInvestment)}。`,
        minAmount: 1000000,
        maxAmount: newsCard.maxInvestment,
        step: 1000000,
        defaultAmount: Math.min(newsCard.maxInvestment, 1000000),
        businessSymbol: newsCard.id,
        businessName: newsCard.businessName,
        monthlyReturnPerStep: newsCard.monthlyReturnPerMillion
      };
    }

    return {
      kind: 'unsupported',
      label: '需進一步輸入',
      note: '這張新聞卡需要額外輸入投資條件，下一步可再接成完整購買流程。'
    };
  }

  return {
    kind: 'unsupported',
    label: '尚未支援',
    note: '目前找不到這張卡的遊戲效果設定。'
  };
};
