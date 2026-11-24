import { icon } from '../ui/icons';
import { esc, header, privacy, type Text } from '../ui/markup';

export function fullscreenQrView(t: Text, siteName: string): string {
  return `<div class="fullscreen-shell">
    ${header(t)}
    <div class="fullscreen-flow">
      <h1>${esc(t('scanTitle'))}</h1>
      <section class="panel fullscreen-qr">
        <div class="fullscreen-canvas-slot" data-canvas-slot aria-busy="true"></div>
        <div class="fullscreen-site">
          <span class="fullscreen-site-icon">${icon('globe-simple')}</span>
          <strong>${esc(siteName)}</strong>
        </div>
      </section>
      ${privacy(t)}
    </div>
  </div>`;
}

export function fullscreenErrorView(t: Text, expired: boolean): string {
  return `<div class="fullscreen-shell">
    ${header(t)}
    <section class="fullscreen-error" role="alert">
      <div class="astronaut" aria-hidden="true"></div>
      <h1>${esc(t(expired ? 'expiredTitle' : 'fullscreenErrorTitle'))}</h1>
      <p>${esc(t(expired ? 'expiredText' : 'fullscreenErrorText'))}</p>
    </section>
  </div>`;
}
