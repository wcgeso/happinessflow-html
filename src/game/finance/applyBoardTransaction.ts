/**
 * 棋盤模式財務交易的純函式版本。
 *
 * 從 `useGameLogic.handleTransactionSubmit` 抽出，練習模式（本機）與伺服器交易共用同一份邏輯。
 * 這裡沒有 React、沒有 showAlert、沒有 Date.now()/Math.random()：時間與 id 由呼叫端注入，
 * 才能在伺服器交易中重送得到相同結果。
 */
import { Asset, GameState, HappinessItem, Transaction, TransactionData } from '../../types';
import { normalizeGameState } from '../../utils/gameState';
import { formatMoney, getFinancialAccelerationMultiplier } from '../../utils/gameUtils';
import { extractAssetSymbol, getAssetDisplayLabel, getStockAssetLabel } from '../../utils/assetLabels';
import { getLiabilityMonthlyPayment, getRemainingCreditCapacity } from '../../utils/financialRules';
import { OPPORTUNITY_CARD_MAP } from '../../constants/cards';
import { REAL_ESTATE_TYPES } from '../../constants';

export interface BoardTransactionEnv {
  /** 交易時間戳（毫秒）。 */
  now: number;
  /** 產生資產／負債／紀錄 id。伺服器端應由 commandId 衍生，確保重送結果一致。 */
  generateId: () => string;
}

export type FinancialAccelerationInput = Parameters<typeof getFinancialAccelerationMultiplier>[0];

export const deriveTransactionLabels = (data: TransactionData) => {
    if (data.medicalClaimId) {
        return { sourceLabel: '保險理賠', usageLabel: '醫療理賠' };
    }
    if (data.insuranceType) {
        return { sourceLabel: '生活支出', usageLabel: '保險投保' };
    }
    if (data.usage === 'asset' && data.stockList?.length) {
        return {
            sourceLabel: data.cashChange >= 0 ? '投資回收' : '投資支出',
            usageLabel: data.cashChange >= 0 ? '賣出股票' : '買入股票'
        };
    }
    if (data.usage === 'asset' && data.assetDetails?.type === '定存') {
        return { sourceLabel: '投資支出', usageLabel: '辦理定存' };
    }
    if (data.usage === 'cash' && data.relatedAssetId) {
        return { sourceLabel: '投資回收', usageLabel: '解約或出售資產' };
    }
    if (data.usage === 'cash' && data.source === 'loan') {
        return { sourceLabel: '銀行借貸', usageLabel: '借入現金' };
    }
    if (data.usage === 'liability') {
        return { sourceLabel: '現金支付', usageLabel: '償還貸款' };
    }
    if (data.usage === 'expense_update') {
        return { sourceLabel: '生活事件', usageLabel: '調整月支出' };
    }
    if (data.usage === 'happiness_event') {
        return { sourceLabel: '幸福事件', usageLabel: '幸福卡效果' };
    }
    if (data.usage === 'lifelong_learning') {
        return { sourceLabel: '進修事件', usageLabel: '終身學習' };
    }
    if (data.usage === 'stock_update') {
        return { sourceLabel: '投資收益', usageLabel: '股票配發' };
    }

    return {
        sourceLabel: data.source === 'income' ? '收入' : data.source === 'loan' ? '借貸' : data.usage === 'asset' ? '資產交易' : '支出',
        usageLabel: data.usage === 'asset' ? '買入資產' : '一般支出'
    };
};

export const normalizeTransactionData = (data: TransactionData): TransactionData => {
    if (data.usage === 'buy_asset' && data.assetChange?.asset) {
        const asset = data.assetChange.asset;

        if (asset.type === '股票' && asset.symbol && asset.shares) {
            return {
                ...data,
                usage: 'asset',
                stockList: [{
                    symbol: asset.symbol,
                    price: asset.buyPrice || 0,
                    qty: asset.shares
                }],
                assetChange: undefined
            };
        }

        if (asset.type === '定存') {
            return {
                ...data,
                name: '買入定期存款',
                usage: 'asset',
                assetDetails: {
                    type: '定存',
                    cashflow: Math.floor((data.amount || 0) * 0.01),
                    downPayment: data.amount || 0
                },
                assetChange: undefined
            };
        }
    }

    if (data.usage === 'sell_asset' && data.sellAssetPayload?.type === 'stock') {
        return {
            ...data,
            source: 'income',
            usage: 'cash',
            stockList: [{
                symbol: data.sellAssetPayload.symbol,
                price: data.sellAssetPayload.currentPrice,
                qty: data.sellAssetPayload.sharesToSell
            }],
            sellAssetPayload: undefined
        };
    }

    if (data.usage === 'loan') {
        const liability = data.liabilityChange?.liability;
        return {
            ...data,
            source: 'loan',
            usage: 'cash',
            liabilityChange: undefined,
            liabilityId: liability?.id
        };
    }

    if (data.usage === 'loan_repayment') {
        return {
            ...data,
            usage: 'liability',
            liabilityId: data.liabilityChange?.liabilityId || data.liabilityId,
            liabilityChange: undefined
        };
    }

    if (data.usage === 'insurance') {
        // 保險是每月固定支出，購買當下不扣現金，維持呼叫端傳入的 cashChange（通常為 0）。
        return {
            ...data,
            usage: 'expense',
            amount: data.amount || data.expensePayload?.amount || 0
        };
    }

    return data;
};

export interface PreparedBoardTransaction {
  data: TransactionData;
  amount: number;
  forcedDebtAmount: number;
  fundingLoanAmount: number;
  effectiveCashChange: number;
  transactionCashChange: number;
  incomeMultiplierEligible: boolean;
  originalCashChange: number;
  appliedMultiplier: number;
  flowType: '生活' | '投資' | '融資' | '其它';
  storageData: any;
  message: string;
}

export type PrepareBoardTransactionResult =
  | { status: 'error'; message: string }
  | { status: 'duplicate' }
  | { status: 'ready'; prepared: PreparedBoardTransaction };

/** 正規化並驗證一筆交易；不修改任何狀態。 */
export const prepareBoardTransaction = (
  state: GameState,
  data: TransactionData,
  financialAcceleration: FinancialAccelerationInput
): PrepareBoardTransactionResult => {
  const fail = (message: string): PrepareBoardTransactionResult => ({ status: 'error', message });
  data = normalizeTransactionData(data);
  if (data.stockList?.some(item => !Number.isFinite(item.price) || item.price <= 0 || !Number.isInteger(item.qty) || item.qty < 1)) {
      return fail('股票價格必須大於 0，張數必須為正整數');
  }
  if (data.stockList?.length) {
      const stockTotal = data.stockList.reduce((sum, item) => sum + item.price * item.qty, 0);
      const expectedCashChange = data.usage === 'asset' ? -stockTotal : stockTotal;
      if (data.amount !== stockTotal || data.cashChange !== expectedCashChange) {
          return fail('股票交易金額不一致，請重新送出');
      }
  }
  // 事件級防重複套用（P1-05）：棋盤財務檢核流程若因 modal 重開、effect 重跑或
  // snapshot 延遲而重複呼叫，同一個 boardEventId 只會套用一次。
  if (data.boardEventId && state.appliedBoardFinancialEventIds?.includes(data.boardEventId)) {
      return { status: 'duplicate' };
  }
  if (data.pendingMedicalClaim) {
      const claimCard = OPPORTUNITY_CARD_MAP[data.pendingMedicalClaim.sourceCardId];
      if (
          claimCard?.type !== 'medical' ||
          !data.pendingMedicalClaim.sourceEventId ||
          (claimCard.insurancePays || 0) <= 0
      ) {
          return fail('待理賠事件資料無效');
      }
  }
  if (data.medicalClaimId) {
      const claim = state.pendingMedicalClaims?.find(item => item.id === data.medicalClaimId);
      const claimCard = claim ? OPPORTUNITY_CARD_MAP[claim.sourceCardId] : null;
      if (
          !claim ||
          claimCard?.type !== 'medical' ||
          data.boardFlow !== 'insurance-claim' ||
          data.boardEventId !== claim.id ||
          data.source !== 'income' ||
          data.usage !== 'cash' ||
          data.amount !== claimCard.insurancePays ||
          data.cashChange !== claimCard.insurancePays
      ) {
          return fail('目前沒有可申請的醫療理賠事件');
      }
  }
  const accelerationMultiplier = getFinancialAccelerationMultiplier(financialAcceleration);
  const incomeMultiplierEligible = data.incomeMultiplierEligible === true && data.cashChange > 0;
  const originalCashChange = data.cashChange;
  const appliedMultiplier = incomeMultiplierEligible ? accelerationMultiplier : 1;
  const transactionCashChange = incomeMultiplierEligible
      ? Math.round(data.cashChange * accelerationMultiplier)
      : data.cashChange;
  const forcedDebtAmount = Number(data.forcedDebtAmount || 0);
  if (!Number.isInteger(forcedDebtAmount) || forcedDebtAmount < 0) {
      return fail('強制負債金額無效，請重新操作');
  }
  const fundingLoanAmount = Number(data.fundingLoanAmount || 0);
  if (!Number.isInteger(fundingLoanAmount) || fundingLoanAmount < 0) {
      return fail('信貸周轉金額無效，請重新操作');
  }
  if (forcedDebtAmount > 0 && fundingLoanAmount > 0) {
      return fail('同一筆交易不可同時使用兩種周轉方式');
  }
  const effectiveCashChange = transactionCashChange + forcedDebtAmount + fundingLoanAmount;
  const amount = Number(data.amount);
  if (isNaN(amount) || amount < 0) {
      return fail('請輸入有效金額');
  }
  if (data.source === 'loan' && data.usage === 'cash') {
      const remainingCredit = getRemainingCreditCapacity(
          state.profession?.salary || 0,
          state.liabilities,
          state.loans
      );
      if (amount > remainingCredit) {
          return fail(`超過信貸上限，剩餘可借 ${formatMoney(remainingCredit)}`);
      }
  }
  if (fundingLoanAmount > 0) {
      const remainingCredit = getRemainingCreditCapacity(
          state.profession?.salary || 0,
          state.liabilities,
          state.loans
      );
      if (fundingLoanAmount > remainingCredit) {
          return fail(`超過信貸上限，剩餘可借 ${formatMoney(remainingCredit)}`);
      }
  }
  if (effectiveCashChange < 0 && state.cash + effectiveCashChange < 0) {
      return fail(`現金不足，還差 ${formatMoney(Math.abs(state.cash + effectiveCashChange))}，請先周轉資金`);
  }
  if (data.usage === 'liability' && data.liabilityId) {
      if (amount > state.cash) {
          return fail('現金不足，無法完成還款');
      }

      if (data.liabilityId === 'multiple_credit_loans') {
          const totalCreditDebt =
              state.liabilities
                  .filter(liability => liability.type === '信用貸款')
                  .reduce((sum, liability) => sum + liability.totalOwed, 0) +
              (state.loans || 0);

          if (totalCreditDebt <= 0) {
              return fail('目前沒有可償還的信用貸款');
          }
          if (amount > totalCreditDebt) {
              return fail(`還款金額不可超過信用貸款總額 ${formatMoney(totalCreditDebt)}`);
          }
      } else if (data.liabilityId === 'bank_loan') {
          if (amount > (state.loans || 0)) {
              return fail(`還款金額不可超過信用貸款總額 ${formatMoney(state.loans || 0)}`);
          }
      } else {
          const targetLiability = state.liabilities.find(liability => liability.id === data.liabilityId);
          if (!targetLiability) {
              return fail('找不到要償還的貸款資料，請重新開啟還款視窗');
          }
          if (amount > targetLiability.totalOwed) {
              return fail(`還款金額不可超過 ${targetLiability.name} 的剩餘金額 ${formatMoney(targetLiability.totalOwed)}`);
          }
      }
  }

  const storageData: any = {
      ...data,
      ...(incomeMultiplierEligible ? { originalCashChange, appliedMultiplier, effectiveCashChange: transactionCashChange } : {})
  };

  // Determine flowType if not provided
  let flowType: '生活' | '投資' | '融資' | '其它' = (data.flowType as any) || '其它';
  if (!data.flowType) {
      if (data.usage === 'asset' || (data.usage === 'cash' && data.source === 'income')) {
          flowType = '投資';
      } else if (data.usage === 'liability' || (data.usage === 'cash' && data.source === 'loan')) {
          flowType = '融資';
      } else if (data.usage === 'expense_update' || data.usage === 'happiness_event' || data.usage === 'lifelong_learning' || data.usage === 'stock_update' || data.insuranceType) {
          flowType = '生活';
      }
  }

  // Pre-calculate success message
  let finalSuccessMessage = '交易已記錄';
  if (data.usage === 'asset') {
      if (data.stockList && data.stockList.length > 0) finalSuccessMessage = `成功買入股票 ${data.stockList.length} 筆`;
      else if (data.assetDetails) finalSuccessMessage = `成功買入 ${data.assetDetails.type} ${data.assetDetails.symbol || ''}`.trim();
  } else if (data.usage === 'liability') {
      finalSuccessMessage = `成功還款 ${formatMoney(amount)}`;
  } else if (data.source === 'loan' && data.usage === 'cash') {
      finalSuccessMessage = `成功借貸 ${formatMoney(amount)}`;
  } else if (data.usage === 'expense_update' && data.expensePayload) {
      finalSuccessMessage = `成功${data.expensePayload.isIncrease ? '增加' : '減少'}月支出`;
  } else if (data.medicalClaimId) {
      finalSuccessMessage = `醫療理賠已入帳 ${formatMoney(amount)}`;
  } else if (data.usage === 'cash' && data.source === 'income') {
      finalSuccessMessage = data.stockList ? '成功賣出股票' : '成功賣出資產';
  } else if (data.usage === 'stock_update') {
      finalSuccessMessage = '配股已核發';
  } else if (data.usage === 'lifelong_learning') {
      finalSuccessMessage = '終身學習效果已結算';
  } else if (data.insuranceType) {
      finalSuccessMessage = '保險已生效';
  }
  if (forcedDebtAmount > 0) {
      finalSuccessMessage = `已計入強制負債 ${formatMoney(forcedDebtAmount)} 並完成交易`;
  }
  if (fundingLoanAmount > 0) {
      finalSuccessMessage = `已借用信用貸款 ${formatMoney(fundingLoanAmount)} 並完成交易`;
  }

  return {
    status: 'ready',
    prepared: {
      data,
      amount,
      forcedDebtAmount,
      fundingLoanAmount,
      effectiveCashChange,
      transactionCashChange,
      incomeMultiplierEligible,
      originalCashChange,
      appliedMultiplier,
      flowType,
      storageData,
      message: finalSuccessMessage
    }
  };
};

/** 把已驗證的交易套用到玩家狀態，回傳新狀態。 */
export const reduceBoardTransaction = (
  prev: GameState,
  prepared: PreparedBoardTransaction,
  env: BoardTransactionEnv
): GameState => {
  const {
    data, amount, forcedDebtAmount, fundingLoanAmount, effectiveCashChange, transactionCashChange,
    incomeMultiplierEligible, originalCashChange, appliedMultiplier, flowType
  } = prepared;
  const storageData: any = { ...prepared.storageData };
      let newState = normalizeGameState(prev);
      newState.cash += effectiveCashChange;

      if (forcedDebtAmount > 0) {
          const fundingTransaction: Transaction = {
              id: `forced-debt:${data.boardEventId || data.name}:${forcedDebtAmount}:${newState.history.length}`,
              timestamp: env.now,
              name: `強制計入負債：${data.name}`,
              amount: forcedDebtAmount,
              sourceLabel: '借貸',
              usageLabel: '強制負債',
              cashChange: forcedDebtAmount,
              balance: newState.cash,
              details: JSON.stringify({ usage: 'forced_debt', boardEventId: data.boardEventId }),
              flowType: '融資'
          };
          newState.liabilities = [...newState.liabilities, {
              id: fundingTransaction.id,
              name: '強制負債',
              totalOwed: forcedDebtAmount,
              monthlyPayment: 0,
              type: '強制負債'
          }];
          newState.history = [...newState.history, fundingTransaction];
      }
      if (fundingLoanAmount > 0) {
          const fundingTransaction: Transaction = {
              id: `credit-turnaround:${data.boardEventId || data.name}:${fundingLoanAmount}:${newState.history.length}`,
              timestamp: env.now,
              name: `借用信用貸款：${data.name}`,
              amount: fundingLoanAmount,
              sourceLabel: '借貸',
              usageLabel: '信用貸款',
              cashChange: fundingLoanAmount,
              balance: newState.cash,
              details: JSON.stringify({ usage: 'cash', funding: true, boardEventId: data.boardEventId }),
              flowType: '融資'
          };
          newState.liabilities = [...newState.liabilities, {
              id: fundingTransaction.id,
              name: '信用貸款',
              totalOwed: fundingLoanAmount,
              monthlyPayment: Math.floor(fundingLoanAmount * 0.1),
              type: '信用貸款'
          }];
          newState.history = [...newState.history, fundingTransaction];
      }

      if (data.usage === 'asset') {
          if (data.stockList && data.stockList.length > 0) {
              const updatedAssets = [...newState.assets];
              data.stockList.forEach(stock => {
                  const existingIdx = updatedAssets.findIndex(a => a.type === '股票' && extractAssetSymbol(a.name) === stock.symbol);
                  if (existingIdx !== -1) {
                      const existing = updatedAssets[existingIdx];
                      const newQty = (existing.quantity || 0) + stock.qty;
                      updatedAssets[existingIdx] = { ...existing, quantity: newQty, lastPurchasePrice: stock.price, cost: newQty * stock.price };
                  } else {
                      updatedAssets.push({ id: env.generateId(), name: getStockAssetLabel(stock.symbol), cost: stock.price * stock.qty, downPayment: stock.price * stock.qty, cashflow: 0, type: '股票' as const, quantity: stock.qty, lastPurchasePrice: stock.price });
                  }
              });
              newState.assets = updatedAssets;
          } else if (data.assetDetails) {
              const details = data.assetDetails;
              const loanAmt = details.loanAmount || 0;

              // 企業類型的資產，其顯示價值（cost）應為投資總額（downPayment），不包含企業貸款
              const assetCost = details.type === '企業'
                  ? (details.downPayment || 0)
                  : data.amount;

              const displayName = details.symbol
                  ? (details.type === '股票'
                      ? getStockAssetLabel(details.symbol)
                      : details.type === '不動產'
                        ? getAssetDisplayLabel({ id: '', name: details.symbol, cost: 0, downPayment: 0, cashflow: 0, type: '不動產', houseType: details.houseType })
                        : details.type === '企業'
                          ? getAssetDisplayLabel({ id: '', name: details.symbol, cost: 0, downPayment: 0, cashflow: 0, type: '企業' })
                          : `${details.type} ${details.symbol}`.trim())
                  : details.type === '不動產'
                    ? getAssetDisplayLabel({ id: '', name: '', cost: 0, downPayment: 0, cashflow: 0, type: '不動產', houseType: details.houseType })
                    : `${details.type} ${details.symbol || ''}`.trim();

              const newAsset: Asset = {
                  id: env.generateId(),
                  name: displayName,
                  cost: assetCost,
                  downPayment: details.downPayment || 0,
                  cashflow: details.cashflow || 0,
                  type: details.type as any,
                  isSelfUse: details.isSelfUse,
                  houseType: details.houseType,
                  isInsured: false
              };
              storageData.createdAssetId = newAsset.id;
              newState.assets = [...newState.assets, newAsset];
              if (loanAmt > 0) {
                  const loanTypeMap: Record<string, '不動產貸款' | '企業貸款' | '汽車貸款'> = { '不動產': '不動產貸款', '企業': '企業貸款', '飛行器': '汽車貸款', '汽車': '汽車貸款' };
                  const loanType = loanTypeMap[details.type];
                  if (loanType) {
                      newState.liabilities = [...newState.liabilities, { id: env.generateId(), name: `${loanType} (${details.symbol || ''})`.trim(), totalOwed: loanAmt, monthlyPayment: details.loanInterest || 0, type: loanType, linkedAssetId: newAsset.id }];
                  }
              }




              if (details.happyPoints && details.happyPoints > 0) {
                  // Determine the label used in the initial happiness list
                  // REAL_ESTATE_TYPES has { type: '1room', label: '單間小套房' }
                  // initialHappinessList has '單間小套房', '兩房一廳', '三房兩廳', '五房三廳'
                  // We need to map the REAL_ESTATE_TYPES label to the initial list label if they differ slightly
                  // 1room -> '單間小套房' (Match)
                  // 2room -> '兩房一廳住宅' in constants vs '兩房一廳' in initial list
                  // 3room -> '三房兩廳住宅' in constants vs '三房兩廳' in initial list
                  // 5room -> '五房三廳豪華住宅' in constants vs '五房三廳' in initial list

                  let baseLabel = REAL_ESTATE_TYPES[details.symbol || '']?.label || '自用住宅';
                  if (baseLabel === '兩房一廳住宅') baseLabel = '兩房一廳';
                  if (baseLabel === '三房兩廳住宅') baseLabel = '三房兩廳';
                  if (baseLabel === '五房三廳豪華住宅') baseLabel = '五房三廳';

                  // Check if the base item exists (e.g., "單間小套房")
                  const existingBaseItemIndex = newState.happiness.findIndex(h => h.label === baseLabel);

                  if (existingBaseItemIndex !== -1) {
                      const item = newState.happiness[existingBaseItemIndex];
                      if (!item.checked) {
                          // If base item exists but not checked, verify it: this is the first house
                          newState.happiness = newState.happiness.map((h, i) =>
                              i === existingBaseItemIndex ? { ...h, checked: true } : h
                          );
                      } else {
                          // If base item is already checked, create a new item with index
                          const existingCount = newState.happiness.filter(h => h.label.startsWith(baseLabel)).length;
                          const nextIndex = existingCount + 1;
                          const happyLabel = `${baseLabel} ${nextIndex}`; // "單間小套房 2"

                          const newItem: HappinessItem = {
                              id: `h_re_selfuse_${env.generateId()}`,
                              label: happyLabel,
                              points: details.happyPoints,
                              checked: true,
                              isCustom: true,
                              parentId: 'h_house_self' // Nest it under the parent to look nice
                          };
                          newState.happiness = [...newState.happiness, newItem];
                      }
                  } else {
                      // If base item doesn't exist at all (fallback), create "單間小套房"
                      const newItem: HappinessItem = {
                          id: `h_re_selfuse_${env.generateId()}`,
                          label: baseLabel,
                          points: details.happyPoints,
                          checked: true,
                          isCustom: true,
                          parentId: 'h_house_self'
                      };
                      newState.happiness = [...newState.happiness, newItem];
                  }
              }
          }
      } else if (data.usage === 'liability' && data.liabilityId) {
          if (data.liabilityId === 'multiple_credit_loans') {
              let remaining = amount;
              const repaidList: { id: string, paid: number, original: any }[] = [];

              newState.liabilities = newState.liabilities.map(l => {
                  if (l.type === '信用貸款' && remaining > 0) {
                      const pay = Math.min(l.totalOwed, remaining);
                      remaining -= pay;
                      const newTotal = l.totalOwed - pay;
                      repaidList.push({ id: l.id, paid: pay, original: { ...l } });
                      return { ...l, totalOwed: newTotal, monthlyPayment: Math.floor(newTotal * 0.1) };
                  }
                  return l;
              }).filter(l => l.totalOwed > 0);

              if (remaining > 0 && newState.loans > 0) {
                  const pay = Math.min(newState.loans, remaining);
                  newState.loans -= pay;
                  remaining -= pay;
                  storageData.repaidLegacyLoan = pay;
              }

              storageData.repaidLiabilities = repaidList;
          } else if (data.liabilityId === 'bank_loan') {
              newState.loans = Math.max(0, newState.loans - amount);
          } else {
              newState.liabilities = newState.liabilities.map(l => {
                  if (l.id === data.liabilityId) {
                      const newTotal = Math.max(0, l.totalOwed - amount);
                      // 同步更新月支付金額（利息），維持 0.5% 或 10% 的比例
                      const newMonthly = getLiabilityMonthlyPayment(l.type, newTotal);
                      return { ...l, totalOwed: newTotal, monthlyPayment: newMonthly };
                  }
                  return l;
              });
              // 如果還清了，移除該負債
              newState.liabilities = newState.liabilities.filter(l => l.totalOwed > 0);
          }
      } else if (data.source === 'loan' && data.usage === 'cash' && fundingLoanAmount === 0) {
          newState.liabilities = [...newState.liabilities, { id: env.generateId(), name: '信用貸款', totalOwed: amount, monthlyPayment: Math.floor(amount * 0.1), type: '信用貸款' }];
      } else if (data.usage === 'forced_debt') {
          newState.liabilities = [...newState.liabilities, { id: env.generateId(), name: '強制負債', totalOwed: amount, monthlyPayment: 0, type: '強制負債' }];
      } else if (data.usage === 'happiness_event' && data.happinessEventPayload) {
          const { id, name, points, monthlyExpenseChange, progressId, happinessItemId, sourceCardId } = data.happinessEventPayload;

          // Add to completed list
          newState.completedHappinessEvents = Array.from(new Set([
              ...(newState.completedHappinessEvents || []),
              id,
              ...(progressId ? [progressId] : []),
              ...(sourceCardId ? [sourceCardId] : [])
          ]));

          // Update existing happiness item if it exists
          const mapping: Record<string, string> = {
              'date': 'h_date',
              'propose': 'h_proposal',
              'wedding': 'h_wedding',
              'child1': 'h_child1',
              'child2': 'h_child2'
          };
          const targetId = happinessItemId || mapping[progressId || id];

          if (targetId && newState.happiness.some(h => h.id === targetId)) {
              newState.happiness = newState.happiness.map(h =>
                  h.id === targetId ? { ...h, checked: true } : h
              );
          } else {
              // Fallback for custom or unexpected items
              const newItem: HappinessItem = {
                  id: `h_event_${sourceCardId || id}_${env.now}`,
                  label: name,
                  points: points,
                  checked: true,
                  isCustom: true
              };
              newState.happiness = [...newState.happiness, newItem];
          }

          // Handle monthly expense increase
          if (monthlyExpenseChange) {
              const category = data.happinessEventPayload.expenseCategory || 'otherMedicalChild';
              const currentVal = newState.expenses[category] || 0;
              newState.expenses = { ...newState.expenses, [category]: currentVal + monthlyExpenseChange };
          }
      } else if (data.usage === 'expense_update' && data.expensePayload) {
          const { category, amount: expAmount, isIncrease } = data.expensePayload;
          const currentVal = newState.expenses[category] || 0;
          newState.expenses = { ...newState.expenses, [category]: isIncrease ? currentVal + expAmount : Math.max(0, currentVal - expAmount) };
      } else if (data.usage === 'cash' && data.source === 'income') {
          let updatedAssets = [...newState.assets];
          if (data.stockList && data.stockList.length > 0) {
              data.stockList.forEach(item => {
                  const assetIdx = updatedAssets.findIndex(a => a.type === '股票' && extractAssetSymbol(a.name) === item.symbol);
                  if (assetIdx >= 0) {
                      const asset = updatedAssets[assetIdx];
                      if (asset.quantity && asset.quantity >= item.qty) {
                          if (asset.quantity === item.qty) { updatedAssets.splice(assetIdx, 1); }
                          else { const remainingQty = asset.quantity - item.qty; updatedAssets[assetIdx] = { ...asset, quantity: remainingQty, lastPurchasePrice: item.price, cost: remainingQty * item.price }; }
                      }
                  }
              });
          } else if (data.batchSellList && data.batchSellList.length > 0) {
              // 處理批次賣出
              data.batchSellList.forEach(item => {
                  updatedAssets = updatedAssets.filter(a => a.id !== item.asset.id);
                  if (item.liability) {
                      newState.liabilities = newState.liabilities.filter(l => l.id !== item.liability?.id);
                  }
              });
          } else if (data.relatedAssetId) {
              const assetToSell = updatedAssets.find(a => a.id === data.relatedAssetId);
              if (assetToSell) {
                  if (assetToSell.type === '定存') {
                      updatedAssets = updatedAssets.reduce((acc: Asset[], asset) => {
                          if (asset.id !== data.relatedAssetId) {
                              acc.push(asset);
                              return acc;
                          }

                          const remainingDeposit = Math.max(0, asset.cost - amount);
                          if (remainingDeposit > 0) {
                              acc.push({
                                  ...asset,
                                  cost: remainingDeposit,
                                  downPayment: remainingDeposit,
                                  cashflow: Math.floor(remainingDeposit * 0.01)
                              });
                          }
                          return acc;
                      }, []);
                  } else {
                      storageData.relatedAssetPayload = assetToSell;
                      updatedAssets = updatedAssets.filter(a => a.id !== data.relatedAssetId);

                      const assetSymbol = assetToSell.name.split(' ').slice(1).join(' ');
                      const loanType = assetToSell.type === '不動產' ? '不動產貸款' : assetToSell.type === '企業' ? '企業貸款' : (assetToSell.type === '汽車' || assetToSell.type === '飛行器') ? '汽車貸款' : null;

                      if (loanType) {
                          const loanName = `${loanType} (${assetSymbol})`.trim();
                          const removedLiabilities = newState.liabilities.filter(l => l.name === loanName);
                          storageData.removedLiabilities = removedLiabilities;
                          newState.liabilities = newState.liabilities.filter(l => l.name !== loanName);
                      }
                  }
              }
          }
          newState.assets = updatedAssets;
      } else if (data.usage === 'stock_update' && data.stockDividendPayload) {
          const updatedAssets = [...newState.assets];
          data.stockDividendPayload.items.forEach(item => {
              const idx = updatedAssets.findIndex(a => a.id === item.assetId);
              if (idx !== -1) {
                  const asset = updatedAssets[idx];
                  const newQty = (asset.quantity || 0) + item.addedQty;
                  updatedAssets[idx] = { ...asset, quantity: newQty, cost: newQty * (asset.lastPurchasePrice || 0) };
              }
          });
          newState.assets = updatedAssets;
      } else if (data.insuranceType && data.insurancePayload) {
          if (data.insuranceType === 'medical') { newState.medicalInsuranceCount = (newState.medicalInsuranceCount || 0) + (data.insurancePayload.medicalQty || 0); }
          else if (data.insuranceType === 'house' && data.insurancePayload.targetAssetIds) {
              const targetIds = data.insurancePayload.targetAssetIds;
              newState.assets = newState.assets.map(a => targetIds.includes(a.id) ? { ...a, isInsured: true } : a);
          } else if (data.insuranceType === 'aircraft') {
              newState.assets = newState.assets.map(a => (a.type === '汽車' || a.type === '飛行器') ? { ...a, isInsured: true } : a);
          }
        
          if (data.expensePayload) {
              const { category, amount: expAmount, isIncrease } = data.expensePayload;
              const currentVal = newState.expenses[category] || 0;
              newState.expenses = { ...newState.expenses, [category]: isIncrease ? currentVal + expAmount : Math.max(0, currentVal - expAmount) };
          }
      }

      if (data.pendingMedicalClaim) {
          const existingClaims = newState.pendingMedicalClaims || [];
          if (!existingClaims.some(claim => claim.id === data.pendingMedicalClaim?.id)) {
              newState.pendingMedicalClaims = [...existingClaims, data.pendingMedicalClaim];
          }
      }
      if (data.medicalClaimId) {
          newState.pendingMedicalClaims = (newState.pendingMedicalClaims || [])
              .filter(claim => claim.id !== data.medicalClaimId);
      }

      const { sourceLabel, usageLabel } = deriveTransactionLabels(data);
      const newTx: Transaction = {
          id: env.generateId(),
          timestamp: env.now,
          name: data.name,
          amount: amount,
          sourceLabel,
          usageLabel,
          cashChange: transactionCashChange,
          balance: newState.cash,
          details: JSON.stringify(storageData),
          flowType: flowType,
          ...(incomeMultiplierEligible ? {
              incomeMultiplierEligible: true,
              originalAmount: originalCashChange,
              appliedMultiplier
          } : {})
      };
      newState.history = [...newState.history, newTx];

      if (data.name.includes('達成事業成就')) {
          newState.happiness = newState.happiness.map(h => h.id === 'h_career' ? { ...h, checked: true } : h);
          if (prev.selectedEnterprise) {
              const e = prev.selectedEnterprise;
              const isRelated = prev.profession?.id === e.relatedProfessionId;
              const bonusPercent = isRelated ? prev.currentRankLevel * 10 : 0;
              const baseIncome = e.income;
              const bonusAmt = Math.floor(baseIncome * (bonusPercent / 100));
              newState.assets = newState.assets.map(asset =>
                  asset.id === storageData.createdAssetId
                      ? { ...asset, cashflow: baseIncome + bonusAmt }
                      : asset
              );
              const { [e.name]: _legacyDuplicateIncome, ...incomeWithoutDuplicate } = newState.income;
              newState.income = incomeWithoutDuplicate;
          }
      }
      else if (data.name.includes('實現人生夢想')) { newState.happiness = newState.happiness.map(h => h.id === 'h_dream' ? { ...h, checked: true } : h); }
      newState.happinessTotal = newState.happiness.reduce((sum, h) => sum + (h.checked ? h.points : 0), 0);

      if (data.boardEventId) {
          newState.appliedBoardFinancialEventIds = [...(prev.appliedBoardFinancialEventIds || []), data.boardEventId];
      }

      return newState;
};

export type ApplyBoardTransactionResult =
  | { status: 'applied'; state: GameState; message: string }
  | { status: 'duplicate'; state: GameState }
  | { status: 'error'; message: string };

/** 驗證＋套用（伺服器交易使用）。 */
export const applyBoardTransaction = (
  state: GameState,
  data: TransactionData,
  env: BoardTransactionEnv & { financialAcceleration?: FinancialAccelerationInput }
): ApplyBoardTransactionResult => {
  const prepared = prepareBoardTransaction(state, data, env.financialAcceleration);
  if (prepared.status === 'error') return prepared;
  if (prepared.status === 'duplicate') return { status: 'duplicate', state };
  return {
    status: 'applied',
    state: reduceBoardTransaction(state, prepared.prepared, env),
    message: prepared.prepared.message
  };
};
