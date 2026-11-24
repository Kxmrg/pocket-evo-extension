import pencilSimple from './icon-assets/pencil-simple.svg?raw';
import list from './icon-assets/list.svg?raw';
import globeSimple from './icon-assets/globe-simple.svg?raw';
import qrCode from './icon-assets/qr-code.svg?raw';
import shieldCheck from './icon-assets/shield-check.svg?raw';
import arrowsClockwise from './icon-assets/arrows-clockwise.svg?raw';
import plusCircle from './icon-assets/plus-circle.svg?raw';
import trash from './icon-assets/trash.svg?raw';
import caretDown from './icon-assets/caret-down.svg?raw';
import caretRight from './icon-assets/caret-right.svg?raw';
import lock from './icon-assets/lock.svg?raw';
import lockOpen from './icon-assets/lock-open.svg?raw';
import eye from './icon-assets/eye.svg?raw';
import eyeSlash from './icon-assets/eye-slash.svg?raw';
import check from './icon-assets/check.svg?raw';
import checkCircle from './icon-assets/check-circle.svg?raw';
import warningCircle from './icon-assets/warning-circle.svg?raw';
import info from './icon-assets/info.svg?raw';
import tag from './icon-assets/tag.svg?raw';
import folder from './icon-assets/folder.svg?raw';
import deviceMobile from './icon-assets/device-mobile.svg?raw';
import browser from './icon-assets/browser.svg?raw';
import gearSix from './icon-assets/gear-six.svg?raw';
import palette from './icon-assets/palette.svg?raw';
import x from './icon-assets/x.svg?raw';
import arrowsOut from './icon-assets/arrows-out.svg?raw';
import fileText from './icon-assets/file-text.svg?raw';
import arrowDown from './icon-assets/arrow-down.svg?raw';
import arrowSquareOut from './icon-assets/arrow-square-out.svg?raw';

const icons = {
  'pencil-simple': pencilSimple,
  'list': list,
  'globe-simple': globeSimple,
  'qr-code': qrCode,
  'shield-check': shieldCheck,
  'arrows-clockwise': arrowsClockwise,
  'plus-circle': plusCircle,
  'trash': trash,
  'caret-down': caretDown,
  'caret-right': caretRight,
  'lock': lock,
  'lock-open': lockOpen,
  'eye': eye,
  'eye-slash': eyeSlash,
  'check': check,
  'check-circle': checkCircle,
  'warning-circle': warningCircle,
  'info': info,
  'tag': tag,
  'folder': folder,
  'device-mobile': deviceMobile,
  'browser-pointer': browser,
  'gear-six': gearSix,
  'palette': palette,
  'x': x,
  'arrows-out': arrowsOut,
  'file-text': fileText,
  'arrow-down': arrowDown,
  'arrow-square-out': arrowSquareOut,
};

export type IconName = keyof typeof icons;

const attributeEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** The control or adjacent text supplies the accessible name. */
export function icon(name: IconName, extraClass = ''): string {
  if (!Object.hasOwn(icons, name)) throw new RangeError(`Unknown icon: ${name}`);
  const classes = ['icon', extraClass].filter(Boolean).join(' ')
    .replace(/[&<>"']/g, (character) => attributeEntities[character]!);
  return icons[name].trim().replace('<svg ', `<svg class="${classes}" aria-hidden="true" focusable="false" `);
}
