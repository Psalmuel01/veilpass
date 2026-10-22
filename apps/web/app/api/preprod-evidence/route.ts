import {NextRequest,NextResponse}from'next/server';
import{readFile}from'node:fs/promises';
import path from'node:path';
import{serviceRequestAllowed,admitServiceRequest}from'../../../lib/service-access';
import{signedProjectRoot}from'../../../lib/signed-network-config';
export const runtime='nodejs';export const dynamic='force-dynamic';
let cached:{until:number;body:unknown}|undefined;
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'no-store'};
 if(!serviceRequestAllowed(request.headers,false))return NextResponse.json({error:'Evidence service unavailable'},{status:503,headers});
 try{
  if(!await admitServiceRequest('verifier'))return NextResponse.json({error:'Request limit reached'},{status:429,headers});
  if(cached&&cached.until>Date.now())return NextResponse.json(cached.body,{headers});
  const root=signedProjectRoot(),[{decodeWire},{SignedMidnightAdapter}]=await Promise.all([import('../../../../../integrations/issuance/src/wire'),import('../../../../../integrations/issuance/src/midnight-adapter')]);
  const config=decodeWire(await readFile(path.join(root,'deploy/preprod/network.json'),'utf8'))as{contractAddress:string;domain:string;trust:import('../../../../../integrations/issuance/src/index').IssuerTrust};
  const evidence=JSON.parse(await readFile(path.join(root,'deploy/preprod/evidence.json'),'utf8'));
  if(evidence.contractAddress!==config.contractAddress||!evidence.twoPoliciesVerified||!evidence.revokedCredentialRejected)throw Error();
  const token=process.env.BLOCKFROST_PROJECT_ID;if(!token)throw Error();const indexer=new URL('https://midnight-preprod.blockfrost.io/api/v0');indexer.searchParams.set('project_id',token);
  const assets=path.join(root,'integrations/issuance/managed-authorization/keys'),chain=new SignedMidnightAdapter({indexerUrl:indexer.href,contractAddress:config.contractAddress,networkDomain:config.domain,trust:config.trust,verifierKeys:{authorize:await readFile(path.join(assets,'authorize.verifier')),publishStatus:await readFile(path.join(assets,'publishStatus.verifier')),deactivate:await readFile(path.join(assets,'deactivate.verifier'))}});
  const roles=['Status published','Hackathon authorization','Community authorization','Revocation published'],refs=[evidence.statusTransaction,...evidence.authorizationTransactions,evidence.revocationTransaction];
  const [state,...transactions]=await Promise.all([chain.currentState(),...refs.map(async(reference:string,index:number)=>{const r=await fetch(indexer,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'query($offset:TransactionOffset!){transactions(offset:$offset){hash block{height timestamp} ... on RegularTransaction{transactionResult{status}}}}',variables:{offset:{identifier:reference}}}),signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});if(!r.ok)throw Error();const data=await r.json(),tx=data.data?.transactions?.[0];if(data.errors||tx?.transactionResult?.status!=='SUCCESS')throw Error();return{role:roles[index],reference,status:'SUCCESS',blockHeight:tx.block.height,transactionHash:tx.hash,timestamp:tx.block.timestamp};})]);
  if(!state.active)throw Error();
  const body={checkedAt:new Date().toISOString(),network:'preprod',contractAddress:config.contractAddress,recordedAcceptance:evidence,live:{pinsVerified:true,state,transactions},productionReady:false};cached={until:Date.now()+30000,body};return NextResponse.json(body,{headers});
 }catch{return NextResponse.json({error:'Live Preprod evidence could not be verified. Recorded evidence remains in the repository.'},{status:503,headers});}
}
