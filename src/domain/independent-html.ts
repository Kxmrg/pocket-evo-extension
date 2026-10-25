import type { ArchitectureId } from './types';
export const independentHtml = new Set<ArchitectureId>(['exoticaz','filelist','cinemageddon','hdbits','karagarga','torrentleech','ying','iptorrents','yzyy']);
export const independentHtmlDefaults: Partial<Record<ArchitectureId,string>> = {
  exoticaz:'/torrents', filelist:'/browse.php', cinemageddon:'/browse.php',
  hdbits:'/browse.php', karagarga:'/browse.php', torrentleech:'/torrents/browse/index', ying:'/p_torrent/video_list_t.php', iptorrents:'/t', yzyy:'/torrents.php',
};
export const independentHtmlNames: Partial<Record<ArchitectureId,string>> = {
  exoticaz:'ExoticaZ', filelist:'FileList', cinemageddon:'Cinemageddon',
  hdbits:'HDBits', karagarga:'KG', torrentleech:'TorrentLeech', ying:'Ying', iptorrents:'IPTorrents', yzyy:'YzYY',
};
export function normalizeYingEntry(path:string):string {
  const u=new URL(path,'https://entry.invalid');
  if (u.pathname==='/p_torrent/video_list.php') u.pathname='/p_torrent/video_list_t.php';
  if (u.pathname==='/p_music/music_list.php') u.pathname='/p_music/music_list_t.php';
  return u.pathname+u.search+u.hash;
}
export function validIndependentHtmlEntry(id:ArchitectureId,path:string):boolean {
  const u=new URL(id==='ying'?normalizeYingEntry(path):path,'https://entry.invalid');
  const valid=id==='yzyy'?u.pathname==='/torrents.php':id==='iptorrents'?u.pathname==='/t':id==='exoticaz'?/^\/torrents\/?$/.test(u.pathname):id==='ying'?['/p_torrent/video_list_t.php','/p_music/music_list_t.php'].includes(u.pathname):id==='torrentleech'?/^\/torrents\/browse\/index(?:\/|$)/.test(u.pathname):id==='filelist'?['/browse.php','/internal.php'].includes(u.pathname):u.pathname==='/browse.php';
  if (id==='torrentleech') {
    const parts=u.pathname.replace(/\/$/,'').split('/').slice(1);
    const keys=new Set(['categories','facets','query','added','orderby','order','page','imdbID','actor','tvmazeEpisodeID','igdbID','animeID','exact']);
    const seen=new Set<string>();
    if (u.search || (parts.length-3)%2!==0) return false;
    for(let i=3;i<parts.length;i+=2) {const key=parts[i]!;if(!keys.has(key)||seen.has(key)||!parts[i+1]) return false;seen.add(key);}
  }
  if(id==='yzyy') {
    const arrays=new Set(['cat[]','medium[]','vcodec[]','acodec[]','res[]','tag[]']);
    const scalars=new Set(['ajax','page','keyword','promo','station','sort','dir']);
    if([...u.searchParams.keys()].some(k=>!arrays.has(k)&&(!scalars.has(k)||u.searchParams.getAll(k).length!==1))) return false;
  }
  if(id==='ying') {
    const keys=new Set(['page','seeder','search','area','column','sort','btn_search',...(u.pathname.startsWith('/p_music/')?['format','bitrate','media','tag']:['tag_gf','tag_free','tag_zz','complete','source','cat','suggest'])]);
    if([...u.searchParams.keys()].some(k=>!keys.has(k)||u.searchParams.getAll(k).length!==1)) return false;
  }
  return valid && [...u.searchParams.keys()].every(k=>/^[A-Za-z0-9_][A-Za-z0-9_\[\]-]{0,63}$/.test(k) && u.searchParams.getAll(k).length<=100 && u.searchParams.getAll(k).every(v=>v.length<=1024));
}

export function normalizeKaragargaEntry(path:string):string {
  const index=path.indexOf('?');
  if(index<0 || path.includes('#') || /%(?![0-9a-f]{2})/i.test(path.slice(index+1))) return path;
  function decode(value:string):string {
    const source=value.replace(/\+/g,' ');
    try{return decodeURIComponent(source);} catch {
      return source.replace(/(?:%[0-9a-f]{2})+/gi,bytes=>new TextDecoder('windows-1252').decode(Uint8Array.from(bytes.match(/%[0-9a-f]{2}/gi)!,b=>parseInt(b.slice(1),16))));
    }
  }
  const params=new URLSearchParams();
  for(const pair of path.slice(index+1).split('&')) {if(!pair) continue;const eq=pair.indexOf('=');params.append(decode(eq<0?pair:pair.slice(0,eq)),decode(eq<0?'':pair.slice(eq+1)));}
  return path.slice(0,index)+'?'+params.toString();
}
