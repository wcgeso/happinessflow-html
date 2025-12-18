
import React, { useState, useEffect, useMemo } from 'react';
import { Liability, Asset, Profession, Enterprise, Dream, HappinessItem } from '../types';
import { Button, Card, Input } from './ui';
import { STOCK_SYMBOLS, REAL_ESTATE_SYMBOLS, BUSINESS_SYMBOLS } from '../constants';
import { CheckCircle2, AlertCircle, PieChart, TrendingUp, TrendingDown, Wallet, HelpCircle, ArrowUpCircle, ArrowDownCircle, Trash2, Plane, Home, Zap, Coins, Box, ChevronRight, ShieldCheck, Heart, Star, Building2, X } from 'lucide-react';

const formatMoney = (amount: number) => `${amount.toLocaleString()} H`;

const getSellDisplayName = (asset: Asset) => {
  if (asset.type === '不動產' && asset.name) {
    const match = asset.name.match(/[A-Z]\d+/);
    if (match) return match[0];
  }
  return asset.name;
};

interface TransactionFormProps {
  profession: Profession | null;
  selectedEnterprise: Enterprise | null;
  selectedDream: Dream | null;
  cash: number;
  salary: number;
  assets?: Asset[];
  happiness?: HappinessItem[];
  liabilities: Liability[];
  onTransaction: (data: TransactionData) => void;
  onCancel: () => void;
}

export type SourceType = 'cash' | 'loan' | 'income' | 'storage';
export type UsageType = 'asset' | 'liability' | 'expense' | 'storage' | 'cash' | 'stock_update' | 'expense_update';
export type AssetType = '股票' | '不動產' | '企業' | '定存' | '保險' | '飛行器' | '目標企業' | '心儀夢想';

interface StockTransactionItem {
    symbol: string;
    price: number;
    qty: number;
}

export interface TransactionData {
  name: string;
  amount: number;
  source: SourceType;
  usage: UsageType;
  cashChange: number;
  assetDetails?: {
    cashflow: number;
    type: AssetType;
    downPayment: number;
    symbol?: string;
    quantity?: number;
    loanAmount?: number;
    loanInterest?: number;
    isSelfUse?: boolean;
    houseType?: string;
  };
  liabilityId?: string;
  relatedAssetId?: string;
  sellQuantity?: number; 
  stockList?: StockTransactionItem[]; 
  insuranceType?: string; 
  insurancePayload?: {
      medicalQty?: number;
      targetAssetIds?: string[];
      aircraft?: boolean;
  };
  stockDividendPayload?: {
      items: { assetId: string, addedQty: number }[];
  };
  expensePayload?: {
      category: 'tax' | 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
      amount: number;
      isIncrease: boolean;
  };
  impacts?: string[];
}

type AccountCategory = 'Assets' | 'Liabilities' | 'Income' | 'Expenses';
type ChangeDirection = 'Increase' | 'Decrease';

interface AccountEntry {
  category: AccountCategory;
  name: string;
  direction: ChangeDirection;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ profession, selectedEnterprise, selectedDream, cash, salary, assets = [], happiness = [], liabilities = [], onTransaction, onCancel }) => {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<'buy' | 'sell' | 'loan' | 'dividend' | 'event'>('buy');
  
  const [assetType, setAssetType] = useState<AssetType>('股票');
  const [stockInputs, setStockInputs] = useState<Record<string, { price: string, qty: string }>>({});

  const [reSelfUse, setReSelfUse] = useState(false);
  const [reSymbol, setReSymbol] = useState(REAL_ESTATE_SYMBOLS[0]);
  const [reDownPayment, setReDownPayment] = useState<string>('');
  const [reLoan, setReLoan] = useState<string>('');
  const [reInterest, setReInterest] = useState<string>('');
  const [reIncome, setReIncome] = useState<string>('');
  const [reHouseType, setReHouseType] = useState<string>('1room');
  
  const [bizSymbol, setBizSymbol] = useState(BUSINESS_SYMBOLS[0]);
  const [bizCost, setBizCost] = useState<string>('');
  const [bizLoan, setBizLoan] = useState<string>('');
  const [bizIncome, setBizIncome] = useState<string>('');
  
  const [cdAmount, setCdAmount] = useState<string>('');
  const [insType, setInsType] = useState<string>('medical');
  const [insMedicalQty, setInsMedicalQty] = useState<string>('1');
  const [insSelectedHouses, setInsSelectedHouses] = useState<string[]>([]);
  const [insAircraftSelected, setInsAircraftSelected] = useState(false);

  const [aircraftCash, setAircraftCash] = useState<string>('');
  const [aircraftLoan, setAircraftLoan] = useState<string>('');

  const [sellCat, setSellCat] = useState<AssetType>('股票');
  const [sellStockInputs, setSellStockInputs] = useState<Record<string, { price: string, qty: string }>>({});
  const [repayInputs, setRepayInputs] = useState<Record<string, string>>({});

  const [withdrawAmount, setWithdrawAmount] = useState<string>(''); 

  const [loanSubMode, setLoanSubMode] = useState<'borrow' | 'repay'>('borrow');
  const [repayType, setRepayType] = useState<'信用貸款' | '不動產貸款' | '企業貸款'>('信用貸款');
  const [borrowAmount, setBorrowAmount] = useState<string>('');
  const [repayAmount, setRepayAmount] = useState<string>('');

  const [divMode, setDivMode] = useState<'cash' | 'stock'>('cash');
  const [divInputs, setDivInputs] = useState<Record<string, string>>({});

  const [eventSubMode, setEventSubMode] = useState<'pay' | 'inc_exp' | 'dec_exp'>('pay');
  const [eventPayType, setEventPayType] = useState<string>('medical');
  const [eventAmount, setEventAmount] = useState<string>('');
  const [eventCustomName, setEventCustomName] = useState('');
  const [eventExpCategory, setEventExpCategory] = useState<'basicLiving' | 'transportEdu' | 'otherMedicalChild'>('basicLiving');

  const [userEntries, setUserEntries] = useState<AccountEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<TransactionData | null>(null);
  const [correctEntries, setCorrectEntries] = useState<AccountEntry[]>([]);

  const filteredAssets = assets.filter(a => a.type === sellCat);
  const stockAssets = assets.filter(a => a.type === '股票');
  const cdTotal = assets.filter(a => a.type === '定存').reduce((sum, a) => sum + a.cost, 0);
  const creditLoanTotal = liabilities
    .filter(l => l.type === '信用貸款')
    .reduce((sum, l) => sum + l.totalOwed, 0);

  const [sellStockDetails, setSellStockDetails] = useState<
    Record<string, { price: string; qty: string }>
  >({});

  const uninsuredHouses = useMemo(() => assets.filter(a => a.type === '不動產' && !a.isInsured), [assets]);
  const hasAircraftAsset = useMemo(() => assets.some(a => a.type === '飛行器' as any), [assets]);

  // 符合第 2 點：欄位驗證邏輯
  const handlePhase1Submit = () => {
      let txData: TransactionData | null = null; 
      let expectedEntries: AccountEntry[] = [];
      let impactList: string[] = [];
      setErrorMessage(null);

      if (mode === 'buy') {
              if (assetType === '股票') {
              const list: StockTransactionItem[] = (Object.entries(stockInputs) as [string, { price: string, qty: string }][])
                .filter(([_, val]) => Number(val.price) > 0 && Number(val.qty) > 0)
                .map(([symbol, val]) => ({ symbol, price: Number(val.price), qty: Number(val.qty) }));
              if (list.length === 0) { setErrorMessage("請輸入股票資訊（單價與張數）"); return; }
              const totalCost = list.reduce((sum, item) => sum + (item.price * item.qty), 0);
              if (totalCost > cash) { setErrorMessage("現金不足"); return; }
              txData = { name: `購買股票 (${list.length}筆)`, amount: totalCost, cashChange: -totalCost, source: 'cash', usage: 'asset', stockList: list, assetDetails: { type: '股票', cashflow: 0, downPayment: totalCost } };
              impactList.push(`現金 -${formatMoney(totalCost)}`);
              impactList.push(`股票資產 +${formatMoney(totalCost)}`);
              expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
              list.forEach(s => expectedEntries.push({ category: 'Assets', name: `股票 (${s.symbol})`, direction: 'Increase' }));
          } else if (assetType === '不動產') {
              if (!reDownPayment) { setErrorMessage("請輸入頭期款"); return; }
              const down = Number(reDownPayment), loan = Number(reLoan), inc = Number(reIncome), inter = Number(reInterest);
              if (down > cash) { setErrorMessage("現金不足"); return; }
              txData = {
                  name: `購買不動產 ${reSymbol} ${reSelfUse ? '(自用)' : ''}`,
                  amount: down + loan,
                  cashChange: -down,
                  source: loan > 0 ? 'loan' : 'cash',
                  usage: 'asset',
                  assetDetails: {
                    type: '不動產',
                    cashflow: reSelfUse ? 0 : inc,
                    downPayment: down,
                    loanAmount: loan,
                    loanInterest: inter,
                    symbol: reSymbol,
                    isSelfUse: reSelfUse,
                    houseType: reHouseType
                  }
              };
              impactList.push(`現金 -${formatMoney(down)}`);
              impactList.push(`不動產資產 +${formatMoney(down + loan)}`);
              if (loan > 0) {
                  impactList.push(`不動產貸款 +${formatMoney(loan)}`);
                  impactList.push(`貸款利息(月) +${formatMoney(inter)}`);
              }
              if (!reSelfUse && inc > 0) {
                  impactList.push(`租金收入(月) +${formatMoney(inc)}`);
              }
              expectedEntries.push({ category: 'Assets', name: `不動產 (${reSymbol})`, direction: 'Increase' });
              if (down > 0) expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
              if (loan > 0) { expectedEntries.push({ category: 'Liabilities', name: '不動產貸款', direction: 'Increase' }); expectedEntries.push({ category: 'Expenses', name: '不動產貸款利息', direction: 'Increase' }); }
              if (!reSelfUse && inc > 0) expectedEntries.push({ category: 'Income', name: '租金收入', direction: 'Increase' });
          } else if (assetType === '企業') {
              if (!bizCost) { setErrorMessage("請輸入投資金額"); return; }
              const cost = Number(bizCost), ln = Number(bizLoan), inc = Number(bizIncome);
              const cashChange = ln - cost;
              if (cashChange < 0 && Math.abs(cashChange) > cash) { setErrorMessage("現金不足"); return; }

              txData = { name: `投資企業 ${bizSymbol}`, amount: cost, cashChange: cashChange, source: ln > 0 ? 'loan' : 'cash', usage: 'asset', assetDetails: { type: '企業', cashflow: inc, downPayment: cost, loanAmount: ln, loanInterest: Math.floor(ln * 0.005), symbol: bizSymbol } };
              
              // Impacts
              if (cashChange > 0) impactList.push(`現金 +${formatMoney(cashChange)} (超貸部分)`);
              else if (cashChange < 0) impactList.push(`現金 -${formatMoney(Math.abs(cashChange))}`);
              
              impactList.push(`企業資產價值 +${formatMoney(cost)}`);
              
              if (ln > 0) {
                  impactList.push(`企業貸款 +${formatMoney(ln)}`);
                  impactList.push(`貸款利息(月) +${formatMoney(Math.floor(ln * 0.005))}`);
              }
              if (inc > 0) impactList.push(`企業收益(月) +${formatMoney(inc)}`);

              expectedEntries.push({ category: 'Assets', name: `企業 (${bizSymbol})`, direction: 'Increase' });
              
              // Cash Check Logic
              if (cashChange > 0) {
                  expectedEntries.push({ category: 'Assets', name: '現金（企業貸款）', direction: 'Increase' });
              } else if (cashChange < 0) {
                  expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
              }

              if (ln > 0) { 
                  expectedEntries.push({ category: 'Liabilities', name: '企業貸款', direction: 'Increase' }); 
                  expectedEntries.push({ category: 'Expenses', name: '企業貸款利息', direction: 'Increase' });
              }
              if (inc > 0) expectedEntries.push({ category: 'Income', name: '企業收益', direction: 'Increase' });

          } else if (assetType === '定存') {
              const amt = Number(cdAmount); 
              if (!amt) { setErrorMessage("請輸入金額"); return; }
              if (amt <= 0 || amt % 10000 !== 0) { setErrorMessage("定存金額必須為 10,000 的倍數且大於 0"); return; }
              if (amt > cash) { setErrorMessage("現金不足"); return; }
              txData = { name: '存入定存', amount: amt, cashChange: -amt, source: 'cash', usage: 'asset', assetDetails: { type: '定存', cashflow: Math.floor(amt * 0.005), downPayment: amt } };
              impactList = [`現金 -${formatMoney(amt)}`, `定存 +${formatMoney(amt)}`, `定存利息(月) +${formatMoney(Math.floor(amt * 0.005))}`];
              expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Assets', name: '定存', direction: 'Increase' }, { category: 'Income', name: '定存利息', direction: 'Increase' } ];
          } else if (assetType === '保險') {
              let desc = '', pay: any = {}, qty = 0;
              if (insType === 'medical') { 
                  qty = Number(insMedicalQty); 
                  if (qty <= 0) { setErrorMessage("請輸入張數"); return; }
                  desc = `購買醫療保險 (${qty}張)`; pay = { medicalQty: qty }; 
              }
              else if (insType === 'house') { 
                  qty = insSelectedHouses.length; 
                  if (qty <= 0) { setErrorMessage("請選擇投保房屋"); return; }
                  desc = `購買房屋保險 (${qty}間)`; pay = { targetAssetIds: insSelectedHouses }; 
              }
              else if (insType === 'aircraft') {
                  if (!insAircraftSelected) { setErrorMessage("請勾選飛行器保險"); return; }
                  qty = 1; desc = `購買飛行器保險`; pay = { aircraft: true };
              }
              
              const totalCost = qty * 2000;
              if (totalCost > cash) { setErrorMessage("現金不足"); return; }
              
              txData = { name: desc, amount: totalCost, cashChange: -totalCost, source: 'cash', usage: 'expense', insuranceType: insType, insurancePayload: pay };
              impactList = [`現金 -${formatMoney(totalCost)}`, `保險月支出 +${formatMoney(totalCost)} (計入總支出)`];
              expectedEntries = [ 
                  { category: 'Assets', name: '現金', direction: 'Decrease' },
                  { category: 'Expenses', name: '保險支出', direction: 'Increase' } 
              ];
          } else if (assetType === '飛行器') {
              const c = Number(aircraftCash), l = Number(aircraftLoan);
              if (!c && !l) { setErrorMessage("請填寫金額"); return; }
              if (c > cash) { setErrorMessage("現金不足"); return; }
              txData = { name: '購買飛行器', amount: 500000, cashChange: -c, source: l > 0 ? 'loan' : 'cash', usage: 'asset', assetDetails: { type: '飛行器' as any, cashflow: 0, downPayment: c, loanAmount: l, loanInterest: Math.floor(l * 0.005) } };
              impactList.push(`現金 -${formatMoney(c)}`);
              impactList.push(`飛行器資產 +${formatMoney(500000)}`);
              if (l > 0) impactList.push(`飛行器貸款 +${formatMoney(l)}`);
              expectedEntries.push({ category: 'Assets', name: '飛行器', direction: 'Increase' });
              if(c > 0) expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Decrease' });
              if(l > 0) { expectedEntries.push({ category: 'Liabilities', name: '飛行器貸款', direction: 'Increase' }); expectedEntries.push({ category: 'Expenses', name: '飛行器貸款利息', direction: 'Increase' }); }
          }
      } else if (mode === 'sell') {
          if (sellCat === '股票') {
              const entries = (Object.entries(sellStockDetails) as [
                string,
                { price: string; qty: string }
              ][]).filter(([_, val]) => Number(val.price) > 0 && Number(val.qty) > 0);
              if (entries.length === 0) { setErrorMessage("請輸入股票售價與賣出張數"); return; }

              const list: StockTransactionItem[] = [];
              let totalGain = 0;

              for (const [assetId, val] of entries) {
                  const asset = assets.find(a => a.id === assetId);
                  if (!asset || !asset.quantity) continue;
                  const qty = Number(val.qty);
                  const price = Number(val.price);
                  if (qty <= 0 || price <= 0) continue;
                  if (qty > asset.quantity) { setErrorMessage("賣出張數不可大於持有張數"); return; }
                  const symbol = asset.name.replace('股票 ', '');
                  list.push({ symbol, price, qty });
                  totalGain += price * qty;
              }

              if (list.length === 0) { setErrorMessage("請確認輸入的股票資料正確"); return; }

              txData = {
                  name: `賣出股票 (${list.length}筆)`,
                  amount: totalGain,
                  cashChange: totalGain,
                  source: 'income',
                  usage: 'cash',
                  stockList: list
              };
              impactList = [`現金 +${formatMoney(totalGain)}`, `股票資產 減少`];
              expectedEntries.push({ category: 'Assets', name: '現金', direction: 'Increase' });
              list.forEach(s =>
                  expectedEntries.push({
                      category: 'Assets',
                      name: `股票 (${s.symbol})`,
                      direction: 'Decrease'
                  })
              );
          } else if (sellCat === '定存') {
              const amt = Number(withdrawAmount); 
              if (!amt) { setErrorMessage("請輸入解約金額"); return; }
              if (amt > cdTotal) { setErrorMessage("超過定存餘額"); return; }
              txData = { name: `定存解約`, amount: amt, cashChange: amt, source: 'income', usage: 'cash', relatedAssetId: assets.find(a => a.type === '定存')?.id };
              impactList = [`現金 +${formatMoney(amt)}`, `定存 -${formatMoney(amt)}`];
              expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Increase' }, { category: 'Assets', name: '定存', direction: 'Decrease' } ];
          } else {
              const entries = (Object.entries(repayInputs) as [string, string][]).filter(([_, val]) => Number(val) > 0);
              if (entries.length === 0) { setErrorMessage("請輸入售價"); return; }
              const [id, price] = entries[0];
              const asset = assets.find(a => a.id === id); if (!asset) return;
              txData = { name: `賣出 ${asset.name}`, amount: Number(price), cashChange: Number(price), source: 'income', usage: 'cash', relatedAssetId: asset.id };
              impactList = [`現金 +${formatMoney(Number(price))}`, `${asset.name} 減少`];
              expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Increase' }, { category: 'Assets', name: asset.name, direction: 'Decrease' } ];
          }
      } else if (mode === 'loan') {
          if (loanSubMode === 'borrow') {
              const amt = Number(borrowAmount);
              if (!amt) { setErrorMessage("請輸入借貸金額"); return; }
              if (amt > salary * 10) { setErrorMessage(`上限為 $${(salary * 10).toLocaleString()} H`); return; }
              txData = { name: `申請信用貸款`, amount: amt, cashChange: amt, source: 'loan', usage: 'cash', assetDetails: { type: '股票', cashflow: 0, downPayment: 0, loanAmount: amt, loanInterest: Math.floor(amt * 0.1) } };
              impactList = [`現金 +${formatMoney(amt)}`, `信用貸款 +${formatMoney(amt)}`, `信貸利息 +${formatMoney(Math.floor(amt * 0.1))}`];
              expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Increase' }, { category: 'Liabilities', name: '信用貸款', direction: 'Increase' }, { category: 'Expenses', name: '信貸利息（貸款金額x10%）', direction: 'Increase' } ];
          } else {
              if (repayType === '信用貸款') {
                  const amt = Number(repayAmount); 
                  if (!amt) { setErrorMessage("請輸入還款金額"); return; }
                  if (amt > cash) { setErrorMessage("現金不足"); return; }
                  txData = { name: `償還 信用貸款`, amount: amt, cashChange: -amt, source: 'cash', usage: 'liability', liabilityId: 'bank_loan' };
                  impactList = [`現金 -${formatMoney(amt)}`, `信用貸款 -${formatMoney(amt)}`, `信貸利息 減少`];
                  expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Liabilities', name: '信用貸款', direction: 'Decrease' }, { category: 'Expenses', name: '信貸利息（貸款金額x10%）', direction: 'Decrease' } ];
              } else {
                  const entries = (Object.entries(repayInputs) as [string, string][]).filter(([_, val]) => Number(val) > 0);
                  if (entries.length === 0) { setErrorMessage("請輸入還款金額"); return; }
                  const [id, amtStr] = entries[0];
                  const liab = liabilities.find(l => l.id === id); if (!liab) return;
                  txData = { name: `償還 ${liab.name}`, amount: Number(amtStr), cashChange: -Number(amtStr), source: 'cash', usage: 'liability', liabilityId: liab.id };
                  
                  const interestLabel = repayType === '不動產貸款' ? '不動產貸款利息' : '企業貸款利息';
                  
                  // Logic 1 Corrected: Cash Decrease, Liability Decrease, Interest Decrease
                  impactList = [`現金 -${formatMoney(Number(amtStr))}`, `${liab.name} -${formatMoney(Number(amtStr))}`, `${interestLabel} 減少`];
                  
                  expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Decrease' }, { category: 'Liabilities', name: liab.name, direction: 'Decrease' }, { category: 'Expenses', name: interestLabel, direction: 'Decrease' } ];
              }
          }
      } else if (mode === 'dividend') {
          const entries = (Object.entries(divInputs) as [string, string][]).filter(([_, val]) => Number(val) > 0);
          if (entries.length === 0) { setErrorMessage("請輸入發放股利的內容"); return; }
          
          if (divMode === 'cash') {
              const totalDiv = entries.reduce((sum, [_, val]) => sum + Number(val), 0);
              txData = { name: `領取股票現金股利`, amount: totalDiv, cashChange: totalDiv, source: 'income', usage: 'cash' };
              impactList = [`現金 +${formatMoney(totalDiv)}`];
              expectedEntries = [ { category: 'Income', name: '股利', direction: 'Increase' }, { category: 'Assets', name: '現金', direction: 'Increase' } ];
          } else {
              const items = entries.map(([assetId, val]) => ({ assetId, addedQty: Number(val) }));
              txData = { name: `領取配股股利`, amount: 0, cashChange: 0, source: 'income', usage: 'stock_update', stockDividendPayload: { items } };
              impactList = [`股票張數 增加`];
              expectedEntries = entries.map(([assetId, _]) => {
                  const a = assets.find(s => s.id === assetId);
                  return { category: 'Assets', name: `股票 (${a?.name.replace('股票 ','')})`, direction: 'Increase' as ChangeDirection };
              });
          }
      } else if (mode === 'event') {
          const amt = Number(eventAmount);
          if (!amt && eventSubMode === 'pay') { setErrorMessage("請輸入支付金額"); return; }
          if (eventSubMode === 'pay') {
              if (amt > cash) { setErrorMessage("現金不足"); return; }
              txData = { name: eventPayType === 'medical' ? '支付醫藥費' : eventPayType === 'maintenance' ? '支付飛行器維修費' : eventCustomName || '支付事件', amount: amt, cashChange: -amt, source: 'cash', usage: 'expense' };
              impactList = [`現金 -${formatMoney(amt)}`];
              expectedEntries = [ { category: 'Assets', name: '現金', direction: 'Decrease' } ];
          } else {
              // Logic 2 & 3: Only Monthly Expense Increases/Decreases
              if (!amt) { setErrorMessage("請輸入月變動金額"); return; }
              const isInc = eventSubMode === 'inc_exp';
              txData = { name: `${isInc ? '增加' : '減少'}月支出`, amount: 0, cashChange: 0, source: 'income', usage: 'expense_update', expensePayload: { category: eventExpCategory, amount: amt || 0, isIncrease: isInc } };
              impactList = [`月支出 ${isInc ? '+' : '-'}${formatMoney(amt)}`];
              expectedEntries = [ { category: 'Expenses', name: '其他支出', direction: isInc ? 'Increase' : 'Decrease' } ];
          }
      }

      if (txData) { 
          // Logic 5: Transaction completion screen always shows transaction details
          txData.impacts = impactList;
          setPendingTx(txData); 
          setCorrectEntries(expectedEntries); 
          setPhase(2); 
          setUserEntries([]); 
      }
  };

  const toggleEntry = (category: AccountCategory, direction: ChangeDirection, name: string) => {
    setUserEntries(prev => {
        const existingIndex = prev.findIndex(e => e.category === category && e.name === name);
        if (existingIndex !== -1) { 
            if (prev[existingIndex].direction === direction) return prev.filter((_, idx) => idx !== existingIndex);
            const updated = [...prev]; updated[existingIndex] = { ...updated[existingIndex], direction }; return updated;
        }
        return [...prev, { category, name, direction }];
    });
  };

  const checkAnswers = () => {
      const isCorrect = correctEntries.length === userEntries.length && correctEntries.every(correct => userEntries.some(user => user.category === correct.category && user.name === correct.name && user.direction === correct.direction));
      if (isCorrect) { setPhase(3); } else { setErrorMessage("答案不正確，請依照交易影響重新檢視項目與增減方向"); }
  };

  const possibleItemsAssets = useMemo(() => {
     const base = ['現金', '現金（企業貸款）'];
     if (mode === 'buy') {
         if (assetType === '定存') base.push('定存'); 
         if (assetType === '股票') STOCK_SYMBOLS.forEach(s => base.push(`股票 (${s})`)); 
         if (assetType === '不動產') base.push(`不動產 (${reSymbol})`); 
         if (assetType === '企業') base.push(`企業 (${bizSymbol})`);
         if (assetType === '飛行器') base.push('飛行器');
     }
     if (mode === 'sell') { 
         if (sellCat === '股票') stockAssets.forEach(s => base.push(`股票 (${s.name.replace('股票 ','')})`)); 
         else if (sellCat === '定存') base.push('定存');
         else assets.filter(a => a.type === sellCat).forEach(a => base.push(a.name));
     }
     if (mode === 'dividend' && divMode === 'stock') {
         stockAssets.forEach(s => base.push(`股票 (${s.name.replace('股票 ','')})`));
     }
     return [...new Set(base)];
  }, [mode, assetType, reSymbol, bizSymbol, sellCat, assets, stockAssets, divMode]);

  const possibleItemsIncome = ['租金收入', '企業收益', '股利', '定存利息'];
  const possibleItemsLiabilities = ['信用貸款', '不動產貸款', '企業貸款', '飛行器貸款'].concat(liabilities.map(l => l.name));
  const possibleItemsExpenses = ['信貸利息（貸款金額x10%）', '不動產貸款利息', '企業貸款利息', '飛行器貸款利息', '其他支出', '投資損失', '保險支出', '餐飲服飾居住', '交通教育娛樂', '其他醫療育兒'];

  return (
    <Card className="bg-slate-900 border-slate-600 shadow-2xl max-w-4xl w-full mx-auto animate-in zoom-in-95 overflow-hidden flex flex-col h-[85vh]">
      <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center shrink-0">
        <h3 className="text-xl font-bold text-white flex items-center gap-2"> 
            {phase === 1 ? <><Wallet className="text-emerald-400"/> 交易資料輸入</> : phase === 2 ? <><HelpCircle className="text-yellow-400"/> 財務思維檢核</> : <><CheckCircle2 className="text-emerald-400"/> 交易完成</>} 
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">取消</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {phase === 1 && (
              <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
                  <div className="grid grid-cols-5 gap-1 bg-slate-800 p-1 rounded-lg">
                      {['buy', 'sell', 'loan', 'dividend', 'event'].map(m => (
                        <button key={m} onClick={() => {setMode(m as any); setErrorMessage(null);}} className={`py-2 rounded font-bold text-[11px] transition-all ${mode === m ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
                            {m === 'buy' ? '購買' : m === 'sell' ? '賣出' : m === 'loan' ? '信貸/還款' : m === 'dividend' ? '發放股利' : '遊戲事件'}
                        </button>
                      ))}
                  </div>

                  {mode === 'buy' && (
                    <div className="space-y-4">
                        <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto no-scrollbar">
                            {['股票', '不動產', '企業', '定存', '保險', '飛行器', '目標企業', '心儀夢想'].map(t => (
                                <button key={t} onClick={() => {setAssetType(t as any); setErrorMessage(null);}} className={`px-4 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${assetType === t ? 'bg-emerald-900 text-emerald-300 border border-emerald-500' : 'text-slate-400 hover:bg-slate-800'}`}>{t}</button>
                            ))}
                        </div>
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                            {assetType === '股票' && ( 
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2 px-2 text-[10px] text-slate-500 font-bold uppercase"><span>代號</span><span>價格</span><span>張數</span></div>
                                    {STOCK_SYMBOLS.map(symbol => (
                                        <div key={symbol} className="grid grid-cols-3 gap-2 items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                            <span className="text-sm font-bold text-white">{symbol}</span>
                                            <Input type="number" placeholder="單價" className="h-8 text-xs" value={stockInputs[symbol]?.price || ''} onChange={e => setStockInputs({...stockInputs, [symbol]: { ...stockInputs[symbol], price: e.target.value }})} />
                                            <Input type="number" placeholder="張數" className="h-8 text-xs" value={stockInputs[symbol]?.qty || ''} onChange={e => setStockInputs({...stockInputs, [symbol]: { ...stockInputs[symbol], qty: e.target.value }})} />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {assetType === '不動產' && ( 
                                <div className="space-y-4">
                                    <div className="flex gap-4"><label className="flex items-center gap-2 text-sm text-slate-300"><input type="radio" checked={!reSelfUse} onChange={() => setReSelfUse(false)} className="accent-emerald-500" /> 出租用</label><label className="flex items-center gap-2 text-sm text-slate-300"><input type="radio" checked={reSelfUse} onChange={() => setReSelfUse(true)} className="accent-emerald-500" /> 自用</label></div>
                                    <div><label className="text-xs text-slate-400 block mb-1">住宅房型</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-emerald-400 font-bold" value={reHouseType} onChange={e => setReHouseType(e.target.value)}><option value="1room">單間小套房</option><option value="2room">兩室一廳</option><option value="3room">三室兩廳</option><option value="5room">五室三廳</option>{!reSelfUse && <option value="store">店面</option>}</select></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 block mb-1">代號</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2" value={reSymbol} onChange={e => setReSymbol(e.target.value)}>{REAL_ESTATE_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="text-xs text-slate-400 block mb-1">首付</label><Input type="number" value={reDownPayment} onChange={e => setReDownPayment(e.target.value)} /></div></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 block mb-1">房貸金額</label><Input type="number" value={reLoan} onChange={e => setReLoan(e.target.value)} /></div><div><label className="text-xs text-slate-400 block mb-1">房貸每月本利和</label><Input type="number" value={reInterest} onChange={e => setReInterest(e.target.value)} /></div></div>
                                    {!reSelfUse && <div><label className="text-xs text-slate-400 block mb-1">租金收入</label><Input type="number" value={reIncome} onChange={e => setReIncome(e.target.value)} /></div>}
                                </div>
                            )}
                            {assetType === '企業' && ( 
                                <div className="space-y-4">
                                    <div><label className="text-xs text-slate-400 block mb-1">企業代號</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2" value={bizSymbol} onChange={e => setBizSymbol(e.target.value)}>{BUSINESS_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 block mb-1">投資金額</label><Input type="number" value={bizCost} onChange={e => setBizCost(e.target.value)} /></div><div><label className="text-xs text-slate-400 block mb-1">企業貸款</label><Input type="number" value={bizLoan} onChange={e => setBizLoan(e.target.value)} /></div></div>
                                    <div><label className="text-xs text-slate-400 block mb-1">每月收益</label><Input type="number" value={bizIncome} onChange={e => setBizIncome(e.target.value)} /></div>
                                </div>
                            )}
                            {assetType === '定存' && (
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">存入金額 (10,000 為單位)</label>
                                    <div className="text-xs text-emerald-400 mb-2 font-bold">目前持有現金: {formatMoney(cash)}</div>
                                    <Input type="number" value={cdAmount} onChange={e => setCdAmount(e.target.value)} />
                                </div>
                            )}
                            {assetType === '保險' && ( 
                                <div className="space-y-4">
                                    <div className="flex gap-2 mb-4 bg-slate-800 p-1 rounded-lg">
                                      <button onClick={() => {setInsType('medical'); setErrorMessage(null);}} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'medical' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>醫療保險</button>
                                      <button onClick={() => {setInsType('house'); setErrorMessage(null);}} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'house' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>房屋保險</button>
                                      <button onClick={() => {setInsType('aircraft'); setErrorMessage(null);}} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'aircraft' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>飛行器保險</button>
                                    </div>
                                    {insType === 'medical' && (<div><label className="text-xs text-slate-400 block mb-1">購買張數</label><Input type="number" value={insMedicalQty} onChange={e => setInsMedicalQty(e.target.value)} /></div>)}
                                    {insType === 'house' && (<div className="space-y-2 max-h-40 overflow-y-auto pr-1">{uninsuredHouses.length > 0 ? uninsuredHouses.map(h => <div key={h.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700" onClick={() => setInsSelectedHouses(prev => prev.includes(h.id) ? prev.filter(i => i !== h.id) : [...prev, h.id])}><input type="checkbox" checked={insSelectedHouses.includes(h.id)} readOnly className="accent-emerald-500"/><span className="text-sm text-slate-200">{h.name}</span></div>) : <p className="text-center text-slate-500 text-xs py-4 italic">目前無房屋可投保</p>}</div>)}
                                    {insType === 'aircraft' && (
                                        <div className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${!hasAircraftAsset ? 'opacity-50 grayscale bg-slate-800 border-slate-700' : 'bg-slate-900 border-emerald-500/50 cursor-pointer'}`} onClick={() => hasAircraftAsset && setInsAircraftSelected(!insAircraftSelected)}>
                                            <input type="checkbox" checked={insAircraftSelected} disabled={!hasAircraftAsset} readOnly className="accent-emerald-500 w-5 h-5" />
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-white">飛行器事故險</div>
                                                <div className="text-[10px] text-slate-400">{!hasAircraftAsset ? '需先持有飛行器' : '全方位飛行保障'}</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-800/30 flex justify-between items-center text-xs text-emerald-300"><span>每張保費</span><span className="font-bold">2,000 H</span></div>
                                </div>
                            )}
                            {assetType === '飛行器' && (<div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 block mb-1">支付現金</label><Input type="number" value={aircraftCash} onChange={e => setAircraftCash(e.target.value)} /></div><div><label className="text-xs text-slate-400 block mb-1">貸款額度</label><Input type="number" value={aircraftLoan} onChange={e => setAircraftLoan(e.target.value)} /></div></div>)}
                        </div>
                    </div>
                  )}

                  {mode === 'sell' && (
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                        <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto no-scrollbar">
                            {['股票', '不動產', '企業', '定存'].map(t => (
                                <button key={t} onClick={() => { setSellCat(t as any); setRepayInputs({}); setWithdrawAmount(''); setErrorMessage(null); }} className={`px-4 py-1 rounded-full text-xs whitespace-nowrap transition-all ${sellCat === t ? 'bg-blue-900 text-blue-300 border border-blue-500' : 'text-slate-400 hover:bg-slate-800'}`}>{t}</button>
                            ))}
                        </div>
                        {sellCat === '定存' ? (
                            <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                                <div className="flex justify-between text-sm mb-4">
                                  <span>持有定存額</span>
                                  <span className="text-orange-400 font-bold">{formatMoney(cdTotal)}</span>
                                </div>
                                <Input
                                  type="number"
                                  placeholder="解約金額"
                                  value={withdrawAmount}
                                  onChange={e => setWithdrawAmount(e.target.value)}
                                />
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {filteredAssets.length > 0 ? (
                                  filteredAssets.map(a => (
                                    <div
                                      key={a.id}
                                      className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700 hover:bg-slate-900 transition-colors"
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">
                                          {getSellDisplayName(a)}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          價值: {a.cost.toLocaleString()} H
                                        </span>
                                        {a.type === '股票' && (
                                          <span className="text-[10px] text-slate-500">
                                            持有張數: {a.quantity || 0} 張
                                          </span>
                                        )}
                                        {a.type === '企業' && (
                                          <span className="text-[10px] text-slate-500">
                                            每月企業收益: {a.cashflow.toLocaleString()} H
                                          </span>
                                        )}
                                      </div>
                                      {a.type === '股票' ? (
                                        <div className="flex flex-col gap-1 w-40">
                                          <Input
                                            type="number"
                                            placeholder="每張股價"
                                            className="h-8 text-xs"
                                            value={sellStockDetails[a.id]?.price || ''}
                                            onChange={e =>
                                              setSellStockDetails(prev => ({
                                                ...prev,
                                                [a.id]: {
                                                  ...(prev[a.id] || { price: '', qty: '' }),
                                                  price: e.target.value
                                                }
                                              }))
                                            }
                                          />
                                          <Input
                                            type="number"
                                            placeholder="賣出張數"
                                            className="h-8 text-xs"
                                            value={sellStockDetails[a.id]?.qty || ''}
                                            onChange={e =>
                                              setSellStockDetails(prev => ({
                                                ...prev,
                                                [a.id]: {
                                                  ...(prev[a.id] || { price: '', qty: '' }),
                                                  qty: e.target.value
                                                }
                                              }))
                                            }
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-32">
                                          <Input
                                            type="number"
                                            placeholder="售價"
                                            className="h-9 text-xs"
                                            value={repayInputs[a.id] || ''}
                                            onChange={e => setRepayInputs({ [a.id]: e.target.value })}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-center text-slate-500 py-6 italic text-sm">
                                    尚無資產可出售
                                  </p>
                                )}
                            </div>
                        )}
                    </div>
                  )}

                  {mode === 'loan' && (
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                        <div className="flex bg-slate-900 p-1 rounded-lg"><button onClick={() => {setLoanSubMode('borrow'); setErrorMessage(null);}} className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${loanSubMode === 'borrow' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>借款</button><button onClick={() => {setLoanSubMode('repay'); setErrorMessage(null);}} className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${loanSubMode === 'repay' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>還款</button></div>
                        {loanSubMode === 'borrow' ? (
                            <div><label className="text-xs text-slate-400 block mb-1">借貸額度 (利息 10%，上限: {(salary * 10).toLocaleString()} H)</label><Input type="number" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} /></div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-center gap-2 border-b border-slate-700 pb-2">{(['信用貸款', '不動產貸款', '企業貸款'] as const).map(t => (<button key={t} onClick={() => { setRepayType(t); setRepayInputs({}); setRepayAmount(''); }} className={`px-4 py-1.5 rounded-full text-[10px] whitespace-nowrap font-bold transition-all ${repayType === t ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-700 text-slate-400'}`}>{t}</button>))}</div>
                                {repayType === '信用貸款' ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>目前信貸餘額</span>
                                            <span className="font-mono text-orange-300 font-bold">
                                                {formatMoney(creditLoanTotal)}
                                            </span>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 block mb-1">
                                                本次還款金額
                                            </label>
                                            <Input
                                                type="number"
                                                value={repayAmount}
                                                onChange={e => setRepayAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {liabilities.filter(l => l.type === repayType).length > 0 ? liabilities.filter(l => l.type === repayType).map(liab => (
                                            <div key={liab.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700"><div className="flex flex-col gap-0.5"><span className="text-sm font-bold text-white">{liab.name}</span><span className="text-[10px] text-slate-500">餘額: {liab.totalOwed.toLocaleString()} H</span></div><div className="w-32"><Input type="number" placeholder="還款額" className="h-9 text-xs" value={repayInputs[liab.id] || ''} onChange={e => setRepayInputs({[liab.id]: e.target.value})} /></div></div>
                                        )) : <p className="text-center text-slate-500 text-sm py-4 italic">尚無貸款記錄</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  )}

                  {mode === 'dividend' && (
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4 animate-in slide-in-from-bottom-2">
                        <div className="flex bg-slate-900 p-1 rounded-lg">
                            <button onClick={() => {setDivMode('cash'); setDivInputs({});}} className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${divMode === 'cash' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>領取現金股利</button>
                            <button onClick={() => {setDivMode('stock'); setDivInputs({});}} className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${divMode === 'stock' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>領取配股股利</button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {stockAssets.length > 0 ? stockAssets.map(asset => (
                                <div key={asset.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700 hover:bg-slate-900">
                                    <div className="flex flex-col"><span className="text-sm font-bold text-white">{asset.name}</span><span className="text-[10px] text-slate-500">持有張數: {asset.quantity} 張</span></div>
                                    <div className="w-32"><Input type="number" placeholder={divMode === 'cash' ? "金額" : "增加張數"} className="h-9 text-xs" value={divInputs[asset.id] || ''} onChange={e => setDivInputs({...divInputs, [asset.id]: e.target.value})} /></div>
                                </div>
                            )) : <p className="text-center text-slate-500 py-6 italic text-sm">手頭目前無持有股票</p>}
                        </div>
                    </div>
                  )}

                  {mode === 'event' && (
                      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-6">
                          <div className="flex bg-slate-900 p-1 rounded-lg"> <button onClick={() => {setEventSubMode('pay'); setErrorMessage(null);}} className={`flex-1 py-1 text-xs rounded transition-all ${eventSubMode === 'pay' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>支付現金</button> <button onClick={() => {setEventSubMode('inc_exp'); setErrorMessage(null);}} className={`flex-1 py-1 text-xs rounded transition-all ${eventSubMode === 'inc_exp' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>增加月支出</button> <button onClick={() => {setEventSubMode('dec_exp'); setErrorMessage(null);}} className={`flex-1 py-1 text-xs rounded transition-all ${eventSubMode === 'dec_exp' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>減少月支出</button> </div>
                          {eventSubMode === 'pay' ? (
                              <div className="space-y-4"> <div><label className="text-xs text-slate-400 block mb-1">事件類別</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2" value={eventPayType} onChange={e => setEventPayType(e.target.value)}><option value="medical">醫療費用</option><option value="maintenance">維修保養</option><option value="custom">自定義項目</option></select></div> {eventPayType === 'custom' && (<div><label className="text-xs text-slate-400 block mb-1">項目名稱</label><Input value={eventCustomName} onChange={e => setEventCustomName(e.target.value)} /></div>)} <div><label className="text-xs text-slate-400 block mb-1">支付金額</label><Input type="number" value={eventAmount} onChange={e => setEventAmount(e.target.value)} /></div> </div>
                          ) : (
                              <div className="space-y-4"> <div><label className="text-xs text-slate-400 block mb-1">支出子類別</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2" value={eventExpCategory} onChange={e => setEventExpCategory(e.target.value as any)}><option value="basicLiving">餐飲、服飾、居住類</option><option value="transportEdu">交通、教育、娛樂類</option><option value="otherMedicalChild">其他、醫療、育兒類</option></select></div> <div><label className="text-xs text-slate-400 block mb-1">變動金額</label><Input type="number" value={eventAmount} onChange={e => setEventAmount(e.target.value)} /></div> </div>
                          )}
                      </div>
                  )}

                  <Button className="w-full py-4 text-lg font-black bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-900/30 transition-all active:scale-95" onClick={handlePhase1Submit}>下一步：財務檢核</Button>
                  {errorMessage && <div className="p-3 bg-rose-900/30 border border-rose-500/50 text-rose-400 text-center text-xs rounded-lg animate-pulse flex items-center justify-center gap-2"> <AlertCircle size={14}/> {errorMessage} </div>}
              </div>
          )}

          {phase === 2 && (
              <div className="h-full flex flex-col animate-in fade-in duration-300">
                  <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg mb-6 text-center animate-pulse"><p className="text-blue-200 font-bold text-lg">請問交易如何影響財務報表？</p></div>
                  <div className="grid grid-cols-2 gap-4 flex-1">
                      <Quadrant title="資產" color="border-blue-500 bg-blue-900/10" icon={<PieChart className="text-blue-400"/>} items={possibleItemsAssets} userEntries={userEntries.filter(e => e.category === 'Assets')} onToggle={(i, d) => toggleEntry('Assets', d, i)} />
                      <Quadrant title="收入" color="border-emerald-500 bg-emerald-900/10" icon={<TrendingUp className="text-emerald-400"/>} items={possibleItemsIncome} userEntries={userEntries.filter(e => e.category === 'Income')} onToggle={(i, d) => toggleEntry('Income', d, i)} />
                      <Quadrant title="負債" color="border-orange-500 bg-orange-900/10" icon={<Wallet className="text-orange-400"/>} items={possibleItemsLiabilities} userEntries={userEntries.filter(e => e.category === 'Liabilities')} onToggle={(i, d) => toggleEntry('Liabilities', d, i)} />
                      <Quadrant title="支出" color="border-rose-500 bg-rose-900/10" icon={<TrendingDown className="text-rose-400"/>} items={possibleItemsExpenses} userEntries={userEntries.filter(e => e.category === 'Expenses')} onToggle={(i, d) => toggleEntry('Expenses', d, i)} />
                  </div>
                  {errorMessage && <div className="mt-4 p-3 bg-rose-900/80 text-rose-100 rounded text-center text-xs shadow-lg">{errorMessage}</div>}
                  <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setPhase(1)} className="px-6">上一步</Button><Button onClick={checkAnswers} className="px-10 font-bold bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-900/30">確認新增</Button></div>
              </div>
          )}

          {phase === 3 && pendingTx && (
               <div className="flex flex-col items-center justify-center h-full space-y-10 animate-in zoom-in duration-300 overflow-hidden">
                   <div className="flex flex-col items-center space-y-6 w-full max-w-md px-2">
                       <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20">
                          <CheckCircle2 size={56} className="text-emerald-500" />
                       </div>
                       <h2 className="text-3xl font-black text-white tracking-widest text-center">交易記錄成功！</h2>
                       
                       <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border-2 border-emerald-500/40 w-full shadow-2xl space-y-4">
                           <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
                              <span className="text-slate-400 text-sm">交易內容</span>
                              <span className="font-black text-white text-lg truncate max-w-[200px]">{pendingTx.name}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-sm">手頭現金變動</span>
                              <span className={`font-mono font-black text-xl ${pendingTx.cashChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pendingTx.cashChange >= 0 ? '+' : ''}${pendingTx.cashChange.toLocaleString()}
                              </span>
                           </div>
                           {pendingTx.impacts && pendingTx.impacts.length > 0 && (
                               <div className="pt-2 border-t border-slate-700/50">
                                   <div className="text-slate-400 text-xs mb-1">交易影響明細</div>
                                   <div className="text-sm text-slate-200 space-y-1">
                                       {pendingTx.impacts.map((impact, idx) => (
                                           <div key={idx} className="flex items-center gap-1">
                                               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                               {impact}
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>
                   <div className="w-full max-w-md px-4">
                      <Button onClick={() => onTransaction(pendingTx!)} className="w-full py-4 text-xl bg-emerald-600 hover:bg-emerald-500 font-black tracking-widest shadow-2xl shadow-emerald-900/50 active:scale-95 transition-all">返回報表</Button>
                   </div>
               </div>
          )}
      </div>
    </Card>
  );
};

interface QuadrantProps { title: string; color: string; icon: React.ReactNode; items: string[]; userEntries: AccountEntry[]; onToggle: (item: string, direction: ChangeDirection) => void; }
const Quadrant: React.FC<QuadrantProps> = ({ title, color, icon, items, userEntries, onToggle }) => {
    const [internalSelected, setInternalSelected] = useState<string>('');
    const selectedItem = items.includes(internalSelected) ? internalSelected : (items[0] || '');
    return (
        <div className={`rounded-xl border-2 p-3 flex flex-col ${color} transition-all shadow-inner`}>
            <div className="flex items-center gap-2 font-bold text-slate-200 mb-3 border-b border-white/10 pb-2">{icon} {title}</div>
            <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar max-h-24">
              {userEntries.map((entry, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-900/80 px-2 py-1 rounded border border-white/5 text-[10px] animate-in slide-in-from-top-1">
                  <span className="text-white truncate max-w-[70px]">{entry.name}</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-black px-1 rounded ${entry.direction === 'Increase' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {entry.direction === 'Increase' ? '↑' : '↓'}
                    </span>
                    <button onClick={() => onToggle(entry.name, entry.direction)} className="text-slate-500 hover:text-white transition-colors">
                      <X size={10}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 shrink-0">
                <select className="w-full bg-slate-900 border border-slate-600 rounded text-[10px] px-1 py-1 mb-2 font-medium" value={selectedItem} onChange={e => setInternalSelected(e.target.value)}>{items.map(i => <option key={i} value={i}>{i}</option>)}</select>
                <div className="flex gap-2"><button onClick={() => onToggle(selectedItem, 'Increase')} className="flex-1 bg-slate-800 border border-slate-600 text-emerald-400 text-[10px] py-1.5 rounded font-black transition-all hover:bg-emerald-900/20">增加</button><button onClick={() => onToggle(selectedItem, 'Decrease')} className="flex-1 bg-slate-800 border border-slate-600 text-rose-400 text-[10px] py-1.5 rounded font-black transition-all hover:bg-rose-900/20">減少</button></div>
            </div>
        </div>
    );
};
