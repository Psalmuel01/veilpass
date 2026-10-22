import { describe, it, expect, vi, afterEach } from 'vitest';
import { connectWithTimeout } from '../packages/network/wallet-connection.mjs';
afterEach(()=>vi.useRealTimers());
describe('installed-wallet request deadlines',()=>{
 it('allows a human approval beyond thirty seconds while bounding configuration separately',async()=>{
  vi.useFakeTimers();
  const initial={connect:()=>new Promise(resolve=>setTimeout(()=>resolve({getConfiguration:async()=>({networkId:'preprod'})}),45000))};
  const connected=connectWithTimeout(initial,'preprod');
  await vi.advanceTimersByTimeAsync(45001);await expect(connected).resolves.toBeDefined();
  const stalled=expect(connectWithTimeout({connect:async()=>({getConfiguration:()=>new Promise(()=>{})})},'preprod')).rejects.toThrow('network configuration');
  await vi.advanceTimersByTimeAsync(30001);await stalled;
 });
 it('ends a stalled approval and permits an explicit later retry',async()=>{
  vi.useFakeTimers();
  const initial={connect:vi.fn().mockImplementationOnce(()=>new Promise(()=>{})).mockResolvedValue({getConfiguration:async()=>({networkId:'preprod'})})};
  const failure=expect(connectWithTimeout(initial,'preprod',()=>{},100)).rejects.toThrow('did not complete connection');
  await vi.advanceTimersByTimeAsync(101);await failure;
  await expect(connectWithTimeout(initial,'preprod',()=>{},100)).resolves.toBeDefined();
 });
 it('reports a configuration stall separately from approval',async()=>{
  vi.useFakeTimers();
  const failure=expect(connectWithTimeout({connect:async()=>({getConfiguration:()=>new Promise(()=>{})})},'preprod',()=>{},100)).rejects.toThrow('did not return its network');
  await vi.advanceTimersByTimeAsync(101);await failure;
 });
 it('preserves declined approvals and rejects a wrong network',async()=>{
  await expect(connectWithTimeout({connect:async()=>{throw Error('User declined')}},'preprod')).rejects.toThrow('User declined');
  await expect(connectWithTimeout({connect:async()=>({getConfiguration:async()=>({networkId:'mainnet'})})},'preprod')).rejects.toThrow('Switch your wallet');
 });
});
