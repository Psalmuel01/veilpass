import {expect,it}from'vitest';
import{convergeDustFee}from'../packages/network/dust-fee';
const coins=[{token:{nonce:1n},value:10n},{token:{nonce:2n},value:100n}];
it('selects additional DUST after fee-payment overhead increases a first estimate',()=>{
 const result=convergeDustFee(coins,-5n,inputs=>inputs.length===1?15n:20n);
 expect(result.fee).toBe(20n);expect(result.recipeInputs.map(c=>c.value)).toEqual([10n,10n]);
});
it('handles an initial zero deficit without entering a positive-imbalance loop',()=>{
 expect(convergeDustFee(coins,0n,()=>5n).recipeInputs).toEqual([{token:{nonce:1n},value:5n}]);
});
it('fails closed when funds cannot cover the recalculated fee',()=>{
 expect(()=>convergeDustFee(coins,-5n,()=>1000n)).toThrow(/Insufficient/);
 expect(()=>convergeDustFee(coins,-5n,()=>-1n)).toThrow(/Negative/);
});

it('bounds repeated fee increases instead of spinning indefinitely',()=>{
 const many=Array.from({length:20},(_,i)=>({token:{nonce:BigInt(i)},value:10n}));
 expect(()=>convergeDustFee(many,-1n,inputs=>inputs.reduce((sum,c)=>sum+c.value,0n)+1n)).toThrow(/eight passes/);
});
