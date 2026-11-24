import { inflateSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { fixture } from './evo-fixture';
import { buildImportPayload, encodeImportPayload } from './payload';
import type { ArchitectureId, PageSnapshot } from './types';
describe('Evo QR',()=>{
 it('exports only Evo fields and shortens AGSVPT display name',()=>{
  const p=buildImportPayload(fixture());
  expect(p.protocol).toBe('pocket-evo.site'); expect(p.site.name).toBe('AGSVPT');
  expect(p.site.entries).toEqual([{name:'综合',path:'/torrents.php'}]);
  for(const key of ['widget','top','search','scheme','token','pages']) expect(p.site).not.toHaveProperty(key);
 });
 it('separates API credentials and preserves multiple MT category entries',()=>{
  const d=fixture('mtorrent');d.pages.push({name:'电影',path:'/browse/movie',selected:true,tags:null},{name:'官组',path:'/browse?team=44&team=9&team=43',selected:true,tags:null});
  const p=buildImportPayload(d);expect(p.site.secrets).toEqual({apiKey:'fixture-api',mtUid:'42',webToken:'fixture-auth',webDeviceId:'fixture-did',webVisitorId:'fixture-vid'});expect(p.site.entries).toHaveLength(3);
  const encoded=encodeImportPayload(d);const data=new URL(encoded.text).searchParams.get('data')!;
  expect(JSON.parse(new TextDecoder().decode(inflateSync(Uint8Array.from(atob(data.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))))).toEqual(p);
 });
 it('does not export CSRF or stale tokens for NP/Tnode',()=>{
  for(const id of ['nexusphp','tnode'] as const){const d=fixture(id);d.token='stale'; expect(JSON.stringify(buildImportPayload(d))).not.toContain('stale');}
 });
 it('throws the first validation issue without exposing rejected credentials',()=>{
  const d=fixture();d.architecture='unknown';d.scheme=null;d.cookie='private-fixture\ncredential';
  expect(()=>encodeImportPayload(d)).toThrow(expect.objectContaining({
   name:'ImportPayloadError',message:'architectureUnsupported',issue:{code:'architectureUnsupported'},
  }));
 });
 it('rejects payloads that exceed QR capacity after compression',()=>{
  const d=fixture();
  let seed=1234;
  d.cookie=Array.from({length:16000},()=>{
   seed=(Math.imul(1664525,seed)+1013904223)>>>0;
   return String.fromCharCode(33+seed%90);
  }).join('');
  expect(()=>encodeImportPayload(d)).toThrow(expect.objectContaining({
   name:'ImportPayloadError',message:'qrCapacity',issue:{code:'qrCapacity'},
  }));
 });
 it('rejects highly compressible data that exceeds the Evo decoded byte limit', () => {
  const d=fixture();
  d.pages=Array.from({length:50}, (_, i) => ({name:`页面${i}`,path:`/torrents.php?search=${'汉'.repeat(2000)}`,selected:true,tags:null}));
  expect(()=>encodeImportPayload(d)).toThrow(expect.objectContaining({
   name:'ImportPayloadError',message:'decodedPayloadTooLarge',issue:{code:'decodedPayloadTooLarge'},
  }));
 });
 it('exports only distinct chosen tags across English and Chinese separators', () => {
  const d=fixture();d.tags=' MOVIE， TV, MOVIE ，';d.downloadTags=' 剧集，电影,剧集 ';
  const p=buildImportPayload(d);
  expect(p.site.tags).toEqual(['MOVIE','TV']);
  expect(p.site.downloadTags).toEqual(['剧集','电影']);
 });
 it('omits empty tag lists after clearing their contents', () => {
  const d=fixture();d.tags=' , ， ';d.downloadTags=' ， , ';
  const p=buildImportPayload(d);
  expect(p.site).not.toHaveProperty('tags');
  expect(p.site).not.toHaveProperty('downloadTags');
 });
});
