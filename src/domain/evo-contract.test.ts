// Reproducible cross-language fixtures; only synthetic credentials are written.
import {writeFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {fixture} from './evo-fixture';
import {encodeImportPayload} from './payload';
it('exports real plugin payloads for the Evo decoder regression',()=>{
 const mt=fixture('mtorrent');mt.pages.push({name:'电影',path:'/browse/movie',tags:null,selected:true},{name:'官组',path:'/browse?team=44&team=9&team=43',tags:null,selected:true});
 const codes={agsv:encodeImportPayload(fixture()).text,mt:encodeImportPayload(mt).text,tnode:encodeImportPayload(fixture('tnode')).text,haidan:encodeImportPayload(fixture('haidan')).text,sunnypt:encodeImportPayload(fixture('sunnypt')).text};
 expect(Object.values(codes).every(v=>v.startsWith('pocket-evo://'))).toBe(true);
 writeFileSync('/tmp/evo-plugin-qr-fixtures.json',JSON.stringify(codes,null,2));
});
