import { Liability } from '../types';

/** Credit capacity is based on outstanding principal only. */
export const getCreditLimit = (salary: number) => Math.max(0, Number(salary) || 0) * 10;

export const getOutstandingCreditPrincipal = (liabilities: Liability[] = [], legacyLoans = 0) =>
  liabilities
    .filter(liability => liability.type === '信用貸款')
    .reduce((sum, liability) => sum + Math.max(0, liability.totalOwed || 0), 0) + Math.max(0, legacyLoans || 0);

export const getRemainingCreditCapacity = (salary: number, liabilities: Liability[] = [], legacyLoans = 0) =>
  Math.max(0, getCreditLimit(salary) - getOutstandingCreditPrincipal(liabilities, legacyLoans));
