import { describe, expect, it } from 'vitest';
import { getCreditLimit, getOutstandingCreditPrincipal, getRemainingCreditCapacity } from './financialRules';

describe('credit capacity rules', () => {
  it('uses ten times work income as the credit limit', () => {
    expect(getCreditLimit(55000)).toBe(550000);
  });

  it('counts credit liabilities and legacy credit loans, not asset loans', () => {
    expect(getOutstandingCreditPrincipal([
      { id: 'credit', name: '信用貸款', totalOwed: 100000, monthlyPayment: 10000, type: '信用貸款' },
      { id: 'house', name: '不動產貸款', totalOwed: 900000, monthlyPayment: 4500, type: '不動產貸款' }
    ], 50000)).toBe(150000);
  });

  it('restores capacity after repayment', () => {
    expect(getRemainingCreditCapacity(55000, [], 0)).toBe(550000);
    expect(getRemainingCreditCapacity(55000, [], 200000)).toBe(350000);
  });
});
