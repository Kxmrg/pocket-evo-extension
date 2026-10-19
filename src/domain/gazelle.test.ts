import {describe,it,expect} from 'vitest';
import {detectArchitecture} from './detect-architecture';
import {fixture} from './evo-fixture';
import {buildImportPayload} from './payload';
import {validEntry} from './evo-entry';
import {extractTorrentPages} from './torrent-pages';
import type {PageSnapshot} from './types';
const hosts=['alpharatio.cc','anthelion.me','broadcasthe.net','brokenstones.is','dicmusic.com','gazellegames.net','hdf.world','passthepopcorn.me','redacted.sh','emparadise.rs','greatposterwall.com'];
function snap(host:string,path='/torrents.php'):PageSnapshot{return {url:`https://${host}${path}`,origin:`https://${host}`,host,title:host,userAgent:'Fixture',meta:[],resources:[],links:[],textSample:'',storage:[],candidates:[]};}
describe('Gazelle HTML import',()=>{
 it.each(hosts)('detects and exports %s without API credentials',host=>{
  expect(detectArchitecture(snap(host))).toMatchObject({id:'gazelle',supported:true});
  const draft=fixture('gazelle');draft.address=`https://${host}`;draft.passkey='unused';draft.token='unused';
  const payload=buildImportPayload(draft);expect(payload.site.family).toBe('gazelle');
  expect(payload.site.secrets).toEqual({cookie:draft.cookie});expect(payload.site.entries).toEqual([{name:'综合',path:'/torrents.php'}]);
 });
 it('preserves grouped and flat filters, rejects torrent and action routes',()=>{
  for(const path of ['/torrents.php?group_results=0&filter_cat[1]=1','/torrents.php?action=advanced&group_results=1']){
   expect(validEntry('gazelle',path)).toBe(true);expect(extractTorrentPages('gazelle',snap(hosts[0]!,path))[0]?.path).toBe(path);
  }
  for(const path of ['/torrents.php?id=1','/torrents.php?torrentid=2','/torrents.php?action=download&id=3','/torrents.php?action=delete','/torrents.php?authkey=secret','/ajax.php?action=browse']){
   expect(validEntry('gazelle',path)).toBe(false);expect(extractTorrentPages('gazelle',snap(hosts[0]!,path))[0]?.path).toBe('/torrents.php');
  }
 });
});
