import type { PopupState } from '../state';
import { icon } from '../../ui/icons';
import { button, circle, esc, field, header, heading, type Text } from '../../ui/markup';
import { architectureName, architectureSelect } from '../components/architecture-select';
import { credentials } from '../components/credentials';
import { pageList } from '../components/page-list';
import { tagPicker } from '../components/tag-picker';
export function editorView(state: Extract<PopupState,{kind:'ready'}>,t:Text):string {
  const d=state.draft;
  let host=t('currentPage');
  try { if(state.sourceOrigin)host=new URL(state.sourceOrigin).host; } catch { /* source is only a display hint */ }
  return `<div class="shell editor">${header(t,circle(t('refresh'),'refresh','arrows-clockwise'))}<div class="page-heading"><h1 tabindex="-1">${t('editTitle')}</h1></div><div class="site-source" data-site-context><div class="source-address">${icon('globe-simple')}<strong title="${esc(host)}">${esc(host)}</strong></div><span class="tag">${esc(architectureName(d.architecture,t))}</span></div><form id="site-form" novalidate class="panel editor-panel">
  <section>${heading(t('siteInfo'),'globe-simple')}${architectureSelect(d.architecture,t)}${field(t,'site-name',t('name'),d.name,'name',{required:true,count:true})}${field(t,'site-address',t('address'),d.address,'address',{required:true})}${field(t,'user-agent',t('ua'),d.userAgent,'userAgent')}<label class="switch-row" for="import-user-agent"><span>${t('importUa')}</span><input type="checkbox" role="switch" id="import-user-agent" data-field="importUserAgent" ${d.importUserAgent?'checked':''}><span class="switch-track" aria-hidden="true"></span></label></section>
  <section class="sensitive-panel">${heading(t('credentials'),'lock')}${credentials(d,t)}</section>
  <section id="pages" tabindex="-1">${heading(t('pages'),'folder',t('pageCount',{count:d.pages.length,limit:50}))}<div class="page-actions">${button(t('addCurrent'),'add-current-page','plus-circle','dashed')}${button(t('addManual'),'add-manual-page','plus-circle','dashed')}</div><div class="page-list">${pageList(d,t)}</div><span id="error-pages" class="sr-only" data-field-error="pages"></span><span class="sr-only" data-page-action-error></span></section>
  <section class="advanced">${heading(t('advanced'),'gear-six')}${tagPicker(d.tags,t)}${field(t,'download-tags',t('downloadTags'),d.downloadTags,'downloadTags',{placeholder:t('downloadHint')})}</section></form>
  <footer class="action-dock"><div class="dock-status"><button type="button" class="error-link" data-action="locate" hidden>${icon('warning-circle')}<span>${t('complete')}</span>${icon('caret-right')}</button><span data-ready-status>${icon('check-circle')}${t('ready')}</span></div><span id="error-payload" class="sr-only" data-field-error="payload"></span>${button(t('generate'),'generate','qr-code')}</footer></div>`;
}
