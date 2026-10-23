import {describe,it,expect} from 'vitest';
import {proverPolicy,requireProverConsent} from '../packages/network/prover-policy.mjs';
describe('prover trust boundary',()=>{
 it('preserves holder-controlled loopback proving',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]']){
   const p=proverPolicy(`http://${host}:6300`);expect(p.kind).toBe('loopback');expect(()=>requireProverConsent(p,undefined)).not.toThrow();
  }
 });
 it('requires an exact HTTPS operator pin and consent to that origin',()=>{
  const p=proverPolicy('https://prover.example.test/','https://prover.example.test');
  expect(p.kind).toBe('trusted-remote');
  expect(()=>requireProverConsent(p,undefined)).toThrow('Consent');
  expect(()=>requireProverConsent(p,'https://another.example.test')).toThrow('Consent');
  expect(()=>requireProverConsent(p,p.origin)).not.toThrow();
 });
 it('rejects arbitrary, downgraded, private or disguised destinations',()=>{
  for(const [url,pin]of [
   ['https://prover.example.test',undefined],['http://prover.example.test','http://prover.example.test'],
   ['https://evil.example.test','https://prover.example.test'],
   ['https://prover.example.test?token=secret','https://prover.example.test'],
   ['https://user:pass@prover.example.test','https://prover.example.test'],
   ['https://prover.example.test/path','https://prover.example.test'],
   ['https://prover.example.test','https://prover.example.test#pin'],
   ['https://127.0.0.1','https://127.0.0.1'],['https://10.0.0.1','https://10.0.0.1'],
   ['https://prover.local','https://prover.local'],['https://[::1]','https://[::1]'],
  ])expect(()=>proverPolicy(url!,pin)).toThrow();
 });
});
