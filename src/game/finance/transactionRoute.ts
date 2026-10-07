import type {TransactionData} from '../../types';
// Views and manual turnaround commands share the actual banking form formats.
export const getPersonalFinancialHandler=(tx:TransactionData)=>{
 if(tx.name.startsWith('達成事業成就：')&&tx.source==='cash'&&tx.usage==='asset')return 'completeTargetEnterprisePurchase';
 if(tx.name.startsWith('實現人生夢想：')&&tx.source==='cash'&&tx.usage==='expense')return 'completeDreamPurchase';
 if(tx.batchSellList?.length)return 'completeAssetSale';
 if(tx.insuranceType)return 'completeInsurancePurchase';
 if(tx.assetChange?.asset.type==='定存'||tx.assetDetails?.type==='定存')return 'completeDepositPurchase';
 if(tx.stockList?.length)return 'completeStockTrade';
 if(!tx.fundingLoanAmount&&((tx.usage==='loan'&&tx.source==='cash')||(tx.usage==='cash'&&tx.source==='loan')))return 'completeLoanBorrow';
 if(tx.usage==='liability'&&tx.source==='cash')return 'completeLoanRepayment';
 if((tx.name.startsWith('解約定存')||tx.name.startsWith('定存解約')))return 'completeDepositWithdrawal';
 if(tx.usage==='asset'&&tx.assetDetails?.type==='汽車')return 'completeCarPurchase';
 return null;
};
