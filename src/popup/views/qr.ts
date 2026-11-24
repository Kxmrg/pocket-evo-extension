import type { PopupState } from '../state';
import { icon } from '../../ui/icons';
import { button, circle, esc, header, privacy, type Text } from '../../ui/markup';
import { architectureName } from '../components/architecture-select';
export function qrView(state:Extract<PopupState,{kind:'qr'}>,t:Text):string {
  return `<div class="shell qr-page">${header(t,circle(t('refresh'),'refresh','arrows-clockwise'))}<div class="page-heading"><h1 tabindex="-1">${t('scanTitle')}</h1></div><section class="panel qr-panel"><div class="qr-image"><canvas id="qr-canvas" aria-label="${t('qrLabel')}"></canvas></div><div class="qr-failure" role="alert" hidden>${icon('warning-circle')}<p>${t('qrFailed')}</p></div><div class="qr-site" data-qr-site-info><div class="site-avatar">${icon('globe-simple')}</div><div><strong>${esc(state.draft.name)}</strong><span>${esc(state.draft.address)}</span></div><span class="tag">${esc(architectureName(state.draft.architecture,t))}</span></div></section>${privacy(t)}<p class="helper scan-help">${t('qrHint')}</p><span class="sr-only" data-qr-error></span><div class="qr-actions">${button(t('fullscreen'),'fullscreen','arrows-out')}${button(t('back'),'back','pencil-simple','secondary')}</div></div>`;
}
