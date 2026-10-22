import{expect,it}from'vitest';
import{preprodNetworkEnabled}from'../packages/network/preprod-enabled.mjs';
const accepted={enabled:true,network:'preprod',contractAddress:'5120e2bc49267ad91653edb9806a010da0bb0428d78acd9dbf0e994a058cd24a',acceptanceSha256:'a'.repeat(64)};
it('requires accepted deployment pins and preserves an explicit operator kill switch',()=>{
 expect(preprodNetworkEnabled({},accepted)).toBe(true);
 expect(preprodNetworkEnabled({VEILPASS_SIGNED_NETWORK:'0'},accepted)).toBe(false);
 expect(preprodNetworkEnabled({},{...accepted,contractAddress:'b'.repeat(64)})).toBe(false);
 expect(preprodNetworkEnabled({},{...accepted,enabled:false})).toBe(false);
 expect(preprodNetworkEnabled({},{...accepted,acceptanceSha256:null})).toBe(false);
});
