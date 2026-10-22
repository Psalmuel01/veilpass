import type {MidnightWalletProvider} from '@midnight-ntwrk/testkit-js';
import type {FinalizedTransaction} from '@midnight-ntwrk/midnight-js-protocol/ledger';
// Submit exactly once. A missed node finality notification must not cause a retry.
// The canonical indexer is also the independent verifier's source of acceptance.
export async function submitAndConfirm(wallet:MidnightWalletProvider,tx:FinalizedTransaction,indexer:string){
 const reference=tx.identifiers()[0];let submissionFailed=false;
 void wallet.submitTx(tx).catch(()=>{submissionFailed=true;});
 const started=Date.now();
 for(let pass=0;pass<120;pass++){
  let status:string|undefined;
  try{
   const response=await fetch(indexer,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'query($offset:TransactionOffset!){transactions(offset:$offset){... on RegularTransaction{transactionResult{status}}}}',variables:{offset:{identifier:reference}}}),signal:AbortSignal.timeout(10000),redirect:'error'});
   if(response.ok){const body=await response.json();status=body.data?.transactions?.[0]?.transactionResult?.status;}
  }catch{/* Transient reads never trigger another submission. */}
  if(status==='SUCCESS')return reference;
  if(status)throw Error('Preprod transaction was indexed without full success; reconcile before retrying');
  if(submissionFailed&&Date.now()-started>15000)throw Error('Submission failed without indexed confirmation; reconcile the recorded reference before retrying');
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 throw Error('Canonical confirmation timed out; reconcile the recorded reference before retrying');
}
