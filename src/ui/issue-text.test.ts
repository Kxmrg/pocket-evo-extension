import { expect, it } from 'vitest';
import { entryError } from '../domain/evo-entry';
import { isImportIssue, issueCodes } from '../domain/import-issue';
import { issueText } from './issue-text';

const languages = ['zh', 'en', 'fr', 'de', 'es'] as const;

const pageNameRequired = [
  ['zh', '请输入页面名称'],
  ['en', 'Enter a page name'],
  ['fr', 'Saisissez un nom de page'],
  ['de', 'Seitennamen eingeben'],
  ['es', 'Escribe un nombre de página'],
] as const;

it.each(pageNameRequired)('renders the empty page name message in %s', (locale, expected) => {
  expect(issueText({code:'pageNameRequired',index:3}, locale)).toBe(expected);
});

it.each(languages)('provides %s messages for every issue code', locale => {
  for (const code of issueCodes) {
    const message = issueText({code}, locale);
    expect(message, code).not.toBe(code);
    expect(message.trim(), code).not.toBe('');
    expect(message, code).not.toMatch(/\{\w+\}/);
  }
});

it.each(languages)('only renders safe filter names in %s', locale => {
  const issue = entryError('mtorrent', '/browse?onlyFav=private-value&bad%3Dkey=hidden');
  expect(issue).toEqual({code:'mtFiltersUnsupported',keys:['onlyFav']});
  const message = issueText(issue!, locale);
  expect(message).toContain('onlyFav');
  expect(message).not.toContain('private-value');
  expect(message).not.toContain('bad=key');
  expect(message).not.toContain('hidden');
  expect(issueText({code:'mtFiltersUnsupported',keys:['token=private-fixture']}, locale)).not.toContain('private-fixture');
});

it.each(languages)('only renders supported protocol field names in %s', locale => {
  expect(issueText({code:'credentialMissing',field:'DID'}, locale)).toContain('DID');
  expect(issueText({code:'credentialMissing',field:'private-fixture'}, locale)).not.toContain('private-fixture');
});

it.each([
  ['zh', '请修改或删除此页面'],
  ['en', 'Edit or remove the page'],
  ['fr', 'Modifiez ou supprimez la page'],
  ['de', 'Ändere oder entferne die Seite'],
  ['es', 'Modifica o elimina la página'],
] as const)('uses the available page recovery actions in %s', (locale, recovery) => {
  expect(issueText({code:'entryUnsupported'}, locale)).toContain(recovery);
  expect(issueText({code:'mtFiltersUnsupported',keys:['onlyFav']}, locale)).toContain(recovery);
});

it('recognizes only declared issue codes with valid metadata types', () => {
  expect(isImportIssue({code:'mtFiltersUnsupported',index:3,keys:['onlyFav']})).toBe(true);
  for (const value of [
    'pageNameRequired', null, {code:'toString'}, {code:'pageNameRequired',index:-1},
    {code:'mtFiltersUnsupported',keys:[1]}, {code:'credentialMissing',field:{}},
  ]) expect(isImportIssue(value)).toBe(false);
});
