// Development only. Never reads or stores real credentials.
import { encodeImportPayload } from '../src/domain/payload';
const p=new URLSearchParams(location.search);
Object.defineProperty(navigator,'languages',{value:[p.get('lang')||'zh'],configurable:true});
document.documentElement.dataset.theme=p.get('theme')||'light';
const draft={architecture:'nexusphp' as const,scheme:0 as const,name:'Example PT',address:'https://pt.example',cookie:'session=synthetic-preview-only',webToken:null,webDeviceId:null,webVisitorId:null,passkey:null,token:null,pages:[{name:'All',path:'/torrents.php',tags:null,selected:true}],userAgent:null,importUserAgent:false,tags:null,downloadTags:null,fieldWarnings:{},alternatives:{}};
const payload=encodeImportPayload(draft);
Object.assign(window,{chrome:{storage:{session:{get:async(key:string)=>{if(p.get('scenario')==='error')throw new Error('Synthetic storage failure');return p.get('scenario')==='expired'?{}:{[key]:{text:payload.text,siteName:draft.name,expiresAt:Date.now()+60000}};},remove:async()=>{}}}}});
await import('../src/fullscreen/main');
