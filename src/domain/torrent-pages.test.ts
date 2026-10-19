import {expect,it} from 'vitest';
import {extractTorrentPages,draftPageFromSnapshot,createManualPage} from './torrent-pages';
import type {PageSnapshot} from './types';
function snapshot(url:string,links:PageSnapshot['links']=[]):PageSnapshot{return {url,origin:new URL(url).origin,host:new URL(url).hostname,title:'Test',userAgent:'Fixture',meta:[],resources:[],links,textSample:'',storage:[],candidates:[]};}
it('finds TTG browse.php and AGSV torrents.php from same-origin navigation',()=>{
 for(const path of ['/browse.php','/torrents.php']) expect(extractTorrentPages('nexusphp',snapshot('https://pt.example/index.php',[{text:'综合',href:'https://pt.example'+path}]))[0]?.path).toBe(path);
});
it('does not treat current category, homepage, detail or external links as the default',()=>{
 expect(extractTorrentPages('nexusphp',snapshot('https://pt.example/torrents.php?cat=401'))[0]?.path).toBe('/torrents.php');
 expect(extractTorrentPages('nexusphp',snapshot('https://pt.example/index.php',[{text:'综合',href:'https://evil.invalid/browse.php'}]))[0]?.path).toBe('/torrents.php');
});
it('always starts MT at browse, including when reading API settings',()=>{for(const path of ['/index','/usercp','/browse/adult'])expect(extractTorrentPages('mtorrent',snapshot('https://kp.m-team.cc'+path))[0]?.path).toBe('/browse');});
it('preserves explicitly added category query',()=>{expect(draftPageFromSnapshot(snapshot('https://kp.m-team.cc/browse?team=44&team=9'),'官组')?.path).toBe('/browse?team=44&team=9');expect(createManualPage('mtorrent').path).toBe('/browse');});
it('uses Tnode search and offers no unsupported architecture defaults',()=>{expect(extractTorrentPages('tnode',snapshot('https://zhuque.in/'))[0]?.path).toBe('/torrent/search');expect(extractTorrentPages('unknown',snapshot('https://example.com/'))).toEqual([]);});
