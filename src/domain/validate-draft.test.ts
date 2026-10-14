import { expect,it } from 'vitest';
import { fixture } from './evo-fixture';
import {validateDraft} from './validate-draft';
it('accepts supported Evo drafts including Tnode without CSRF',()=>{for(const id of ['nexusphp','tnode','mtorrent'] as const)expect(validateDraft(fixture(id)).valid).toBe(true);});
it('blocks AGSV full title that Evo cannot store',()=>{const d=fixture();d.name='Arctic Global Seed Vault';expect(validateDraft(d).errors.name).toBeTruthy();});
it('blocks duplicate names, unsafe URLs and unsupported MT query parameters',()=>{
 for(const path of ['/index','//evil.invalid/browse','/browse?token=secret','/browse?cat=no','/browse?onlyFav=1','/browse?unknown=1']){const d=fixture('mtorrent');d.pages=[{name:'综合',path,tags:null,selected:true}];expect(validateDraft(d).errors.pages,path).toBeTruthy();}
 const d=fixture();d.pages.push({...d.pages[0]!});expect(validateDraft(d).errors.pages).toBeTruthy();
});
it('blocks invalid UID, origin and overlong tags',()=>{
 const d=fixture('mtorrent');d.passkey='abc';d.address='https://user:pass@api.m-team.cc/path';d.tags='a'.repeat(41);const e=validateDraft(d).errors;expect(e.passkey).toBeTruthy();expect(e.address).toBeTruthy();expect(e.tags).toBeTruthy();
});

it('explains unsupported MT query keys without echoing query values', () => {
 const d=fixture('mtorrent');
 d.pages=[{name:'收藏',path:'/browse?onlyFav=private-value',tags:null,selected:true}];
 const message=validateDraft(d).errors.pages!;
 expect(message).toContain('第1个');
 expect(message).toContain('onlyFav');
 expect(message).not.toContain('private-value');
});
