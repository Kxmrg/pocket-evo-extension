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
 it('rejects unsupported architectures and oversized payloads before showing a QR',()=>{
  const d=fixture();d.architecture='gazelle';d.scheme=5;expect(()=>encodeImportPayload(d)).toThrow();
  const large=fixture();large.cookie=Array.from({length:16000},(_,i)=>String.fromCharCode(33+(i*i%90))).join('');
  large.cookie=Array.from({length:16000},()=>Math.random().toString(36).slice(2,3)).join('');
  expect(()=>encodeImportPayload(large)).toThrow(/二维码/);
 });
});
