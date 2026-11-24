import { SITE_TAGS } from '../../domain/site-tags';
import { icon } from '../../ui/icons';
import { esc, type Text } from '../../ui/markup';
export function tagPicker(value: string|null,t: Text): string {
  return `<div class="field tag-field"><div class="field-label"><label for="site-tags">${t('tags')}</label><span>${t('optional')}</span></div><div class="tag-presets">${SITE_TAGS.map(tag => `<button type="button" class="tag-preset" data-tag-toggle="${tag}" aria-pressed="false">${icon('check')}<span>${tag}</span></button>`).join('')}</div><input id="site-tags" data-field="tags" value="${esc(value)}" placeholder="${t('tagsPlaceholder')}" autocomplete="off" aria-describedby="help-site-tags error-site-tags"><p class="helper" id="help-site-tags">${t('tagHint')}</p><span class="sr-only" id="error-site-tags" data-field-error="tags"></span></div>`;
}
