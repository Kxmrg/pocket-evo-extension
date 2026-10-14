import {expect,it} from 'vitest';
import {apiProtocol} from './api-protocol';
import {fixture} from './evo-fixture';
import {buildImportPayload} from './payload';
import {validateDraft} from './validate-draft';
it('all independent protocols export one API family identified by domain',()=>{
 for(const id of ['tnode','mtorrent','haidan','sunnypt'] as const) {
  const d=fixture(id);expect(apiProtocol(d.address)).toBe(id);expect(validateDraft(d).valid).toBe(true);
  const p=buildImportPayload(d);expect(p.site.family).toBe('api');expect(p.site).not.toHaveProperty('scheme');
 }
});
it('does not send an API draft to unknown or suffix-spoofed origins',()=>{
 for(const host of ['sunnypt.top.evil.test','evil.haidan.cc','unknown.test']) {
  expect(apiProtocol(`https://${host}`)).toBeNull();const d=fixture('sunnypt');d.address=`https://${host}`;expect(validateDraft(d).errors.address).toBeTruthy();
 }
});
it('independent API entries reject unimplemented or mutating parameters explicitly',()=>{
 const d=fixture('haidan');d.pages[0]!.path='/torrents.php?action=delete';expect(validateDraft(d).errors.pages).toContain('第1个');
 const s=fixture('sunnypt');s.pages[0]!.path='/torrents?category=Movies&tmdbId=42';expect(validateDraft(s).valid).toBe(true);
});
