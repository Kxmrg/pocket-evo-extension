import { expect, it } from 'vitest';
import { adaptSite } from './adapt-site';
import { detectArchitecture } from './detect-architecture';
import { buildImportPayload } from './payload';
import { validateDraft } from './validate-draft';
import { validEntry } from './evo-entry';
import { draftPageFromSnapshot } from './torrent-pages';
import { apiProtocol } from './api-protocol';
import type { PageSnapshot } from './types';
const sites = [
 ['exoticaz.to','exoticaz','/torrents'], ['filelist.io','filelist','/browse.php'],
 ['cinemageddon.net','cinemageddon','/browse.php'], ['hdbits.org','hdbits','/browse.php'],
 ['karagarga.in','karagarga','/browse.php'], ['www.torrentleech.org','torrentleech','/torrents/browse/index'],
 ['star-space.net','ying','/p_torrent/video_list_t.php'],
 ['iptorrents.com','iptorrents','/t'],
] as const;
function snapshot(host: string, path = '/', scheme = 'https'): PageSnapshot {
 return {url:`${scheme}://${host}${path}`,origin:`${scheme}://${host}`,host,title:host,
 userAgent:'Fixture UA',meta:[],resources:[],links:[],textSample:'Powered by NexusPHP',storage:[],
 candidates:[{key:'passkey',value:'must-not-export',source:'fixture'}]};
}
it.each(sites)('routes %s independently, supplies default list, and exports only Cookie', (host,id,path)=>{
 const s=snapshot(host); const detection=detectArchitecture(s);
 expect(detection).toMatchObject({id,supported:true});
 const draft=adaptSite({detection,snapshot:s,cookieHeader:'session=fixture'});
 expect(validateDraft(draft).valid).toBe(true);
 const payload=buildImportPayload(draft).site;
 expect(payload.family).toBe('api'); expect(payload.entries[0]!.path).toBe(path);
 expect(payload.secrets).toEqual({cookie:'session=fixture'}); expect(payload.userAgent).toBe('Fixture UA');
 expect(validateDraft({...draft,address:`https://${host}.evil.invalid`}).valid).toBe(false);
});
it('keeps Cinemageddon HTTP but never grants HTTP independent routing to other hosts',()=>{
 expect(apiProtocol('http://cinemageddon.net')).toBe('cinemageddon');
 for(const host of ['hdbits.org','filelist.io','star-space.net','cinemageddon.net.evil.invalid'])
 expect(apiProtocol(`http://${host}`)).toBeNull();
 const s=snapshot('cinemageddon.net','/browse.php','http');
 expect(validateDraft(adaptSite({detection:detectArchitecture(s),snapshot:s,cookieHeader:'session=fixture'})).valid).toBe(true);
});
it.each([['/p_torrent/video_list.php','/p_torrent/video_list_t.php'],['/p_music/music_list.php','/p_music/music_list_t.php']])('normalizes Ying %s in collection and export preserving filters',(source,target)=>{
 const key=source.includes('music')?'format':'cat';
 const s=snapshot('star-space.net',`${source}?${key}=3&search=test`);
 expect(draftPageFromSnapshot(s,'','ying')?.path).toBe(`${target}?${key}=3&search=test`);
 const draft=adaptSite({detection:detectArchitecture(s),snapshot:s,cookieHeader:'session=fixture'});
 const manual={...draft,pages:[{...draft.pages[0]!,path:`${source}?${key}=3&search=test`}]};
 expect(validateDraft(manual).valid).toBe(true);
 expect(buildImportPayload(manual).site.entries[0]!.path).toBe(`${target}?${key}=3&search=test`);
});
it.each(sites)('rejects unsafe list routes for %s',(_host,id,path)=>{
 for(const value of ['/download.php?id=1','/logout.php',`${path}?passkey=secret`,'//evil.invalid/browse.php'])
 expect(validEntry(id,value)).toBe(false);
});

it('validates entry-specific capabilities before export',()=>{
 expect(validEntry('filelist','/internal.php?cat=1')).toBe(true);
 expect(validEntry('torrentleech','/torrents/browse/index/facets/tags%3AFREELEECH/')).toBe(true);
 for(const p of ['/torrents/browse/index/foo/bar','/torrents/browse/index?query=x','/torrents/browse/index/page/1/page/2']) expect(validEntry('torrentleech',p)).toBe(false);
 for(const p of ['/p_music/music_list_t.php?tag_free=2','/p_torrent/video_list_t.php?cat=1&cat=2']) expect(validEntry('ying',p)).toBe(false);
});

it('normalizes legacy KG query bytes before validation and export',()=>{
 const s=snapshot('karagarga.in','/browse.php?dirsearch=C%E9dric+Klapisch');
 const draft=adaptSite({detection:detectArchitecture(s),snapshot:s,cookieHeader:'session=fixture'});
 const manual={...draft,pages:[{...draft.pages[0]!,path:'/browse.php?dirsearch=C%E9dric+Klapisch'}]};
 expect(validateDraft(manual).valid).toBe(true);
 expect(buildImportPayload(manual).site.entries[0]!.path).toBe('/browse.php?dirsearch=C%C3%A9dric+Klapisch');
 expect(validEntry('karagarga','/browse.php?passkey=secret&search=C%E9dric')).toBe(false);
});
