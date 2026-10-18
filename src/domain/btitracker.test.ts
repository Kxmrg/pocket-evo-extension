import {expect,it} from 'vitest';
import {adaptSite} from './adapt-site';
import {detectArchitecture} from './detect-architecture';
import {buildImportPayload} from './payload';
import {validateDraft} from './validate-draft';
import type {PageSnapshot} from './types';
const snapshot=(host:string):PageSnapshot=>({url:`https://${host}/`,origin:`https://${host}`,host,title:'Fixture',userAgent:'Fixture UA',meta:[],resources:[],links:[],textSample:'',storage:[],candidates:[]});
it.each(['hd-space.org','hd-torrents.org'])('exports %s with BtiTracker family, cookie and native default entry',host=>{
const s=snapshot(host),detection=detectArchitecture(s);
expect(detection).toMatchObject({id:'btitracker',supported:true});
const draft=adaptSite({detection,snapshot:s,cookieHeader:'sid=fixture'});
expect(validateDraft(draft)).toEqual({valid:true,errors:{}});
expect(buildImportPayload(draft).site).toMatchObject({family:'btitracker',secrets:{cookie:'sid=fixture'},entries:[{path:host==='hd-space.org'?'/index.php?page=torrents':'/torrents.php'}]});
});
it('recognizes explicit derivatives without classifying ordinary NP download routes as BtiTracker',()=>{
expect(detectArchitecture({...snapshot('example.org'),textSample:'Powered by xbtit'}).id).toBe('btitracker');
expect(detectArchitecture({...snapshot('example.org'),textSample:'Powered by NexusPHP'}).id).toBe('nexusphp');
});
