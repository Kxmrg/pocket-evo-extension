import { describe, expect, it } from 'vitest';
import { adaptSite } from './adapt-site';
import { apiProtocol } from './api-protocol';
import { detectArchitecture } from './detect-architecture';
import { buildImportPayload } from './payload';
import { validEntry } from './evo-entry';
import { draftPageFromSnapshot } from './torrent-pages';
import { validateDraft } from './validate-draft';
import { collectSiteDraft } from '../application/collect-site';
import { renderPopup } from '../popup/render';
import type { PageSnapshot } from './types';

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature';
const visitor = '0123456789abcdef0123456789abcdef';
function snapshot(url = 'https://piggo.me/torrents'): PageSnapshot {
  const u = new URL(url);
  return { url, origin:u.origin, host:u.hostname, title:'猪猪 :: 种子', userAgent:'Fixture UA',
    meta:[], resources:[], links:[], textSample:'', candidates:[],
    storage:[{area:'local',key:'pig_token',value:token}], pigVisitorId:visitor };
}

describe('Piggo independent protocol', () => {
  it('detects exact HTTPS origin and imports only the local Piggo token', () => {
    const s=snapshot();
    const detection=detectArchitecture(s);
    expect(detection).toMatchObject({id:'piggo',supported:true});
    const draft=adaptSite({detection,snapshot:s,cookieHeader:'other=fixture'});
    expect(draft).toMatchObject({architecture:'piggo',name:'猪猪',address:'https://piggo.me',token,cookie:'',passkey:null});
    expect(draft.pages[0]?.path).toBe('/torrents');
    expect(validateDraft(draft).valid).toBe(true);
    expect(buildImportPayload(draft).site).toMatchObject({family:'api',secrets:{pigToken:token,pigVisitorId:visitor}});
    expect(buildImportPayload(draft).site.secrets).not.toHaveProperty('cookie');
    expect(apiProtocol('https://piggo.me.evil.test')).toBeNull();
    expect(apiProtocol('http://piggo.me')).toBeNull();
  });
  it('requires a valid full local token and never accepts a different origin or session key', () => {
    for (const entries of [[], [{area:'session' as const,key:'pig_token',value:token}], [{area:'local' as const,key:'pig_token',value:'bad'}]]) {
      const s={...snapshot(), storage:entries};
      const draft=adaptSite({detection:{id:'piggo',supported:true,confidence:'certain',reasons:[]},snapshot:s,cookieHeader:''});
      expect(validateDraft(draft).errors.token).toBeTruthy();
    }
    const s=snapshot('https://piggo.me.evil.test/torrents');
    const d=adaptSite({detection:{id:'piggo',supported:true,confidence:'certain',reasons:[]},snapshot:s,cookieHeader:''});
    expect(d.token).toBeNull();
  });
  it('rejects malformed or expired JWT payloads before generating the QR', () => {
    const jwt = (payload: string) => `eyJ.${btoa(payload).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}.sig`;
    const draft=adaptSite({detection:detectArchitecture(snapshot()),snapshot:snapshot(),cookieHeader:''});
    for (const bad of [jwt('invalid'),jwt('[]'),jwt('{"exp":1}'),jwt('{"exp":"later"}')]) {
      draft.token=bad;
      expect(validateDraft(draft).errors.token).toBeTruthy();
    }
    draft.token=jwt('{"exp":null}');
    expect(validateDraft(draft).errors.token).toBeUndefined();
    draft.token=jwt('{"exp":4102444800}');
    expect(validateDraft(draft).errors.token).toBeUndefined();
  });
  it('only allows supported resource-list entry routes', () => {
    expect(validEntry('piggo','/torrents')).toBe(true);
    for (const category of ['movie','tv','children','anime','variety','documentary','sports','music','picbook','withaudio']) {
      expect(validEntry('piggo',`/torrents/${category}`)).toBe(true);
    }
    expect(validEntry('piggo','/torrents?tag=4')).toBe(true);
    expect(validEntry('piggo','/torrents/movie?tag=4,3')).toBe(true);
    expect(validEntry('piggo','/torrents?tag=4%2C3')).toBe(true);
    expect(validEntry('piggo',`/torrents?tag=${Array.from({length:22},(_,i)=>i+1).join(',')}`)).toBe(true);
    for (const path of ['/login','/detail/123','/torrents?tag=0','/torrents?tag=4,0','/torrents?tag=4,,3','/torrents?tag=12345678901','/torrents?tag=4&tag=5','/torrents?token=secret','//evil.test/torrents',`/torrents?tag=${Array.from({length:23},(_,i)=>i+1).join(',')}`]) expect(validEntry('piggo',path)).toBe(false);
  });
  it('preserves multi-tag current page in the generated QR payload', () => {
    const s=snapshot('https://piggo.me/torrents/movie?tag=4%2C3');
    const draft=adaptSite({detection:detectArchitecture(s),snapshot:s,cookieHeader:''});
    const page=draftPageFromSnapshot(s,'电影','piggo');
    expect(page?.path).toBe('/torrents/movie?tag=4%2C3');
    draft.pages=[page!];
    expect(buildImportPayload(draft).site.entries).toEqual([{name:'电影',path:'/torrents/movie?tag=4%2C3'}]);
  });
  it('collects token without requesting or exporting site cookies', async () => {
    const s=snapshot();
    let cookieRead = false;
    const result=await collectSiteDraft({getContext:async()=>({url:s.url,origin:s.origin,hasPermission:true}),readSnapshot:async()=>s,readCookies:async()=>{cookieRead=true;return []}});
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;
    expect(cookieRead).toBe(false);
    expect(result.draft.fieldWarnings.cookie).toBeUndefined();
    expect(buildImportPayload(result.draft).site.secrets).toEqual({pigToken:token,pigVisitorId:visitor});
  });
  it('rejects a page navigation race before importing another origin\'s credentials', async () => {
    const s=snapshot();
    const result=await collectSiteDraft({getContext:async()=>({url:'https://example.test/',origin:'https://example.test',hasPermission:true}),readSnapshot:async()=>s,readCookies:async()=>[]});
    expect(result.state).toBe('error');
  });
  it('shows the existing secure token control without Cookie or Passkey', () => {
    const s=snapshot();
    const draft=adaptSite({detection:detectArchitecture(s),snapshot:s,cookieHeader:''});
    const root=document.createElement('div');
    const actions = new Proxy({}, {get:()=>()=>{}}) as never;
    renderPopup(root,{kind:'ready',draft,errors:{},revealed:new Set()},actions);
    expect(root.querySelector<HTMLInputElement>('#token')?.type).toBe('password');
    expect(root.querySelector<HTMLInputElement>('#pigVisitorId')?.type).toBe('password');
    expect(root.querySelector('label[for="token"]')?.textContent).toBe('登录 Token');
    expect(root.querySelector('#cookie')).toBeNull();
    expect(root.querySelector('#passkey')).toBeNull();
  });
  it('requires a valid visitor id and rejects malformed visitor values', () => {
    const s=snapshot();
    const draft=adaptSite({detection:detectArchitecture(s),snapshot:s,cookieHeader:''});
    for (const value of [undefined, '', '0'.repeat(31), 'A'.repeat(32), 'g'.repeat(32)]) {
      draft.pigVisitorId=value;
      expect(validateDraft(draft).errors.pigVisitorId).toBeTruthy();
    }
    draft.pigVisitorId=visitor;
    expect(validateDraft(draft).errors.pigVisitorId).toBeUndefined();
  });
});
