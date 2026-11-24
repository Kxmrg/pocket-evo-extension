import { collectSiteDraft } from '../application/collect-site';
import {
  getActivePageContext, readCookies, readPageSnapshot, requestCurrentOrigin,
} from '../browser/chrome-gateway';
import { openFullscreenQr } from '../browser/fullscreen-qr';
import { resolveLocale } from '../ui/locales';
import { createPopupController } from './controller';
import { createPopupView } from './view';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Popup root is missing');

const view = createPopupView(root, resolveLocale(navigator.languages));
const controller = createPopupController({
  getActivePageContext, collectSiteDraft, readPageSnapshot, readCookies, requestCurrentOrigin, openFullscreenQr,
}, view);
controller.start();
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
