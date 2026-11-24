import type { SiteDraft } from '../../domain/adapt-site';
import { icon } from '../../ui/icons';
import { esc, field, type Text } from '../../ui/markup';
export function pageList(draft: SiteDraft,t: Text): string {
  return draft.pages.length ? draft.pages.map((page,index) => `<article class="page-row"><div class="page-row-header" data-page-title="${index}"><strong>${t('page')} <span class="page-number">${String(index+1).padStart(2,'0')}</span></strong><button type="button" class="circle-button remove-page" data-page-remove="${index}" aria-label="${esc(t('removePage',{index:index+1}))}">${icon('trash')}</button></div>${field(t,`page-name-${index}`,t('pageName'),page.name,`page-name-${index}`,{required:true,placeholder:t('emptyName'),extra:`data-page-field="name" data-page-index="${index}"`})}${field(t,`page-path-${index}`,t('pagePath'),page.path,`page-path-${index}`,{required:true,placeholder:'/torrents.php',extra:`data-page-field="path" data-page-index="${index}"`})}</article>`).join('') : `<div class="empty-pages">${icon('folder')}<strong>${t('emptyPages')}</strong></div>`;
}
