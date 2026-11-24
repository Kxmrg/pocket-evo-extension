import { independentHtml } from '../../domain/independent-html';
import type { SiteDraft } from '../../domain/adapt-site';
import { field, type Text } from '../../ui/markup';
export function credentials(draft: SiteDraft, t: Text): string {
  const a = draft.architecture;
  const secret = (key: 'cookie'|'passkey'|'token'|'webDeviceId'|'webVisitorId'|'webToken'|'pigVisitorId', label: string, required = false) => field(t,key,label,draft[key] ?? '',key,{secret:true,required});
  const cookie = a === 'mtorrent' || a === 'piggo' ? '' : secret('cookie','Cookie',true);
  const noPasskey = ['tnode','piggo','rousi','yema','cola','sunnypt','gazelle','unit3d','btitracker','private','beyondhd'].includes(a) || independentHtml.has(a);
  const noToken = ['haidan','tnode','nexusphp','rousi','yema','cola','sunnypt','gazelle','unit3d','btitracker','private','beyondhd'].includes(a) || independentHtml.has(a);
  const passkey = noPasskey ? '' : secret('passkey', a === 'mtorrent' ? 'UID' : 'Passkey', a === 'mtorrent');
  const token = noToken ? '' : secret('token', a === 'mtorrent' ? 'API Key' : a === 'piggo' ? t('token') : 'Token', a === 'mtorrent' || a === 'piggo');
  return cookie + passkey + token + (a === 'mtorrent' ? secret('webDeviceId','DID') + secret('webVisitorId','VID') + secret('webToken','Auth') : a === 'piggo' ? secret('pigVisitorId',t('visitor'),true) : '');
}
