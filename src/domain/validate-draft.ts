import { apiProtocol } from './api-protocol';
import type { SiteDraft } from './adapt-site';
import { entryError } from './evo-entry';
export interface DraftValidation { valid: boolean; errors: Record<string, string>; }
export function validateDraft(draft: SiteDraft): DraftValidation {
  const errors: Record<string,string> = {};
  const expected: Record<string,number> = {nexusphp:0,tnode:1,mtorrent:2,haidan:3,sunnypt:4,rousi:5,yema:6,cola:7};
  if (draft.scheme === null || expected[draft.architecture] !== draft.scheme) errors.architecture = '请选择 Evo 支持的架构';
  if (draft.architecture !== 'nexusphp' && apiProtocol(draft.address) !== draft.architecture) errors.address = '暂不支持此独立架构站点';
  if (!draft.name.trim()) errors.name = '请输入站点名称';
  else if (Array.from(draft.name.trim()).length > 20) errors.name = '站点名称最多20个字符';
  try {
    const u = new URL(draft.address);
    if (!['http:','https:'].includes(u.protocol) || !u.hostname || u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '') || draft.address.length>2048) throw new Error();
  } catch { errors.address = '请输入有效的 HTTP 或 HTTPS 站点地址'; }
  if (draft.architecture !== 'mtorrent' && (!draft.cookie.trim() || draft.cookie.length > 16384 || /[\r\n]/.test(draft.cookie))) errors.cookie = '请输入有效 Cookie';
  if (draft.architecture !== 'mtorrent' && ((draft.passkey?.length ?? 0)>256 || /[\s\x00-\x1f]/.test(draft.passkey ?? ''))) errors.passkey='Passkey 格式不正确';
  if (draft.architecture === 'mtorrent') {
    if (!draft.token?.trim()) errors.token = '请输入 API Key';
    if (!/^[1-9][0-9]{0,19}$/.test(draft.passkey ?? '')) errors.passkey = '请输入有效 UID';
    for (const k of ['token','webToken','webDeviceId','webVisitorId'] as const) if ((draft[k]?.length ?? 0)>16384 || /[\s\x00-\x1f]/.test(draft[k] ?? '')) errors[k] = '凭据格式不正确';
  }
  if (draft.importUserAgent && ((draft.userAgent?.length ?? 0)>512 || /[\r\n]/.test(draft.userAgent ?? ''))) errors.userAgent='User-Agent 格式不正确';
  const pages=draft.pages.filter(p=>p.selected);
  if (!pages.length || pages.length>50) errors.pages='请选择1至50个资源入口';
  else if (pages.some(p=>!p.name.trim() || Array.from(p.name.trim()).length>40)) errors.pages='入口名称需为1至40个字符';
  else if (new Set(pages.map(p=>p.name.trim().toLowerCase())).size!==pages.length) errors.pages='入口名称不能重复';
  else {
    const index=pages.findIndex(p=>entryError(draft.architecture,p.path));
    if (index>=0) errors.pages=`第${index+1}个已选入口：${entryError(draft.architecture,pages[index]!.path)}`;
  }
  for (const k of ['tags','downloadTags'] as const) {
    const tags=[...new Set((draft[k] ?? '').split(',').map(s=>s.trim()).filter(Boolean))];
    if (tags.length>20 || tags.some(s=>Array.from(s).length>40)) errors[k]='最多20个标签，每个不超过40个字符';
  }
  return {valid:!Object.keys(errors).length,errors};
}
