import { describe, expect, it } from 'vitest';
import { getFinancialCheckFeedback, normalizeExpectedEntries } from './BoardFinancialCheckModal';
import type { TransactionData } from '../../types';

describe('normalizeExpectedEntries', () => {
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
