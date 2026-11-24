import { expect,it } from 'vitest';
import { fixture } from './evo-fixture';
import {validateDraft} from './validate-draft';
it('accepts supported Evo drafts including Tnode without CSRF',()=>{for(const id of ['nexusphp','tnode','mtorrent'] as const)expect(validateDraft(fixture(id)).valid).toBe(true);});
it('blocks AGSV full title that Evo cannot store',()=>{const d=fixture();d.name='Arctic Global Seed Vault';expect(validateDraft(d).errors.name).toEqual({code:'nameTooLong'});});
it('blocks duplicate names, unsafe URLs and unsupported MT query parameters',()=>{
 for(const path of ['/index','//evil.invalid/browse','/browse?token=secret','/browse?cat=no','/browse?onlyFav=1','/browse?unknown=1']){const d=fixture('mtorrent');d.pages=[{name:'综合',path,tags:null,selected:true}];expect(validateDraft(d).errors.pages,path).toBeTruthy();}
 const d=fixture();d.pages.push({...d.pages[0]!});expect(validateDraft(d).errors.pages).toEqual({code:'pageNameDuplicate',index:1});
});
it('blocks invalid UID, origin and overlong tags',()=>{
 const d=fixture('mtorrent');d.passkey='abc';d.address='https://user:pass@api.m-team.cc/path';d.tags='a'.repeat(41);const e=validateDraft(d).errors;expect(e.passkey).toEqual({code:'uidInvalid'});expect(e.address).toEqual({code:'addressInvalid'});expect(e.tags).toEqual({code:'tagsLimit'});
});

it('explains unsupported MT query keys without echoing query values', () => {
 const d=fixture('mtorrent');
 d.pages=[
  {name:'',path:'//invalid.example',tags:null,selected:false},
  {name:'收藏',path:'/browse?onlyFav=private-value&not%3Da%3Dname=hidden',tags:null,selected:true},
 ];
 const issue=validateDraft(d).errors.pages;
 expect(issue).toEqual({code:'mtFiltersUnsupported',index:1,keys:['onlyFav']});
 expect(JSON.stringify(issue)).not.toContain('private-value');
});

it.each([
 ['', 'pageNameRequired'],
 ['a'.repeat(41), 'pageNameTooLong'],
])('reports the original draft index for invalid page name %j', (name, code) => {
 const d=fixture();
 d.pages=[
  {...d.pages[0]!,name:'',selected:false},
  {...d.pages[0]!,name},
  {...d.pages[0]!,name:'Valid'},
 ];
 expect(validateDraft(d).errors.pages).toEqual({code,index:1});
});

it.each([
 'https:pt.example',
 'https:/pt.example',
 'https://pt.exa\nmple',
 'https://pt.example\\',
 'https://pt.example?',
 'https://pt.example#',
])('rejects an origin that the URL parser silently repairs: %j', address => {
 const d=fixture();d.address=address;
 expect(validateDraft(d).errors.address).toBeTruthy();
});

it('accepts trimmed root origins and an explicit local port', () => {
 for (const address of [' https://pt.example/ ', 'http://localhost:8080']) {
  const d=fixture();d.address=address;
  expect(validateDraft(d).errors.address).toBeUndefined();
 }
});

it('validates the final UNIT3D entry length after adding the list view', () => {
 const d=fixture('unit3d');
 d.pages=[{name:'搜索',path:`/torrents?name=${'a'.repeat(2030)}`,tags:null,selected:true}];
 expect(validateDraft(d).errors.pages).toBeTruthy();
});

it('counts Chinese-comma tags separately for both tag limits', () => {
 const d=fixture();
 d.tags=Array.from({length:21}, (_, i) => `t${i}`).join('，');
 d.downloadTags=d.tags;
 expect(validateDraft(d).errors).toMatchObject({tags:{code:'tagsLimit'},downloadTags:{code:'tagsLimit'}});
 d.tags=`${'a'.repeat(30)}，${'b'.repeat(30)}`;
 d.downloadTags=d.tags;
 expect(validateDraft(d).valid).toBe(true);
});
