import { version } from '../../../package.json';
import { icon } from '../../ui/icons';
import { header, heading, button, type Text } from '../../ui/markup';
export function homeView(t:Text): string {
  return `<div class="shell home">${header(t,`<span class="version">v${version}</span>`)}<section class="welcome"><img src="/branding/ring-a.png" alt="" width="82" height="82"><h1 tabindex="-1">${t('homeTitle')}</h1></section>
  <nav class="resource-links" aria-label="${t('resourceLinks')}">
    <a class="button outlined" href="https://github.com/Kxmrg/pocket-qt-extension" target="_blank" rel="noreferrer"><span>${t('update')}</span>${icon('arrow-square-out')}</a>
    <a class="button outlined" href="https://kxmrg.com/" target="_blank" rel="noreferrer"><span>${t('project')}</span>${icon('arrow-square-out')}</a>
    <a class="button outlined" href="https://pocket.kxmrg.com/user/licenses" target="_blank" rel="noreferrer"><span>${t('license')}</span>${icon('arrow-square-out')}</a>
  </nav>
  <section class="panel guide">${heading(t('guide'),'list')}<ol>${(['step1','step2','step3'] as const).map((key,i) => `<li><span class="step-icon">${icon((['browser-pointer','file-text','qr-code'] as const)[i]!)}</span><div><strong>${t(key)}</strong><p>${t((['step1Text','step2Text','step3Text'] as const)[i]!)}</p></div></li>`).join('')}</ol></section><p class="local-note">${icon('shield-check')}${t('privacyTitle')}</p>${button(t('read'),'read','browser-pointer')}</div>`;
}
