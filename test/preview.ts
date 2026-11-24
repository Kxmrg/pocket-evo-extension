// Development-only fixture. Vite build entries never include this file.
import { version } from '../package.json';
import type { PageSnapshot } from '../src/domain/types';
const params=new URLSearchParams(location.search);
const language=params.get('lang')||'zh';
Object.defineProperty(navigator,'languages',{value:[language],configurable:true});
document.documentElement.dataset.theme=params.get('theme')||'light';
const scenario=params.get('scenario')||'normal';
const snapshot: PageSnapshot = {
  url:'https://pt.example/torrents.php?cat=401',origin:'https://pt.example',host:'pt.example',
  title:'Example PT - 首页',userAgent:'Preview browser',
  meta:[{name:'generator',property:'',content:'NexusPHP'}],resources:[],
  links:[{text:'综合',href:'https://pt.example/torrents.php'},{text:'电影',href:'https://pt.example/torrents.php?cat=401'}],
  textSample:'Powered by NexusPHP',storage:[],candidates:[],
};
if(scenario==='mt'){snapshot.url='https://kp.m-team.cc/browse';snapshot.origin='https://kp.m-team.cc';snapshot.host='kp.m-team.cc';snapshot.title='MT Example';snapshot.meta=[];snapshot.links=[];snapshot.textSample='';snapshot.storage=[{area:'local',key:'auth',value:'synthetic-auth-only'}];}
if(scenario==='piggo'){snapshot.url='https://piggo.me/torrents';snapshot.origin='https://piggo.me';snapshot.host='piggo.me';snapshot.title='Piggo';snapshot.meta=[];snapshot.links=[];snapshot.textSample='';snapshot.storage=[{area:'local',key:'pig_token',value:'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature'}];snapshot.pigVisitorId='0123456789abcdef0123456789abcdef';}
if(scenario==='unsupported'){snapshot.meta=[];snapshot.links=[];snapshot.textSample='';snapshot.domMarkers=['unit3d-torrent-table','unit3d-torrent-row'];snapshot.title='Unsupported';snapshot.url='https://example.invalid/';snapshot.origin='https://example.invalid';snapshot.host='example.invalid';}
const storage: Record<string, unknown> = {};
Object.assign(window,{chrome:{
  runtime:{getManifest:()=>({version}),getURL:(path:string)=>new URL(`../${path}`,location.href).href},
  permissions:{getAll:async()=>({origins:scenario==='permission'?[]:[`${snapshot.origin}/*`]}),request:async()=>true},
  tabs:{query:async()=>[{id:1,url:snapshot.url}],create:async()=>{if(scenario==='open-error')throw new Error('Synthetic failure');window.open(`fullscreen-frame.html?lang=${language}&theme=${params.get('theme')||'light'}#fixture`,'_blank');}},
  scripting:{executeScript:async()=>{if(scenario==='error')throw new Error('Synthetic read failure');return [{result:structuredClone(snapshot)}];}},
  cookies:{getAllCookieStores:async()=>[{id:'fixture',tabIds:[1]}],getAll:async()=>scenario==='missing-cookie'?[]:[{name:'session',value:'synthetic-preview-only',domain:'pt.example',path:'/',hostOnly:true,secure:true}]},
  storage:{session:{get:async(key:string|null)=>key?{[key]:storage[key]}:{...storage},set:async(data:Record<string,unknown>)=>Object.assign(storage,data),remove:async(keys:string|string[])=>{for(const key of [keys].flat())delete storage[key];}}},
}});
await import('../src/popup/main');
