import type {TransactionData} from '../../types';
// Keep the banking formats at one boundary; the view invokes the named room command.
export const getPersonalFinancialHandler=(tx:TransactionData)=>{
 if(tx.insuranceType)return 'completeInsurancePurchase';
 if(tx.assetChange?.asset.type==='定存'||tx.assetDetails?.type==='定存')return 'completeDepositPurchase';
 if(tx.stockList?.length)return 'completeStockTrade';
 if(!tx.fundingLoanAmount&&((tx.usage==='loan'&&tx.source==='cash')||(tx.usage==='cash'&&tx.source==='loan'&&tx.commandId?.startsWith('loan:'))))return 'completeLoanBorrow';
 if(tx.usage==='liability'&&tx.source==='cash')return 'completeLoanRepayment';
 if(tx.name.startsWith('解約定存'))return 'completeDepositWithdrawal';
 if(tx.usage==='asset'&&tx.assetDetails?.type==='汽車')return 'completeCarPurchase';
 return null;
};
