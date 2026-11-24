import { icon, type IconName } from './icons';
import type { createText } from './locales';
export type Text = ReturnType<typeof createText>;
export const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function button(label: string, action: string, glyph?: IconName, variant = 'primary', extra = ''): string {
  return `<button type="button" class="button ${variant}" data-action="${esc(action)}" ${extra}>${glyph ? icon(glyph) : ''}<span>${esc(label)}</span></button>`;
}
export const circle = (label: string, action: string, glyph: IconName): string => `<button type="button" class="circle-button" data-action="${esc(action)}" aria-label="${esc(label)}" title="${esc(label)}">${icon(glyph)}</button>`;
export const header = (t: Text, action = ''): string => `<header class="app-header"><div class="brand"><img src="/branding/ring-a.png" alt="" width="38" height="38"><div><strong>Pocket Evo</strong><span>${t('app')}</span></div></div>${action}</header>`;
export const heading = (title: string, glyph: IconName, meta = ''): string => `<div class="section-heading">${icon(glyph)}<h2>${esc(title)}</h2>${meta ? `<span class="section-meta">${esc(meta)}</span>` : ''}</div>`;
export function privacy(t: Text, context: 'home' | 'qr' = 'qr'): string {
  const warning = `<p>${t('privacyText')}</p>`;
  if (context === 'home') {
    return `<aside class="privacy">${icon('shield-check')}
      <div><strong>${t('privacyTitle')}</strong><p>${t('privacyLocal')}</p>${warning}</div>
    </aside>`;
  }
  return `<aside class="privacy compact">${icon('shield-check')}${warning}</aside>`;
}
export function field(t: Text, id: string, label: string, value: unknown, key: string, options: {required?: boolean; secret?: boolean; hint?: string; placeholder?: string; count?: boolean; extra?: string} = {}): string {
  return `<div class="field"><div class="field-label"><label for="${id}">${esc(label)}${options.required ? '<span class="required" aria-hidden="true"> *</span>' : ''}</label>${options.count ? `<span class="counter" data-name-count>${t('nameCount', {count: [...String(value ?? '')].length, limit: 20})}</span>` : !options.required ? `<span>${t('optional')}</span>` : ''}</div>
  <div class="input-wrap"><input id="${id}" ${options.extra ?? `data-field="${key}"`} type="${options.secret ? 'password' : 'text'}" value="${esc(value)}" placeholder="${esc(options.placeholder)}" ${options.required ? 'required' : ''} aria-invalid="false" aria-describedby="error-${id} warning-${id}${options.hint ? ` help-${id}` : ''}" autocomplete="off" spellcheck="false">${options.secret ? `<button type="button" class="secret-toggle" data-reveal="${key}" data-label="${esc(label)}" aria-label="${esc(t('showField', {field:label}))}" aria-pressed="false">${icon('eye-slash')}<span>${t('show')}</span></button>` : ''}</div>
  ${options.hint ? `<p class="helper" id="help-${id}">${esc(options.hint)}</p>` : ''}<span class="sr-only" id="error-${id}" data-field-error="${key}"></span><p class="helper field-warning" id="warning-${id}" data-field-warning="${key}" hidden></p></div>`;
}
