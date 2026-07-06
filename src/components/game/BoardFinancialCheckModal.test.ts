import { describe, expect, it } from 'vitest';
import { normalizeExpectedEntries } from './BoardFinancialCheckModal';
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
