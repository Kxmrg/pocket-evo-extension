import { describe, expect, it } from 'vitest';
import { fixture } from './evo-fixture';
import { apiProtocol } from './api-protocol';
import { buildImportPayload, encodeImportPayload } from './payload';
import { validateDraft } from './validate-draft';
import { draftPageFromSnapshot } from './torrent-pages';
import { detectArchitecture } from './detect-architecture';
import type { PageSnapshot } from './types';
const snapshot=(url:string):PageSnapshot=>({url,origin:new URL(url).origin,host:new URL(url).hostname,title:'Fixture',userAgent:'Fixture',meta:[],links:[],resources:[],storage:[],candidates:[],textSample:''});
describe('Rousi / Yema independent sites',()=>{
 for(const [id,host,path] of [['rousi','rousi.pro','/torrents'],['yema','www.yemapt.org','/torrent/list']] as const){
  it(`${id} detects exact host and emits compatible independent QR`,()=>{
   const d=fixture(id);expect(apiProtocol(`https://${host}`)).toBe(id);expect(detectArchitecture(snapshot(`https://${host}`))).toMatchObject({id,supported:true});
   expect(validateDraft(d).valid).toBe(true);expect(buildImportPayload(d).site.family).toBe('api');expect(d.pages[0]?.path).toBe(path);expect(encodeImportPayload(d).text).toMatch(/^pocket-evo:\/\/import\/site/);
   expect(apiProtocol(`https://${host}.evil.test`)).toBeNull();
   d.pages[0]!.path=path+'?token=secret';expect(validateDraft(d).valid).toBe(false);
  });
 }
 it('Yema added category hash becomes a credential-free logical entry',()=>{
  const page=draftPageFromSnapshot(snapshot('https://www.yemapt.org/#/torrent/list?categoryId=3&downloadPromotionType=free'),'Movies');
  expect(page?.path).toBe('/torrent/list?categoryId=3&downloadPromotionType=free');
  const d=fixture('yema');d.pages=[page!];expect(validateDraft(d).valid).toBe(true);
 });
 it('Yema detail entry is rejected with a specific entry error, never silently imported',()=>{
  const d=fixture('yema');d.pages[0]!.path='/torrent/detail/42';expect(validateDraft(d).errors.pages).toContain('第1个');
 });
});
