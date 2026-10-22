import {Either} from 'effect';
import {getBalanceRecipe,Imbalances} from '@midnight-ntwrk/wallet-sdk-capabilities';
import {Transacting,V1Builder,CustomDustWallet} from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';
import type {FinalizedTransaction} from '@midnight-ntwrk/ledger-v8';

// A required fee is a deficit (negative imbalance). Reusing the positive fee
// returned by a dry run selects no inputs and can leave SDK 4.1's loop unbounded.
export function convergeDustFee<T extends {nonce:bigint}>(coins:ReadonlyArray<{token:T;value:bigint}>,initialDeficit:bigint,dryRun:(inputs:ReadonlyArray<{token:T;value:bigint}>)=>bigint){
 let required=initialDeficit<0n?-initialDeficit:0n;
 for(let pass=0;pass<8;pass++){
  const recipe=getBalanceRecipe({coins:coins.map(c=>({...c,type:'dust'})),initialImbalances:Imbalances.fromEntry('dust',-required),feeTokenType:'dust',transactionCostModel:{inputFeeOverhead:0n,outputFeeOverhead:0n},createOutput:c=>c,isCoinEqual:(a,b)=>a.token.nonce===b.token.nonce});
  const inputs=recipe.inputs.map(c=>({token:c.token,value:c.value})),fee=dryRun(inputs);
  if(fee<0n)throw Error('Negative DUST fee rejected');
  const coverage=inputs.reduce((sum,c)=>sum+c.value,0n);
  if(fee<=coverage){let remaining=fee;const recipeInputs=inputs.map(c=>{const value=remaining<c.value?remaining:c.value;remaining-=value;return{token:c.token,value};}).filter(c=>c.value>0n);if(remaining!==0n)throw Error('DUST fee coverage mismatch');return{fee,recipeInputs};}
  required=fee;
 }
 throw Error('DUST fee did not converge within eight passes; nothing submitted');
}
class BoundedDustTransacting extends Transacting.TransactingCapabilityImplementation<FinalizedTransaction>{
 override computeBalancingRecipe(...args:Parameters<Transacting.TransactingCapabilityImplementation<FinalizedTransaction>['computeBalancingRecipe']>):ReturnType<Transacting.TransactingCapabilityImplementation<FinalizedTransaction>['computeBalancingRecipe']>{
  const [key,state,transactions,ttl,time,params]=args;
  const deficit=transactions.reduce((sum,tx)=>sum+Transacting.TransactingCapabilityImplementation.feeImbalance(tx,this.calculateFee(tx,params)),0n);
  const result=convergeDustFee(this.getCoins().getAvailableCoinsWithGeneratedDust(state,time),deficit,inputs=>this.dryRunFee(inputs,transactions,key,state,ttl,time,params));
  return Either.right(result);
 }
}
export function boundedDustWallet(config:Parameters<typeof CustomDustWallet>[0]){
 const builder=new V1Builder().withDefaults().withTransacting((c:Transacting.DefaultTransactingConfiguration,context:()=>Transacting.DefaultTransactingContext)=>new BoundedDustTransacting(c.networkId,c.costParameters,()=>context().coinSelection,()=>context().coinsAndBalancesCapability,()=>context().keysCapability));
 return CustomDustWallet(config,builder);
}
