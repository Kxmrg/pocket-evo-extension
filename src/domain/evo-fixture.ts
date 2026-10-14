// Synthetic test data only; no real account credentials.
import { adaptSite } from './adapt-site';
import type { ArchitectureId, PageSnapshot } from './types';
export function fixture(id: ArchitectureId = 'nexusphp') {
 const snapshot:PageSnapshot={url:'https://pt.agsvpt.cn/index.php',origin:'https://pt.agsvpt.cn',host:'pt.agsvpt.cn',title:'Arctic Global Seed Vault :: 首页 - Powered by NexusPHP',userAgent:'Fixture',meta:[],resources:[],links:[{text:'综合',href:'https://pt.agsvpt.cn/torrents.php'}],textSample:'',storage:[],candidates:[]};
 const d=adaptSite({detection:{id,supported:true,confidence:'certain',reasons:[]},snapshot,cookieHeader:'uid=42; pass=fixture'});
 if (id==='mtorrent') Object.assign(d,{name:'M-Team',address:'https://api.m-team.cc',passkey:'42',token:'fixture-api',webToken:'fixture-auth',webDeviceId:'fixture-did',webVisitorId:'fixture-vid'});
 return d;
}
