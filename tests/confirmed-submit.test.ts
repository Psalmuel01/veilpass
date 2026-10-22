import{expect,it,vi,afterEach}from'vitest';
import{submitAndConfirm}from'../packages/network/confirmed-submit';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const tx={identifiers:()=>['0'.repeat(66),'1'.repeat(66)]} as unknown as Parameters<typeof submitAndConfirm>[1];
it('accepts the canonical first identifier when the node notification stays pending, submitting once',async()=>{
 const submitTx=vi.fn(()=>new Promise<string>(()=>{})),request=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>({ok:true,json:async()=>({data:{transactions:[{transactionResult:{status:'SUCCESS'}}]}})}));vi.stubGlobal('fetch',request);
 const id=await submitAndConfirm({submitTx} as unknown as Parameters<typeof submitAndConfirm>[0],tx,'https://indexer.example');
 expect(id).toBe('0'.repeat(66));expect(submitTx).toHaveBeenCalledTimes(1);expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).variables.offset.identifier).toBe(id);
});
it('polls after a transient miss without submitting another transaction',async()=>{
 vi.useFakeTimers();const submitTx=vi.fn(async()=>'unused');let calls=0;vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({data:{transactions:++calls===1?[]:[{transactionResult:{status:'SUCCESS'}}]}})})));
 const pending=submitAndConfirm({submitTx} as unknown as Parameters<typeof submitAndConfirm>[0],tx,'https://indexer.example');await vi.advanceTimersByTimeAsync(1500);await expect(pending).resolves.toBe('0'.repeat(66));expect(submitTx).toHaveBeenCalledTimes(1);
});
it('rejects an indexed failed transaction without retrying submission',async()=>{
 const submitTx=vi.fn(async()=>'unused');vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({data:{transactions:[{transactionResult:{status:'FAILURE'}}]}})})));
 await expect(submitAndConfirm({submitTx} as unknown as Parameters<typeof submitAndConfirm>[0],tx,'https://indexer.example')).rejects.toThrow(/without full success/);expect(submitTx).toHaveBeenCalledTimes(1);
});
