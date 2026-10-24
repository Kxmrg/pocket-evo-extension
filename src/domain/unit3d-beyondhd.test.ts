import { expect, it } from 'vitest';
import { adaptSite } from './adapt-site';
import { detectArchitecture } from './detect-architecture';
import { buildImportPayload } from './payload';
import { validateDraft } from './validate-draft';
import { validEntry } from './evo-entry';
import { draftPageFromSnapshot } from './torrent-pages';
import type { PageSnapshot } from './types';
function snapshot(host: string, path = '/torrents'): PageSnapshot {
 return { url:`https://${host}${path}`,origin:`https://${host}`,host,title:`Torrents - ${host}`,userAgent:'Fixture UA',meta:[],resources:[],links:[],textSample:'',storage:[],candidates:[{key:'passkey',value:'must-not-export',source:'fixture'}] };
}
it.each(['eiga.moi','blutopia.cc','lst.gg','seedpool.org'])('imports %s as UNIT3D and preserves repeated filters while normalizing views', host => {
 const s=snapshot(host,'/torrents?view=group&categories[]=1&categories[]=2&types[]=3');
 const detection=detectArchitecture(s);
 expect(detection).toMatchObject({id:'unit3d',supported:true});
 const draft=adaptSite({detection,snapshot:s,cookieHeader:'session=fixture'});
 expect(validateDraft(draft).valid).toBe(true);
 const p=buildImportPayload(draft).site;
 expect(p.family).toBe('unit3d');
 expect(p.secrets).toEqual({cookie:'session=fixture'});
 const q=new URL(p.entries[0]!.path,'https://entry.invalid').searchParams;
 expect(q.get('view')).toBe('list'); expect(q.getAll('categories[]')).toEqual(['1','2']);
 expect(q.get('types[]')).toBe('3');
 expect(p.userAgent).toBe('Fixture UA');
 expect(draftPageFromSnapshot(snapshot(host,'/torrents?view=card'),'', 'unit3d')?.path).toBe('/torrents?view=list');
});
it('keeps BeyondHD independent even when page text includes UNIT3D',()=>{
 const s={...snapshot('beyond-hd.me','/details/a-title.123'),textSample:'Powered by UNIT3D'};
 const detection=detectArchitecture(s);
 expect(detection).toMatchObject({id:'beyondhd',supported:true});
 const draft=adaptSite({detection,snapshot:s,cookieHeader:'session=fixture'});
 expect(validateDraft(draft).valid).toBe(true);
 expect(buildImportPayload(draft).site).toMatchObject({family:'api',address:'https://beyond-hd.me',entries:[{path:'/torrents'}],secrets:{cookie:'session=fixture'}});
 expect(draft.passkey).toBeNull(); expect(draft.token).toBeNull();
 expect(validateDraft({...draft,address:'https://beyond-hd.me.evil.invalid'}).valid).toBe(false);
});
it('rejects details, download routes and secrets as resource entries',()=>{
 for(const id of ['unit3d','beyondhd'] as const) for(const path of ['/torrents/123','/details/movie.123','/download/movie.123','/torrents?api_key=secret']) expect(validEntry(id,path)).toBe(false);
});

it('forces any UNIT3D view to list without changing NP entries',()=>{
 const s=snapshot('eiga.moi','/torrents?view=poster&categories[]=1&categories[]=2');
 expect(draftPageFromSnapshot(s,'','unit3d')?.path).toContain('view=list');
 expect(draftPageFromSnapshot(s,'','nexusphp')?.path).toContain('view=poster');
});

it('preserves native BeyondHD category entries but not unrelated UNIT3D paths',()=>{
 expect(validEntry('beyondhd','/categories/movie.1?freeleech=1')).toBe(true);
 expect(validEntry('unit3d','/categories/movie.1')).toBe(false);
});
