import type { PopupState } from '../state';
import type { Locale } from '../../ui/locales';
import { issueText } from '../../ui/issue-text';
import { icon } from '../../ui/icons';
import { spinner } from '../../ui/spinner';
import { button, esc, header, type Text } from '../../ui/markup';
export function statusView(state: Exclude<PopupState,{kind:'idle'|'ready'|'qr'}>,t:Text,locale:Locale):string {
  const title=state.kind==='loading'?t(state.reason==='requestingPermission'?'requestingPermission':'loadingTitle'):t(state.kind==='permission'?'permissionTitle':state.kind==='unsupported'?'unsupportedTitle':'errorTitle');
  const detail=state.kind==='error'?issueText(state.issue,locale):state.kind==='unsupported'?t('unsupportedText'):state.kind==='permission'?t('permissionText'):'';
  return `<div class="shell state-page">${header(t)}<section class="state-body">${state.kind==='loading'?spinner():state.kind==='permission'?`<div class="state-glyph">${icon('lock')}</div>`:'<div class="astronaut" aria-hidden="true"></div>'}<h1 tabindex="-1">${title}</h1>${detail?`<p ${state.kind==='error'?'role="alert"':''}>${esc(detail)}</p>`:''}${state.kind==='permission'?`<div class="permission-site">${icon('globe-simple')}<strong>${esc(state.origin)}</strong></div>${button(t('permissionAction'),'permission','lock-open')}`:state.kind==='loading'?`<span class="sr-only" role="status">${title}</span>`:button(t('retry'),'retry','arrows-clockwise','dashed')}</section></div>`;
}
