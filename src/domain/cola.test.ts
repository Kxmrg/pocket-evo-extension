import {describe,it,expect} from 'vitest';
import {apiProtocol} from './api-protocol';
import {validEntry} from './evo-entry';
import {fixture} from './evo-fixture';
import {validateDraft} from './validate-draft';
import {encodeImportPayload} from './payload';
describe('Cola ReelCore',()=>{
 it('recognizes exact origin and defaults to individual torrents',()=>{expect(apiProtocol('https://www.colapt.com')).toBe('cola');expect(apiProtocol('https://www.colapt.com.evil.org')).toBeNull();const d=fixture('cola');expect(d.pages[0]?.path).toContain('view=torrents');expect(validateDraft(d).valid).toBe(true);expect(encodeImportPayload(d).text).toContain('pocket-evo://');});
 it('accepts real category params and rejects unsafe/unknown routes',()=>{expect(validEntry('cola','/browse?category=tv&direction=desc&view=torrents')).toBe(true);for(const p of ['/torrents/42','/browse?token=secret','/browse?q=a&q=b','/browse?unsupported=x'])expect(validEntry('cola',p)).toBe(false);});
});
