import { describe, expect, it } from 'vitest';
import { getFinancialCheckFeedback, normalizeExpectedEntries } from './BoardFinancialCheckModal';
import { buildDreamTransaction, buildTargetEnterpriseTransaction } from '../banking/TargetAndDreamModals';
import type { TransactionData } from '../../types';

describe('normalizeExpectedEntries', () => {
  it('shows the selected target enterprise by name', () => {
    const txData = buildTargetEnterpriseTransaction({
      id: 'enterprise-1',
      name: '數位教育平台',
      cost: 120000,
      income: 18000,
      relatedProfessionId: 'teacher',
      relatedBonusPercent: 10,
      happyPoints: 5
    });

    expect(normalizeExpectedEntries(txData.financialCheckEntries || [], txData)).toEqual([
      { category: 'Assets', name: '現金', direction: 'Decrease' },
      { category: 'Assets', name: '目標企業（數位教育平台）', direction: 'Increase' },
      { category: 'Income', name: '企業收益', direction: 'Increase' }
    ]);
  });

  it('requires only cash decrease when realizing a dream', () => {
    const txData = buildDreamTransaction({
      id: 'dream-1',
      name: '環遊世界',
      cost: 300000,
      happyPoints: 10
    });

    expect(normalizeExpectedEntries(txData.financialCheckEntries || [], txData)).toEqual([
      { category: 'Assets', name: '現金', direction: 'Decrease' }
    ]);
    expect(txData.financialCheckEntries?.some(entry => entry.name.includes('夢想費用'))).toBe(false);
  });

  it('provides completion impacts for target enterprise and dream transactions', () => {
    const enterprise = buildTargetEnterpriseTransaction({
      id: 'enterprise-2',
      name: '社區共學中心',
      cost: 250000,
      income: 22000,
      relatedProfessionId: 'teacher',
      relatedBonusPercent: 10,
      happyPoints: 5
    });
    const dream = buildDreamTransaction({
      id: 'dream-2',
      name: '極光旅行',
      cost: 180000,
      happyPoints: 8
    });

    expect(enterprise.impacts).toEqual([
      '現金 -250,000',
      '目標企業（社區共學中心） +250,000',
      '每月企業收益 +22,000'
    ]);
    expect(dream.impacts).toEqual([
      '現金 -180,000',
      '成功實現夢想：極光旅行'
    ]);
  });

  it('infers otherMedicalChild expense entry for C055 even when expectedEntries is empty', () => {
    const txData: TransactionData = {
      name: '機運卡：奉獻所得',
      amount: 2000,
      cashChange: 0,
      source: 'income',
      usage: 'expense_update',
      expensePayload: {
        category: 'otherMedicalChild',
        amount: 2000,
        isIncrease: true
      }
    };

    expect(normalizeExpectedEntries([], txData)).toContainEqual({
      category: 'Expenses',
      name: '其他、醫療、育兒類',
      direction: 'Increase'
    });
  });

  it('removes stale legacy expense category entries when txData already specifies the real category', () => {
    const txData: TransactionData = {
      name: '機運卡：奉獻所得',
      amount: 2000,
      cashChange: 0,
      source: 'income',
      usage: 'expense_update',
      expensePayload: {
        category: 'otherMedicalChild',
        amount: 2000,
        isIncrease: true
      }
    };

    const normalized = normalizeExpectedEntries([
      { category: 'Expenses', name: '餐飲、服飾、居住類', direction: 'Increase' }
    ], txData);

    expect(normalized).not.toContainEqual({
      category: 'Expenses',
      name: '餐飲、服飾、居住類',
      direction: 'Increase'
    });
    expect(normalized).toContainEqual({
      category: 'Expenses',
      name: '其他、醫療、育兒類',
      direction: 'Increase'
    });
  });

  it('normalizes happiness event monthly expense category from happinessEventPayload', () => {
    const txData: TransactionData = {
      name: '幸福卡：第一個孩子出生',
      amount: 0,
      cashChange: 0,
      source: 'cash',
      usage: 'happiness_event',
      happinessEventPayload: {
        id: 'child1',
        name: '第一個孩子出生',
        amount: 0,
        points: 4,
        monthlyExpenseChange: 10000,
        expenseCategory: 'otherMedicalChild'
      }
    };

    const normalized = normalizeExpectedEntries([
      { category: 'Expenses', name: '餐飲、服飾、居住類', direction: 'Increase' }
    ], txData);

    expect(normalized).not.toContainEqual({
      category: 'Expenses',
      name: '餐飲、服飾、居住類',
      direction: 'Increase'
    });
    expect(normalized).toContainEqual({
      category: 'Expenses',
      name: '其他、醫療、育兒類',
      direction: 'Increase'
    });
  });
});

describe('getFinancialCheckFeedback', () => {
  const expected = [
    { category: 'Assets' as const, name: '現金', direction: 'Decrease' as const },
    { category: 'Expenses' as const, name: '交通、教育、娛樂類', direction: 'Increase' as const }
  ];

  it('hides exact answers on the first incorrect attempt and highlights categories', () => {
    const feedback = getFinancialCheckFeedback(expected, [
      { category: 'Assets', name: '現金', direction: 'Increase' }
    ], 1);

    expect(feedback.isCorrect).toBe(false);
    expect(feedback.wrongCount).toBe(3);
    expect(feedback.affectedCategories).toEqual(['Assets', 'Expenses']);
    expect(feedback.lines[0]).toContain('目前有 3 處錯誤');
    expect(feedback.lines.join(' ')).not.toContain('交通、教育、娛樂類');
  });

  it('reveals the exact expected entries from the second incorrect attempt', () => {
    const feedback = getFinancialCheckFeedback(expected, [], 2);

    expect(feedback.lines).toContain('資產：現金（減少）');
    expect(feedback.lines).toContain('支出：交通、教育、娛樂類（增加）');
  });
});
