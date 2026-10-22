import activation from '../../deploy/preprod/activation.json' with {type:'json'};
import network from '../../deploy/preprod/network.json' with {type:'json'};
// An operator's explicit zero always disables the public release. An accepted
// checked-in release lets future GitHub deployments carry public config safely.
/** @param {NodeJS.ProcessEnv} env @param {{enabled:boolean,network:string,contractAddress:string,acceptanceSha256:string|null}} release */
export function preprodNetworkEnabled(env=process.env,release=activation){
 if(env.VEILPASS_SIGNED_NETWORK!==undefined)return env.VEILPASS_SIGNED_NETWORK==='1';
 return release.enabled===true&&release.network==='preprod'&&release.contractAddress===network.contractAddress&&typeof release.acceptanceSha256==='string'&&/^[a-f0-9]{64}$/.test(release.acceptanceSha256);
}
