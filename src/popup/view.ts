import { usesHxptWebSession } from '../domain/hxpt';
import type { SiteDraft } from '../domain/adapt-site';
import type { ImportIssue } from '../domain/import-issue';
import { splitTags } from '../domain/site-tags';
import { createText, type Locale } from '../ui/locales';
import { issueText } from '../ui/issue-text';
import { icon, type IconName } from '../ui/icons';
import { spinner } from '../ui/spinner';
import { mountIllustration } from '../ui/illustration';
import { createToast } from '../ui/toast';
import { drawQrCanvas } from '../ui/qr-canvas';
import type { PopupState,PopupActions,PopupView } from './state';
import { homeView } from './views/home';
import { editorView } from './views/editor';
import { qrView } from './views/qr';
import { statusView } from './views/status';
import { bindPopup } from './bindings';
import { pageList } from './components/page-list';
import { createRereadDialog } from './components/reread-dialog';

function issueTarget(key:string,issue:ImportIssue):string {
  if(key==='pages'&&issue.index!==undefined)return `page-${['pageNameRequired','pageNameTooLong','pageNameDuplicate'].includes(issue.code)?'name':'path'}-${issue.index}`;
  return ({name:'site-name',address:'site-address',userAgent:'user-agent',tags:'site-tags',downloadTags:'download-tags'} as Record<string,string>)[key]??key;
}
function setBusy(root:HTMLElement,action:string,busy:boolean,disabled:boolean,glyph:IconName):void {
  const button=root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);if(!button)return;
  button.disabled=disabled||busy;
  if(button.getAttribute('aria-busy')===String(busy))return;
  button.setAttribute('aria-busy',String(busy));
  const current=button.querySelector('.icon,.evo-spinner');if(current)current.outerHTML=busy?spinner():icon(glyph);
}

export function createPopupView(root:HTMLElement,locale:Locale):PopupView {
  const t=createText(locale);
  const content=document.createElement('div'),feedback=document.createElement('div');
  root.replaceChildren(content,feedback);
  const toast=createToast(feedback),dialog=createRereadDialog(root,t);
  let current:PopupState|undefined,actions:PopupActions,disposed=false,composing=false,cleanupArt=()=>{};
  const compositionStart=()=>{composing=true;},compositionEnd=()=>{composing=false;};
  content.addEventListener('compositionstart',compositionStart);content.addEventListener('compositionend',compositionEnd);
  document.documentElement.lang=locale;document.title=`Pocket Evo · ${t('app')}`;
  const errorsById=():Map<string,ImportIssue>=>new Map(current?.kind==='ready'?Object.entries(current.errors).map(([key,issue])=>[issueTarget(key,issue),issue]):[]);
  const showIssue=(id:string)=>{const issue=errorsById().get(id);if(issue)toast.show(issueText(issue,locale));};
  const locate=()=>{
    const entries=errorsById();
    const ordered=[...content.querySelectorAll<HTMLElement>('#architecture,input,#pages,#error-payload')].map(node=>node.id==='error-payload'?'payload':node.id);
    const idFirst=ordered.find(id=>entries.has(id));
    const first=idFirst?[idFirst,entries.get(idFirst)!] as const:entries.entries().next().value;if(!first)return;
    const [id,issue]=first;
    const target=id==='payload'?'#pages':id==='pages'&&current?.kind==='ready'&&!current.draft.pages.length?'[data-action=add-manual-page]':`#${id}`;
    content.querySelector<HTMLElement>(target)?.focus();
    toast.show(issueText(issue,locale));
  };
  const unbind=bindPopup(content,()=>actions,locate,showIssue);
  function patchReady(state:Extract<PopupState,{kind:'ready'}>):void {
    const byId=errorsById();
    for(const input of content.querySelectorAll<HTMLInputElement>('input')){
      const key=input.dataset.field;
      const value=key?state.draft[key as keyof SiteDraft]:state.draft.pages[Number(input.dataset.pageIndex)]?.[input.dataset.pageField as 'name'|'path'];
      if(input.type==='checkbox')input.checked=Boolean(value);
      else if(input.value!==String(value??''))input.value=String(value??'');
      input.setAttribute('aria-invalid',String(byId.has(input.id)));
    }
    content.querySelector('#architecture')?.setAttribute('aria-invalid',String(Boolean(state.errors.architecture)));
    content.querySelector('#pages')?.setAttribute('aria-describedby','error-pages');
    for(const error of content.querySelectorAll<HTMLElement>('[data-field-error]')){
      const id=error.id.replace(/^error-/,'');const issue=byId.get(id);
      error.textContent=issue?issueText(issue,locale):'';
    }
    for(const message of content.querySelectorAll<HTMLElement>('[data-field-warning]')){
      const key=message.dataset.fieldWarning!;const warning=state.draft.fieldWarnings[key];
      message.textContent=warning?issueText(warning,locale):'';message.hidden=!warning||Boolean(state.errors[key]);
    }
    for(const reveal of content.querySelectorAll<HTMLButtonElement>('[data-reveal]')){
      const key=reveal.dataset.reveal!,show=state.revealed.has(key),input=content.querySelector<HTMLInputElement>(`#${key}`);
      if(input&&input.type!==(show?'text':'password'))input.type=show?'text':'password';
      if(reveal.getAttribute('aria-pressed')!==String(show))reveal.innerHTML=icon(show?'eye':'eye-slash')+`<span>${t(show?'hide':'show')}</span>`;
      reveal.setAttribute('aria-pressed',String(show));reveal.setAttribute('aria-label',t(show?'hideField':'showField',{field:reveal.dataset.label??key}));
    }
    const selected=new Set(splitTags(state.draft.tags));
    for(const tag of content.querySelectorAll<HTMLElement>('[data-tag-toggle]'))tag.setAttribute('aria-pressed',String(selected.has(tag.dataset.tagToggle!)));
    const count=content.querySelector('[data-name-count]');if(count)count.textContent=t('nameCount',{count:[...state.draft.name].length,limit:20});
    const invalid=Object.keys(state.errors).length>0;
    const locator=content.querySelector<HTMLElement>('[data-action=locate]')!;locator.hidden=!invalid;
    locator.querySelector('span')!.textContent=state.errors.payload?issueText(state.errors.payload,locale):t('complete');
    content.querySelector<HTMLElement>('[data-ready-status]')!.hidden=invalid;
    const pageError=content.querySelector<HTMLElement>('[data-page-action-error]');if(pageError)pageError.textContent=state.pageActionError?issueText(state.pageActionError,locale):'';
    setBusy(content,'add-current-page',!!state.addingPage,state.draft.pages.length>=50,'plus-circle');
    setBusy(content,'add-manual-page',false,!!state.addingPage||state.draft.pages.length>=50,'plus-circle');
    setBusy(content,'generate',false,invalid||!!state.addingPage,'qr-code');
  }
  return {
    render(state,nextActions){
      if(disposed)return;actions=nextActions;
      const previous=current;
      const stable=state.kind==='ready'&&previous?.kind==='ready'&&state.draft.architecture===previous.draft.architecture&&
        usesHxptWebSession(state.draft.architecture,state.draft.address)===usesHxptWebSession(previous.draft.architecture,previous.draft.address)||state.kind==='qr'&&previous?.kind==='qr'&&state.payload.text===previous.payload.text;
      current=state;
      if(stable&&state.kind==='ready'&&previous?.kind==='ready'&&state.draft.pages.length!==previous.draft.pages.length){
        const list=content.querySelector<HTMLElement>('.page-list')!;
        if(state.draft.pages.length>previous.draft.pages.length&&previous.draft.pages.length){
          const template=document.createElement('template');template.innerHTML=pageList(state.draft,t);
          for(const row of [...template.content.children].slice(previous.draft.pages.length))list.append(row);
        }else list.innerHTML=pageList(state.draft,t);
        content.querySelector('#pages .section-meta')!.textContent=t('pageCount',{count:state.draft.pages.length,limit:50});
      }
      if(!stable){
        const active=document.activeElement as HTMLInputElement|null;
        const focus=active&&content.contains(active)?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
        cleanupArt();dialog.dispose();
        content.innerHTML=state.kind==='idle'?homeView(t):state.kind==='ready'?editorView(state,t):state.kind==='qr'?qrView(state,t):statusView(state,t,locale);
        const art=content.querySelector<HTMLElement>('.astronaut');cleanupArt=art?mountIllustration(art):()=>{};
        if(previous?.kind===state.kind&&focus?.id){const input=content.querySelector<HTMLInputElement>(`#${focus.id}`);input?.focus({preventScroll:true});if(input&&focus.start!==null&&['text','password'].includes(input.type))input.setSelectionRange(focus.start,focus.end);}
        else if(previous){
          document.documentElement.scrollTop=0;document.body.scrollTop=0;
          content.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});
        }
      }
      feedback.style.setProperty('--toast-bottom',state.kind==='ready'?'110px':'16px');
      if(state.kind==='ready'){
        patchReady(state);
        if(state.pageActionError&&state.pageActionError!==(previous?.kind==='ready'?previous.pageActionError:undefined))toast.show(issueText(state.pageActionError,locale));
        if(state.errors.payload&&state.errors.payload!==(previous?.kind==='ready'?previous.errors.payload:undefined))toast.show(issueText(state.errors.payload,locale));
      }
      if(state.kind==='qr'){
        const failed=state.error?.code==='qrDrawFailed';
        content.querySelector<HTMLElement>('.qr-image')!.hidden=failed;
        content.querySelector<HTMLElement>('.qr-failure')!.hidden=!failed;
        content.querySelector<HTMLElement>('[data-qr-error]')!.textContent=state.error?issueText(state.error,locale):'';
        setBusy(content,'fullscreen',!!state.openingFullscreen,failed,'arrows-out');
        if(state.error&&state.error!==(previous?.kind==='qr'?previous.error:undefined))toast.show(issueText(state.error,locale));
      }
    },
    async drawQr(payload){
      const canvas=content.querySelector<HTMLCanvasElement>('#qr-canvas');if(!canvas||disposed)return;
      await drawQrCanvas(canvas,payload.text,512);
      canvas.style.removeProperty('width');canvas.style.removeProperty('height');
    },
    focusPage(index){if(composing||root.querySelector('dialog[open]'))return;content.querySelector<HTMLInputElement>(`#page-name-${index}`)?.focus();},
    confirmRefresh(){return dialog.open();},
    dispose(){if(disposed)return;disposed=true;unbind();content.removeEventListener('compositionstart',compositionStart);content.removeEventListener('compositionend',compositionEnd);cleanupArt();dialog.dispose();toast.dispose();current=undefined;root.replaceChildren();},
  };
}
