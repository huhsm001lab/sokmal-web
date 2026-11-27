(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function h(tag,props,...kids){const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.slice(2),v);else if(v===true)e.setAttribute(k,'');else if(v!==false&&v!=null)e.setAttribute(k,v);}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)));}return e;}
const S={sample:null,canImages:false,maxImages:3,imageText:'',imageKw:[]};
const G={};
const KINDS=['인물','배경','사건','소재','떡밥','분위기','독백','분석','이미지','설계','메모'];

/* ---------- 토스트 ---------- */
let toastEl=null,toastT=null;
function toast(msg){if(toastEl)toastEl.remove();toastEl=h('div',{class:'toast',role:'status'},msg);document.body.append(toastEl);clearTimeout(toastT);toastT=setTimeout(()=>{toastEl&&toastEl.remove();toastEl=null},2600);}
function copyText(t){const p=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject();p.then(()=>toast('복사했어요'),()=>toast('복사가 막혀 있어요. 글자를 길게 눌러 직접 선택해 주세요'));}

/* ---------- 칩 그룹 ---------- */
function initChips(host){
  const multi=host.dataset.multi==='1';const max=+host.dataset.max||0;
  const opts=(host.dataset.options||'').split(',').filter(Boolean);
  const defs=(host.dataset.default||'').split(',').filter(Boolean);
  const sel=new Set();const subs=[];
  const row=h('div',{class:'chip-row'});
  const inp=h('input',{type:'text',placeholder:'직접 쓰기',maxlength:'30'});
  const custom=h('div',{class:'custom',hidden:true},inp,h('button',{type:'button',class:'btn small',onclick:commit},'추가'));
  const plus=h('button',{type:'button',class:'chip plus',onclick:()=>{custom.hidden=!custom.hidden;if(!custom.hidden)inp.focus();}},'＋ 직접 쓰기');
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();}});
  function fire(){subs.forEach(f=>f([...sel]));}
  function setOn(b,on){const l=b.dataset.label;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');if(on)sel.add(l);else sel.delete(l);}
  function find(l){return [...row.querySelectorAll('.chip:not(.plus)')].find(b=>b.dataset.label===l);}
  function mk(l){const b=h('button',{type:'button',class:'chip','aria-pressed':'false','data-label':l},l);b.addEventListener('click',()=>{const on=!sel.has(l);if(!multi&&on)$$('.chip.on',row).forEach(x=>setOn(x,false));if(multi&&on&&max&&sel.size>=max){const first=find([...sel][0]);if(first)setOn(first,false);toast(max+'개까지 고를 수 있어요. 먼저 고른 걸 뺐어요');}setOn(b,on);fire();});row.insertBefore(b,plus);return b;}
  function add(l,on=true){l=String(l).trim();if(!l)return;let b=find(l)||mk(l);if(on){if(!multi)$$('.chip.on',row).forEach(x=>{if(x!==b)setOn(x,false)});if(multi&&max&&!sel.has(l)&&sel.size>=max){const first=find([...sel][0]);if(first)setOn(first,false);}setOn(b,true);}fire();}
  function commit(){const v=inp.value.trim();if(!v)return;add(v,true);inp.value='';}
  row.append(plus);opts.forEach(mk);defs.forEach(d=>{const b=find(d);if(b)setOn(b,true)});
  host.replaceChildren(row,custom);
  const api={get:()=>[...sel],add,set(list){$$('.chip.on',row).forEach(x=>setOn(x,false));(list||[]).forEach(l=>add(l,true));fire();},clear(){$$('.chip.on',row).forEach(x=>setOn(x,false));fire();},onChange(f){subs.push(f);}};
  G[host.dataset.group]=api;return api;
}
$$('[data-group]').forEach(initChips);

/* ---------- 세그먼트 ---------- */
function seg(el,cb){el.addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b)return;$$('button',el).forEach(x=>x.classList.toggle('on',x===b));cb(b.dataset.v);});}

/* ---------- AI 출력 ---------- */
function renderText(body,text){
  const frag=document.createDocumentFragment();let ul=null;
  for(const raw of String(text).split('\n')){
    const line=raw.replace(/\*\*/g,'').trimEnd();
    if(!line.trim()){ul=null;continue;}
    if(/^\s*\[(메모|설계)\]/.test(line))continue;
    const pm=line.match(/^\s*\[상대\]\s*(.*)$/);if(pm){ul=null;frag.append(h('div',{class:'partner'},h('b',{},'상대'),pm[1]));continue;}
    if(/^#{1,3}\s/.test(line)){ul=null;frag.append(h('h4',{},line.replace(/^#{1,3}\s/,'')));}
    else if(/^\s*[-•·]\s+/.test(line)){if(!ul){ul=h('ul');frag.append(ul);}ul.append(h('li',{},line.replace(/^\s*[-•·]\s+/,'')));}
    else{ul=null;frag.append(h('p',{},line.trim()));}
  }
  body.replaceChildren(frag);
}
function makeOut(host){
  host.replaceChildren();
  const stop=h('button',{type:'button',class:'btn small',hidden:true},'중단');
  const status=h('div',{class:'status'});
  const body=h('div',{class:'out-body'});
  const acts=h('div',{class:'out-acts',hidden:true});
  const extra=h('div');
  const pt=h('div');
  const wrap=h('div',{class:'card',hidden:true},h('div',{class:'out-head'},h('strong',{},'결과'),stop),status,pt,body,acts,extra);
  host.append(wrap);
  const o={text:'',meta:null,
    start(onStop){wrap.hidden=false;body.replaceChildren();pt.replaceChildren();acts.hidden=true;acts.replaceChildren();extra.replaceChildren();status.textContent='생각하는 중… (처음엔 조금 걸려요)';stop.hidden=false;stop.onclick=onStop;wrap.scrollIntoView({behavior:'smooth',block:'start'});},
    set(t){o.text=t;status.textContent='';if(!pt.firstChild&&/^\s*\[상대\]/m.test(t))pt.append(partnerToggle());renderText(body,t);},
    finish(actions,truncated,ctx){stop.hidden=true;status.textContent=truncated?'답이 길어 중간에 끊겼어요. 입력을 줄여서 다시 시도해 보세요.':'';acts.replaceChildren(...actions.map(a=>h('button',{type:'button',class:'btn small'+(a.primary?' primary':''),onclick:a.fn},a.label)));acts.hidden=false;
      if(ctx){const meta=Object.assign({},o.meta||{});const add=meta.extra?meta.extra(ctx.text):null;const chat=meta.chatCfg&&!isMetaReply(ctx.text)?chatBlock(ctx,meta.chatCfg):null;extra.replaceChildren(add||'',h('p',{class:'ai-note'},'AI와 함께 쓴 글이에요. 고르고 고치고 버리는 건 당신의 몫이에요.'),chat?chat.el:'',isMetaReply(ctx.text)?'':fbBlock(meta,()=>chat?chat.turns():0));}},
    fail(msg,keepActions){stop.hidden=true;status.textContent=msg;if(!o.text)body.replaceChildren();}
  };
  return o;
}
function errCopy(e){
  const c=e&&e.code;
  return ({cancelled:'중단했어요.',
    /* 11-26 이식: 서버 AI용 오류 */
    invite_required:'초대 코드가 필요해요. 첫 화면에서 초대 코드를 넣어 주세요.',daily_limit:'오늘 쓸 수 있는 횟수를 모두 썼어요. 내일 다시 열려요.',busy:'지금 AI를 쓰는 사람이 많아요. 조금 뒤에 다시 눌러 주세요.',budget:'이번 달에 쓸 수 있는 AI 사용량이 다 찼어요. 운영자에게 알려 주세요.',not_configured:'AI 설정이 아직 안 됐어요. 운영자에게 알려 주세요.',network:'연결이 끊겼어요. 인터넷 연결을 확인하고 다시 눌러 주세요.',bad_request:'입력을 처리하지 못했어요. 내용을 확인하고 다시 시도해 주세요.',
    not_granted:'이 화면에서는 AI 사용이 허용되지 않았어요.',sampling_disabled:'이 계정에서는 AI를 쓸 수 없어요.',rate_limited:'지금 쓰고 있는 Claude 계정의 AI 사용량이 잠시 다 찼어요. SOKMAL의 하루 횟수와는 별개예요. 조금 뒤에 다시 눌러 주세요.',image_rejected:'이 사진은 읽지 못했어요. 다른 사진으로 해 주세요.',images_unavailable:'이 화면에서는 사진 분석을 쓸 수 없어요.',session_expired:'다시 로그인해 주세요.',refused:'AI가 이 입력은 처리하지 못했어요. 내용을 바꿔서 다시 시도해 주세요.',empty_completion:'답이 비어 있어요. 내용을 조금 더 적고 다시 시도해 주세요.',prompt_too_large:'글이 너무 길어요. 막·장면 단위로 나눠 넣어 주세요.'})[c]||'문제가 생겼어요. 잠시 뒤에 다시 눌러 주세요.';
}
/* 11-26 이식: 프롬프트는 서버가 만든다. 브라우저는 spec(무슨 기능 + 입력값)만 보낸다 */
async function runAI({spec,out,btn,actions,onDone}){
  if(!Api.ready){toast('이 화면에서는 AI 기능을 쓸 수 없어요');return;}
  const ctl=new AbortController();out.start(()=>ctl.abort());btn.disabled=true;
  try{
    const r=await Api.run(spec,{signal:ctl.signal,onText:t=>out.set(t)});
    if(onDone){try{await onDone(r.text);}catch(x){}}out.set(r.text);out.finish(actions(r.text,()=>runAI({spec,out,btn,actions,onDone})),r.truncated,{base:r.base,text:r.text});
  }catch(e){
    if(e&&e.text)out.set(e.text);
    out.fail(errCopy(e));
    if(e&&e.text&&e.code!=='refused')out.finish(actions(e.text,()=>runAI({spec,out,btn,actions})),false);
  }finally{btn.disabled=false;}
}

/* ---------- 설정값 (기획 확정: 숫자는 설정값으로 분리) ---------- */
const LIMITS={
  daily:{exam:5,pro:5,mono:10},   // 해석 학습 하루 사용 횟수(모드별, 계정 단위). 1회 = 요청 하나 + 답 하나. 독백은 모드 합산 10회[기본안]. 실제로 막는 건 서버(lib/limits.ts) — 화면 표시용 값
  maxText:80000,          // 한 번에 받는 본문 글자 수(임시값, 측정 후 조정). 넘으면 나눠 넣도록 안내, 자동 잘라 쓰기 없음
  storageCap:null         // 저장함 보관 총 개수 상한(미정 → null = 제한 없음)
};
const ymd=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
/* ---------- 서버 연결 (11-26 이식: window.claude 대신) ----------
   AI는 /api/ai, 하루 횟수는 /api/usage. 사용자 구분은 app/AuthBridge.tsx가 만든 window.SokmalAuth(익명 로그인 + 이메일 연결) */
const Api={ready:false,auth:null,
  async waitAuth(){for(let i=0;i<200&&!window.SokmalAuth;i++)await new Promise(r=>setTimeout(r,25));return window.SokmalAuth||null;},
  async init(){this.auth=await this.waitAuth();if(this.auth){try{await this.auth.ready;}catch(e){}}const r=await this.usage();this.needInvite=!!(r&&r.error==='invite_required');this.ready=!!(r&&r.ready);this.mock=!!(r&&r.mock);this.examplePrompts=!!(r&&r.examplePrompts);},
  inviteCode(){try{return localStorage.getItem('sokmal.invite')||'';}catch(e){return '';}},
  async headers(){const hd={'content-type':'application/json'};const ic=this.inviteCode();if(ic)hd['x-sokmal-invite']=ic;if(this.auth){try{Object.assign(hd,await this.auth.headers());}catch(e){}}return hd;},
  async usage(){try{const res=await fetch('/api/usage',{headers:await this.headers(),cache:'no-store'});const j=await res.json();if(j&&j.usage)Usage.set(j.usage);return j;}catch(e){return null;}},
  hit(key){this.headers().then(hd=>fetch('/api/usage',{method:'POST',headers:hd,body:JSON.stringify({hit:key})})).then(r=>r.json()).then(j=>{if(j&&j.usage)Usage.set(j.usage);}).catch(()=>{});},
  /* spec을 보내고 글자를 흘려받는다. 반환 {text,truncated,base}. 실패하면 {code,text?}를 던진다(원래 window.claude sample과 같은 모양) */
  async run(spec,o){const {signal,onText}=o||{};let res;
    try{res=await fetch('/api/ai',{method:'POST',headers:await this.headers(),body:JSON.stringify(spec),signal});}
    catch(e){throw {code:signal&&signal.aborted?'cancelled':'network'};}
    if(!res.ok||!res.body){let j={};try{j=await res.json();}catch(x){}if(j&&j.usage)Usage.set(j.usage);throw {code:(j&&j.error)||'error',key:j&&j.key};}
    const rd=res.body.getReader();const dec=new TextDecoder();let buf='',text='',done=null,err=null;
    try{for(;;){const r=await rd.read();if(r.done)break;buf+=dec.decode(r.value,{stream:true});let i;
      while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;let m;try{m=JSON.parse(line);}catch(x){continue;}
        if(m.t!=null){text+=m.t;if(onText)onText(text);}else if(m.done)done=m;else if(m.error)err=m;}}}
    catch(e){throw {code:signal&&signal.aborted?'cancelled':'network',text:text||undefined};}
    if(err){if(err.error==='refused'){if(onText)onText('');throw {code:'refused'};}throw {code:err.error,text:err.text||undefined};}
    if(!done)throw {code:'network',text:text||undefined};
    if(done.usage)Usage.set(done.usage);
    return {text:done.text,truncated:!!done.truncated,base:done.base||null};}
};
/* 오늘 사용 횟수: 서버가 센 값을 받아 보여 주기만 한다 */
const Usage={data:{},set(u){if(u){this.data=u;paintUsage();}}};
/* 의견·후기: 이 기기에 저장하고, 서버(/api/feedback)에도 보내 관리자가 볼 수 있게 (11-27). ref()는 원래 코드와의 호환용 */
const Shared={data:{},KEY:'sokmal.feedback',
  ref(){return true;},
  saveLocal(){try{localStorage.setItem(this.KEY,JSON.stringify(this.data));return true;}catch(e){return false;}},
  load(){try{this.data=JSON.parse(localStorage.getItem(this.KEY)||'{}')||{};}catch(e){this.data={};}paintUsage();
    /* 서버에 있는 내 문서와 합치기(기기를 바꿔도 "의견 2번 뒤 후기 묻기"가 이어지게) */
    Api.headers().then(hd=>fetch('/api/feedback',{headers:hd,cache:'no-store'})).then(r=>r.ok?r.json():null).then(j=>{const d=j&&j.doc;if(!d)return;
      const mine=this.data.entries||[],theirs=d.entries||[];
      if(theirs.length>mine.length)this.data.entries=theirs;
      if(d.review&&!this.data.review)this.data.review=d.review;
      if(d.reviewSkip&&!this.data.reviewSkip)this.data.reviewSkip=d.reviewSkip;
      this.saveLocal();}).catch(()=>{});},
  push(){Api.headers().then(hd=>fetch('/api/feedback',{method:'PUT',headers:hd,body:JSON.stringify(this.data)})).catch(()=>{});},
  mutate(fn){try{fn(this.data);}catch(e){}this.data.updatedAt=Date.now();const ok=this.saveLocal();this.push();paintUsage();return Promise.resolve(ok);}
};
function usedToday(m){const r=Usage.data[m];return r?(r.run||0)+(r.follow||0):0;}
function leftToday(m){return Math.max(0,LIMITS.daily[m]-usedToday(m));}
function useOne(m,kind){return Promise.resolve(true);} /* 서버가 이미 셌음 (오류·[확인]·[모름]은 서버가 돌려줌) */
function paintUsage(){
  const el=$('#a-usage');if(el&&MODE){const l=leftToday(MODE);el.textContent=(MODE==='exam'?'입시':'전문')+' 모드 · 오늘 남은 횟수 '+l+' / '+LIMITS.daily[MODE];el.classList.toggle('out',l===0);}
  const hl=$('#hub-left');if(hl&&MODE)hl.textContent='오늘 '+leftToday(MODE)+'번 남음';
  $$('.chat-left').forEach(x=>{x.textContent='오늘 남은 횟수 '+leftToday(x.dataset.m)+' / '+LIMITS.daily[x.dataset.m];});
}
function gate(m){if(leftToday(m)>0)return true;Api.hit(m);toast(m==='mono'?'오늘은 독백 '+LIMITS.daily.mono+'번을 모두 썼어요. 내일 다시 열려요':'오늘은 '+(m==='exam'?'입시':'전문')+' 모드 '+LIMITS.daily[m]+'번을 모두 썼어요. 내일 다시 열려요');return false;}
const isMetaReply=t=>/^\s*\[(확인|모름)\]/.test(String(t));
function cleanText(t){let x=String(t).replace(/^\s*\[(메모|설계)\].*$/gm,'');x=partnerOn()?x.replace(/^\s*\[상대\]\s*/gm,'  상대: '):x.replace(/^\s*\[상대\].*\n?/gm,'');return x.replace(/\n{3,}/g,'\n\n').trim();}
function partnerOn(){return !document.body.classList.contains('hide-partner');}
function setPartner(on){document.body.classList.toggle('hide-partner',!on);try{localStorage.setItem('sokmal.partner',on?'1':'0');}catch(e){}$$('.ptog input').forEach(x=>{x.checked=on;});}
try{if(localStorage.getItem('sokmal.partner')==='0')document.body.classList.add('hide-partner');}catch(e){}
function partnerToggle(){const cb=h('input',{type:'checkbox'});cb.checked=partnerOn();cb.addEventListener('change',()=>setPartner(cb.checked));return h('label',{class:'ptog'},cb,h('span',{},'상대의 말·반응 보기'));}
function parseMemo(t){const m=String(t).match(/^\s*\[메모\]\s*(.+)$/m);const o={};if(!m)return o;m[1].split(/[｜|]/).forEach(p=>{const i=p.indexOf(':');if(i>0)o[p.slice(0,i).trim()]=p.slice(i+1).trim();});return o;}

/* ---------- 지표 2문항 (첫 10명 테스트용) ---------- */
function choiceRow(opts,onPick){let cur=null;const row=h('div',{class:'chip-row'});opts.forEach(l=>{const b=h('button',{type:'button',class:'chip','aria-pressed':'false'},l);b.addEventListener('click',()=>{cur=l;$$('.chip',row).forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false');});onPick(l);});row.append(b);});return row;}
function saveFeedback(entry){
  entry.at=Date.now();
  if(!Shared.ref())return Promise.resolve(false);
  return Shared.mutate(d=>{d.entries=d.entries||[];if(!d.entries.some(x=>x.at===entry.at))d.entries.push(entry);if(d.entries.length>300)d.entries=d.entries.slice(-300);});
}
function fbBlock(meta,getTurns){
  const st={fit:null,ai:null,newt:null};
  const note=h('input',{type:'text',placeholder:'한 줄 의견 (선택) 예) 끝이 너무 정리돼 있어요',maxlength:'200'});
  const send=h('button',{type:'button',class:'btn small primary',disabled:true},'의견 보내기');
  const upd=()=>{send.disabled=!(st.fit&&st.ai&&st.newt);};
  const box=h('div',{class:'fb'},h('b',{},'이 결과, 어땠나요?'),
    h('div',{class:'q'},'내게 맞았나요?'),choiceRow(['맞았다','애매하다','안 맞았다'],v=>{st.fit=v;upd();}),
    h('div',{class:'q'},'AI가 쓴 것 같았나요?'),choiceRow(['AI 같았다','조금','사람 같았다'],v=>{st.ai=v;upd();}),
    h('div',{class:'q'},'새로운 생각이 났나요?'),choiceRow(['났다','조금','아니다'],v=>{st.newt=v;upd();}),
    note,h('div',{class:'out-acts'},send));
  send.addEventListener('click',async()=>{send.disabled=true;
    const ok=await saveFeedback(Object.assign({},meta,{chatCfg:undefined,extra:undefined,fit:st.fit,aiLike:st.ai,newThought:st.newt,note:note.value.trim().slice(0,200),turns:getTurns(),mode:MODE}));
    if(ok){box.replaceChildren(h('div',{class:'done'},'고마워요. 의견을 받았어요.'));
      const n=(Shared.data.entries||[]).length;if(n>=REVIEW_AFTER&&!Shared.data.review&&!Shared.data.reviewSkip)box.append(reviewBox(()=>{}));}
    else{send.disabled=false;toast('의견을 저장하지 못했어요. 로그인 상태나 권한을 확인해 주세요');}
  });
  return box;
}

/* ---------- 후기 (의견 2번 보낸 뒤 한 번 묻기) ---------- */
const REVIEW_AFTER=2;
const ROLES=['입시생','배우','창작자','감독','연출가','작가','극작가','기타'];
const RV_Q=[
 {k:'career',q:'연기·창작을 한 지는?',o:['준비 중','1년 안','1~3년','3~10년','10년 넘게']},
 {k:'most',q:'가장 많이 쓴 기능은?',o:['해석','독백 만들기','내 이미지','내 기록']},
 {k:'help',q:'가장 도움이 된 점은?',o:['시야가 넓어졌다','시간이 줄었다','내 이야기를 꺼내게 됐다','글이 좋아졌다','별로 없었다']},
 {k:'miss',q:'가장 아쉬운 점은?',o:['AI 티가 난다','흐름이 약하다','정해 주는 느낌','정보가 틀렸다','느리거나 불편하다','딱히 없다']},
 {k:'own',q:'결과가 내 것 같았나요?',o:['내 것 같았다','반반','남의 것 같았다']},
 {k:'again',q:'정식으로 나오면 또 쓸 건가요?',o:['꼭 쓴다','아마 쓴다','모르겠다','안 쓴다']},
 {k:'price',q:'돈을 낸다면 한 달에 얼마까지 괜찮나요?',o:['무료일 때만','5천 원까지','1만 원까지','2만 원까지','그 이상도']},
 {k:'recommend',q:'주변 사람에게 권하겠어요?',o:['꼭 권한다','권할 만하다','글쎄','안 권한다']}];
function reviewBox(onDone,existing){
  const ex=existing||{};const st={role:ex.role||null};
  const etc=h('input',{type:'text',placeholder:'어떤 일을 하는지 적어 주세요',maxlength:'30',value:ex.roleEtc||''});etc.hidden=st.role!=='기타';
  const roles=choiceRow(ROLES,v=>{st.role=v;etc.hidden=v!=='기타';upd();});
  if(st.role)$$('.chip',roles).forEach(b=>{if(b.textContent===st.role){b.classList.add('on');b.setAttribute('aria-pressed','true');}});
  const ans=Object.assign({},ex.answers||{});
  const qs=RV_Q.map(x=>{const row=choiceRow(x.o,v=>{ans[x.k]=v;});if(ans[x.k])$$('.chip',row).forEach(b=>{if(b.textContent===ans[x.k]){b.classList.add('on');b.setAttribute('aria-pressed','true');}});return [h('div',{class:'q'},x.q),row];});
  const ta=h('textarea',{placeholder:'써 보니 어땠는지 편하게 적어 주세요. 좋았던 점도, 아쉬운 점도요',maxlength:'1000'});ta.value=ex.text||'';
  const cons=h('input',{type:'checkbox'});cons.checked=!!ex.consent;
  const send=h('button',{type:'button',class:'btn small primary'},ex.text?'후기 고치기':'후기 보내기');
  const skip=h('button',{type:'button',class:'btn small'},'다음에 할게요');
  const upd=()=>{send.disabled=!(st.role&&ta.value.trim().length>=5&&(st.role!=='기타'||etc.value.trim()));};
  ta.addEventListener('input',upd);etc.addEventListener('input',upd);upd();
  const box=h('div',{class:'rv'},h('b',{},'짧은 후기를 남겨 줄 수 있나요?'),
    h('div',{class:'adm-leg'},'이름은 받지 않아요. 어떤 일을 하는지만 골라 주세요.'),
    roles,etc,h('div',{class:'adm-leg',style:'margin-top:8px'},'아래는 고를 수 있는 만큼만 골라 주세요.'),...qs.flat(),h('div',{class:'q'},'한 줄 후기'),ta,
    h('label',{class:'ck'},cons,h('span',{},'소개 페이지에 이 후기를 실어도 괜찮아요 (고른 일만 함께 표시, 이름 없음)')),
    h('div',{class:'out-acts'},send,existing?null:skip));
  send.addEventListener('click',async()=>{send.disabled=true;
    const rv={answers:ans,text:ta.value.trim().slice(0,1000),role:st.role,roleEtc:st.role==='기타'?etc.value.trim().slice(0,30):'',consent:cons.checked,at:Date.now()};
    const ok=await Shared.mutate(d=>{d.review=rv;});
    if(ok){box.replaceChildren(h('div',{class:'done'},'후기 고마워요. 서비스를 고치는 데 그대로 쓸게요.'));onDone&&onDone();}
    else{send.disabled=false;toast('후기를 저장하지 못했어요. 로그인 상태나 권한을 확인해 주세요');}});
  skip.addEventListener('click',()=>{Shared.mutate(d=>{d.reviewSkip=Date.now();});box.remove();});
  return box;
}
function paintAboutReview(){const host=$('#about-review');if(!host)return;
  if(!Shared.ref()){host.replaceChildren();return;}
  const ex=Shared.data.review;
  const open=h('button',{type:'button',class:'btn'},ex?'내 후기 고치기':'후기 남기기');
  open.addEventListener('click',()=>{host.replaceChildren(h('div',{class:'card'},reviewBox(()=>{},ex||null)));});
  host.replaceChildren(h('div',{class:'card'},h('b',{},'써 본 후기'),h('p',{style:'margin:6px 0 10px;font-size:14px;color:#2D3748'},ex?'보내 준 후기가 있어요. 언제든 고칠 수 있어요.':'언제든 남길 수 있어요. 의견을 두 번 보내면 한 번 여쭤볼게요.'),open));}

/* ---------- 관리자 (편집 권한자만: feedback 모아 보기 + 후기 승인) ---------- */
const Admin={on:false,docs:[],appr:{},unsub:null,
  /* 11-26 이식: 관리자 화면은 3단계(저장함·지표·후기 서버 이식)에서 운영자 권한과 함께 다시 연다. 그때까지 숨김 */
  async check(){this.on=false;$('#hub-admin').hidden=true;},
  open(){const body=$('#adm-body');
    if(!this.on||!Store.db){body.replaceChildren(h('div',{class:'note warn'},'관리자만 볼 수 있어요.'));return;}
    if(this.unsub)return this.render();
    const timer=setTimeout(()=>{if(!this.docs.length)body.replaceChildren(h('div',{class:'note warn'},'불러오는 데 시간이 걸려요. 잠시 뒤 다시 열어 주세요.'));},10000);
    try{this.unsub=Store.db.collection('feedback').onSnapshot(sn=>{clearTimeout(timer);this.docs=sn.docs.map(d=>Object.assign({_id:d.id},d.data()||{}));this.render();},()=>{clearTimeout(timer);body.replaceChildren(h('div',{class:'note warn'},'기록을 읽을 권한이 없어요.'));});}catch(e){body.replaceChildren(h('div',{class:'note warn'},'기록을 불러오지 못했어요.'));}
    Store.db.doc('admin/reviews').get().then(sn=>{this.appr=(sn.exists&&(sn.data()||{}).approved)||{};this.render();}).catch(()=>{});},
  async approve(id,v){this.appr[id]=v;this.render();try{await Store.db.doc('admin/reviews').set({approved:this.appr,updatedAt:Date.now()});toast(v?'랜딩에 쓸 후기로 표시했어요':'표시를 뺐어요');}catch(e){toast('저장하지 못했어요');}},
  stat(d){const u=d.usage||{};const days=Object.keys(u).sort();let run=0,follow=0,hits=0;const by={exam:0,pro:0};
    days.forEach(k=>['exam','pro'].forEach(m=>{const r=u[k][m];if(r){run+=r.run||0;follow+=r.follow||0;hits+=r.hits||0;by[m]+=(r.run||0)+(r.follow||0);}}));
    const en=d.entries||[];const ats=en.map(e=>e.at).filter(Boolean);
    const first=days[0]||(ats.length?ymdOf(Math.min(...ats)):'');const last=days[days.length-1]||(ats.length?ymdOf(Math.max(...ats)):'');
    return {run,follow,hits,by,days:days.length,first,last,fb:en.length};},
  render(){const body=$('#adm-body');if(!body||!this.docs)return;
    const ds=this.docs.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const label=d=>'테스터 '+d._id.slice(-4);
    const all=ds.flatMap(d=>(d.entries||[]).map(e=>Object.assign({_who:label(d)},e)));
    const rvs=ds.filter(d=>d.review&&d.review.text);
    const tot=ds.reduce((a,d)=>{const s=this.stat(d);a.run+=s.run+s.follow;a.hits+=s.hits;return a;},{run:0,hits:0});
    const stats=h('div',{class:'adm-stats'},
      h('div',{},h('b',{},ds.length),h('span',{},'참여한 테스터')),
      h('div',{},h('b',{},tot.run),h('span',{},'AI 사용 (해석·더 묻기)')),
      h('div',{},h('b',{},all.length),h('span',{},'보낸 의견')),
      h('div',{},h('b',{},rvs.length),h('span',{},'후기 (실어도 됨 '+rvs.filter(d=>d.review.consent).length+')')));
    const COL=['#2F4A7A','#8FA3C4','#D9DEE7'];
    const bar=(q,key,opts)=>{const c=opts.map(o=>all.filter(e=>e[key]===o).length);const n=c.reduce((a,b)=>a+b,0);
      return h('div',{class:'adm-q'},h('div',{},q+' ',h('span',{class:'adm-leg'},'('+n+'건)')),
        h('div',{class:'adm-bar'},...c.map((v,i)=>{const e=h('i');e.style.width=(n?v/n*100:0)+'%';e.style.background=COL[i];return e;})),
        h('div',{class:'adm-leg'},opts.map((o,i)=>o+' '+c[i]).join(' · ')));};
    const byFeat={};all.forEach(e=>{const k=(e.feature||'기타')+(e.mode?' · '+(e.mode==='exam'?'입시':'전문'):'');byFeat[k]=(byFeat[k]||0)+1;});
    const ind=h('div',{class:'card'},h('h3',{},'지표'),
      bar('내게 맞았나요?','fit',['맞았다','애매하다','안 맞았다']),
      bar('AI가 쓴 것 같았나요?','aiLike',['사람 같았다','조금','AI 같았다']),
      bar('새로운 생각이 났나요?','newThought',['났다','조금','아니다']),
      h('div',{class:'adm-leg',style:'margin-top:10px'},'기능별 의견 수: '+(Object.entries(byFeat).map(([k,v])=>k+' '+v).join(' · ')||'아직 없음')));
    const rvAll=rvs.map(d=>d.review.answers||{});
    const rbar=x=>{const c=x.o.map(o=>rvAll.filter(a=>a[x.k]===o).length);const n=c.reduce((a,b)=>a+b,0);
      return h('div',{class:'adm-q'},h('div',{},x.q+' ',h('span',{class:'adm-leg'},'('+n+'명)')),
        h('div',{class:'adm-bar'},...c.map((v,i)=>{const e=h('i');e.style.width=(n?v/n*100:0)+'%';e.style.background=['#1F3A5F','#2F4A7A','#5B76A3','#8FA3C4','#BCC8DC','#D9DEE7'][i];return e;})),
        h('div',{class:'adm-leg'},x.o.map((o,i)=>o+' '+c[i]).join(' · ')));};
    const roleCnt={};rvs.forEach(d=>{const r=d.review.role==='기타'?(d.review.roleEtc||'기타'):d.review.role;roleCnt[r]=(roleCnt[r]||0)+1;});
    const sv=h('div',{class:'card'},h('h3',{},'후기 설문'),
      rvs.length?h('div',{class:'adm-leg'},'하는 일: '+Object.entries(roleCnt).map(([k,v])=>k+' '+v).join(' · ')):h('div',{class:'adm-leg'},'아직 없어요.'),
      ...(rvs.length?RV_Q.map(rbar):[]));
    const rvCard=h('div',{class:'card'},h('h3',{},'후기'),
      rvs.length?null:h('div',{class:'adm-leg'},'아직 받은 후기가 없어요. 의견을 '+REVIEW_AFTER+'번 보낸 테스터에게 한 번 물어봐요.'),
      ...rvs.sort((a,b)=>b.review.at-a.review.at).map(d=>{const r=d.review;const ok=!!this.appr[d._id];
        const btn=h('button',{type:'button',class:'btn small'+(ok?'':' primary'),disabled:!r.consent},ok?'랜딩 표시 빼기':'랜딩에 쓸 후기로 표시');
        btn.addEventListener('click',()=>this.approve(d._id,!ok));
        return h('div',{class:'adm-rv'},
          h('div',{},h('span',{class:'tag'},r.role==='기타'?(r.roleEtc||'기타'):r.role),r.consent?h('span',{class:'tag ok'},'실어도 됨'):h('span',{class:'tag'},'내부용만'),ok?h('span',{class:'tag ok'},'랜딩 후보'):null),
          h('p',{},r.text),h('div',{class:'adm-leg'},label(d)+' · '+ymdOf(r.at)),h('div',{class:'out-acts'},btn,h('button',{type:'button',class:'btn small',onclick:()=>copyText('“'+r.text+'” — '+(r.role==='기타'?(r.roleEtc||'테스터'):r.role))},'복사')));}));
    const tCard=h('div',{class:'card'},h('h3',{},'테스터'),
      ds.length?null:h('div',{class:'adm-leg'},'아직 기록이 없어요. 테스터가 참여 권한으로 들어와 써야 쌓여요.'),
      ...ds.map(d=>{const s=this.stat(d);const r=d.review;
        return h('div',{class:'adm-row'},h('div',{},h('b',{},label(d)),' ',r?h('span',{class:'tag'},r.role==='기타'?(r.roleEtc||'기타'):r.role):null),
          h('div',{class:'m'},'처음 '+(s.first||'-')+' · 마지막 '+(s.last||'-')+' · 쓴 날 '+s.days+'일'),
          h('div',{class:'m'},'해석 입시 '+s.by.exam+' · 전문 '+s.by.pro+' · 한도에 걸림 '+s.hits+' · 의견 '+s.fb+' · 후기 '+(r?'있음':(d.reviewSkip?'미룸':'없음'))));}));
    const notes=all.filter(e=>e.note).sort((a,b)=>b.at-a.at).slice(0,60);
    const nCard=h('div',{class:'card'},h('h3',{},'한 줄 의견'),
      notes.length?null:h('div',{class:'adm-leg'},'아직 없어요.'),
      ...notes.map(e=>h('div',{class:'adm-row'},h('div',{},e.note),h('div',{class:'m'},e._who+' · '+(e.feature||'')+' · '+ymdOf(e.at)+' · '+[e.fit,e.aiLike,e.newThought].filter(Boolean).join(' / ')))));
    const csv=h('button',{type:'button',class:'btn'},'의견·후기 CSV로 받기');
    csv.addEventListener('click',()=>{const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
      const rows=[['구분','테스터','날짜','기능','모드','맞았나','AI같았나','새생각','한줄의견/후기','하는 일','실어도됨','랜딩후보',...RV_Q.map(x=>x.q)]];
      all.forEach(e=>rows.push(['의견',e._who,ymdOf(e.at),e.feature,e.mode,e.fit,e.aiLike,e.newThought,e.note,'','','']));
      rvs.forEach(d=>{const r=d.review;rows.push(['후기',label(d),ymdOf(r.at),'','','','','',r.text,r.role==='기타'?r.roleEtc:r.role,r.consent?'예':'아니오',this.appr[d._id]?'예':'아니오',...RV_Q.map(x=>(r.answers||{})[x.k]||'')]);});
      const blob=new Blob(['﻿'+rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'});const a=h('a',{href:URL.createObjectURL(blob),download:'sokmal-beta-'+ymd()+'.csv'});document.body.append(a);a.click();a.remove();});
    body.replaceChildren(stats,ind,sv,rvCard,tCard,nCard,h('div',{class:'out-acts'},csv));}
};
function ymdOf(t){if(!t)return '';const d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate();}

/* ---------- 이어서 이야기하기 (대화형) ---------- */
function defaultTurnActions(kind){return (t,q)=>[{label:'복사',fn:()=>copyText(cleanText(t))},{label:'기록함에 저장',fn:async()=>{const ok=await addRec({kind,title:(kind==='분석'?'해석 · ':'독백 다듬기 · ')+q.slice(0,20),body:cleanText(t),work:'',tags:['대화'],status:'',source:'AI',ref:''});if(ok)toast('기록함에 저장했어요');}}];}
const CHAT={
  monologue:{title:'대화로 다듬기',hint:'고치고 싶은 곳을 말해 주세요. 말한 곳만 고치고 나머지는 그대로 둬요.',ph:'예) 세 번째 줄이 설명 같아요. 더 짧게',
    chips:['더 입말로','설명하는 줄을 빼 줘','끝을 더 비워 줘','더 짧게','이 인물이라면 이 말을 할까?'],
    /* wrap(요청을 감싸는 지침 문구)은 서버로 옮김: lib/prompts/sokmal-prompts.js monoChatWrap */
    turnActions:defaultTurnActions('독백')}
};
function chatBlock(ctx,cfg){
  /* 11-26 이식: 대화 기록은 [질문, 답] 목록으로만 들고, 서버가 원래 요청(ctx.base)으로 프롬프트를 다시 쌓는다 */
  const log=[];let turns=0,busy=false,ctl=null;
  const thread=h('div');const ta=h('textarea',{placeholder:cfg.ph,maxlength:'2000'});
  const sendBtn=h('button',{type:'button',class:'btn primary'},'보내기');const stopBtn=h('button',{type:'button',class:'btn',hidden:true},'중단');
  const count=h('div',{class:'turns'});
  const left=cfg.mode?h('div',{class:'turns chat-left','data-m':cfg.mode}):'';
  const endNote=h('div',{class:'note warn',hidden:true},'오늘은 여기까지예요. 내일 다시 이어갈 수 있어요. 마음에 든 읽기는 저장해 두세요.');
  const chips=h('div',{class:'chip-row'},cfg.chips.map(c=>h('button',{type:'button',class:'chip',onclick:()=>{if(c.endsWith(': ')){ta.value=c;ta.focus();}else{ta.value=c;send();}}},c.replace(/: $/,'…'))));
  const el=h('div',{class:'chat'},h('h3',{},cfg.title),h('span',{class:'hint'},cfg.hint),thread,chips,h('div',{style:'margin-top:8px'},ta),h('div',{class:'row'},sendBtn,stopBtn),left,count,endNote);
  function refresh(){if(!cfg.mode)return;paintUsage();const out=leftToday(cfg.mode)===0;ta.disabled=out;sendBtn.disabled=out||busy;endNote.hidden=!out;}
  async function send(){
    const q=ta.value.trim();if(!q||busy)return;if(!Api.ready||!ctx.base){toast('이 화면에서는 AI 기능을 쓸 수 없어요');return;}
    if(cfg.mode&&!gate(cfg.mode)){refresh();return;}
    busy=true;sendBtn.disabled=true;stopBtn.hidden=false;ta.value='';
    const qEl=h('div',{class:'turn-q'},q);const body=h('div',{class:'out-body turn-a'});const st=h('div',{class:'status'},'생각하는 중…');const acts=h('div',{class:'out-acts'});
    thread.append(qEl,st,body,acts);qEl.scrollIntoView({behavior:'smooth',block:'start'});
    ctl=new AbortController();stopBtn.onclick=()=>ctl.abort();
    try{
      const r=await Api.run({kind:'chat',base:ctx.base,first:ctx.text,turns:log.slice(),q},{signal:ctl.signal,onText:text=>{st.textContent='';renderText(body,text);}});
      renderText(body,r.text);st.textContent=r.truncated?'답이 길어 중간에 끊겼어요.':'';log.push({q,a:r.text});turns++;
      if(cfg.mode&&!isMetaReply(r.text))await useOne(cfg.mode,'follow');
      count.textContent='이 대화에서 주고받은 횟수 '+turns;
      const t=r.text;(cfg.turnActions||defaultTurnActions('분석'))(t,q).forEach(a=>acts.append(h('button',{type:'button',class:'btn small'+(a.primary?' primary':''),onclick:a.fn},a.label)));
    }catch(e){
      if(e&&e.text)renderText(body,e.text);
      st.textContent=e&&e.code==='prompt_too_large'?'대화가 너무 길어졌어요. 위에서 새로 시작해 주세요.':errCopy(e);
      if(!(e&&e.text))ta.value=q;
    }finally{busy=false;sendBtn.disabled=false;stopBtn.hidden=true;refresh();}
  }
  sendBtn.addEventListener('click',send);
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();send();}});
  refresh();
  return {el,turns:()=>turns};
}

/* ---------- 사진·영상 선택 ---------- */
function loadImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file);const i=new Image();i.onload=()=>{URL.revokeObjectURL(u);res(i)};i.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('img'))};i.src=u;});}
function toBlob(src,w,h2){const c=document.createElement('canvas');const k=Math.min(1,1024/Math.max(w,h2));c.width=Math.round(w*k);c.height=Math.round(h2*k);c.getContext('2d').drawImage(src,0,0,c.width,c.height);return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('blob')),'image/jpeg',0.85));}
async function photoBlob(file){const i=await loadImg(file);return toBlob(i,i.naturalWidth,i.naturalHeight);}
function videoFrames(file){return new Promise((resolve,reject)=>{
  const u=URL.createObjectURL(file);const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=u;
  const done=(f,e)=>{URL.revokeObjectURL(u);e?reject(e):resolve(f)};
  const timer=setTimeout(()=>done(null,new Error('timeout')),20000);
  v.onerror=()=>{clearTimeout(timer);done(null,new Error('video'))};
  v.onloadedmetadata=async()=>{try{const d=v.duration;if(!isFinite(d)||d<=0)throw new Error('dur');const out=[];for(const p of [0.2,0.5,0.8]){await new Promise((r,j)=>{v.onseeked=r;v.currentTime=d*p;});out.push(await toBlob(v,v.videoWidth,v.videoHeight));}clearTimeout(timer);done(out);}catch(e){clearTimeout(timer);done(null,e)}};
});}
function mediaPicker(host){
  const st={blobs:[],urls:[]};
  const status=h('div',{class:'status'});const thumbs=h('div',{class:'thumbs'});
  const clearBtn=h('button',{type:'button',class:'btn small',hidden:true,onclick:clear},'지우기');
  const pIn=h('input',{type:'file',accept:'image/*',multiple:true});const vIn=h('input',{type:'file',accept:'video/*'});
  host.append(h('div',{class:'pick'},h('label',{},'사진 고르기',pIn),h('label',{},'영상 고르기',vIn)),status,thumbs,h('div',{style:'margin-top:8px'},clearBtn));
  function clear(){st.urls.forEach(u=>URL.revokeObjectURL(u));st.urls=[];st.blobs=[];thumbs.replaceChildren();status.textContent='';clearBtn.hidden=true;pIn.value='';vIn.value='';}
  function show(blobs,msg){st.blobs=blobs;thumbs.replaceChildren(...blobs.map(b=>{const u=URL.createObjectURL(b);st.urls.push(u);return h('img',{src:u,alt:'선택한 장면'});}));status.textContent=msg;clearBtn.hidden=false;}
  pIn.addEventListener('change',async()=>{const files=[...pIn.files].slice(0,S.maxImages);if(!files.length)return;status.textContent='사진을 준비하는 중…';try{const bl=[];for(const f of files)bl.push(await photoBlob(f));show(bl,bl.length+'장 준비됐어요'+(pIn.files.length>files.length?' (최대 '+S.maxImages+'장까지)':''));}catch(e){status.textContent='사진을 읽지 못했어요. 다른 파일로 해 주세요.';}});
  vIn.addEventListener('change',async()=>{const f=vIn.files[0];if(!f)return;status.textContent='영상에서 장면을 뽑는 중…';try{const fr=await videoFrames(f);show(fr.slice(0,S.maxImages),'영상에서 장면 '+Math.min(fr.length,S.maxImages)+'컷을 뽑았어요 (영상 파일은 올라가지 않아요)');}catch(e){status.textContent='이 영상은 장면을 읽지 못했어요. 사진으로 올려 주세요.';}});
  return {get blobs(){return st.blobs},clear};
}

/* ---------- 저장소 ---------- */
/* 11-26 이식: 저장함은 3단계(서버 이식) 전까지 이 기기(브라우저)에 저장한다. localStorage를 못 쓰면 원래처럼 화면 메모리(새로고침하면 사라짐) */
const Store={items:[],ready:false,mode:'local',slow:false,draft:null,subs:[],KEY:'sokmal.records',DKEY:'sokmal.design',
  sub(f){this.subs.push(f)},emit(){this.subs.forEach(f=>f())},
  persist(){if(this.mode!=='local')return true;try{localStorage.setItem(this.KEY,JSON.stringify(this.items));return true;}catch(e){return false;}},
  async init(){
    try{localStorage.setItem('sokmal.t','1');localStorage.removeItem('sokmal.t');this.mode='local';}catch(e){this.mode='memory';}
    if(this.mode==='local'){try{const v=JSON.parse(localStorage.getItem(this.KEY)||'[]');this.items=Array.isArray(v)?v:[];}catch(e){this.items=[];}
      try{this.draft=JSON.parse(localStorage.getItem(this.DKEY)||'null');}catch(e){this.draft=null;}if(this.draft)loadDraft();}
    this.items.sort((x,y)=>(y.createdAt||0)-(x.createdAt||0));
    this.ready=true;this.emit();
  },
  async add(rec){rec.createdAt=Date.now();rec.updatedAt=rec.createdAt;
    const id='m'+rec.createdAt.toString(36)+Math.random().toString(36).slice(2,6);this.items.unshift(Object.assign({id},rec));
    if(!this.persist()){this.items.shift();const e=new Error('quota');e.code='quota_exceeded';throw e;}
    this.emit();return id;},
  async update(id,patch){patch.updatedAt=Date.now();
    const it=this.items.find(x=>x.id===id);if(it)Object.assign(it,patch);if(!this.persist())throw new Error('save');this.emit();},
  async remove(id){this.items=this.items.filter(x=>x.id!==id);if(!this.persist())throw new Error('save');this.emit();},
  saveDraft(obj){if(this.mode!=='local')return;try{localStorage.setItem(this.DKEY,JSON.stringify(obj));}catch(e){}}
};
async function addRec(rec){if(LIMITS.storageCap&&Store.items.length>=LIMITS.storageCap){toast('저장함이 가득 찼어요. 오래된 기록을 정리해 주세요');return false;}try{await Store.add(rec);return true;}catch(e){toast(e&&e.code==='quota_exceeded'?'저장 공간이 가득 찼어요. 기록을 정리해 주세요':'저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요');return false;}}
function saveAction(kind,work,tagsFn,titlePrefix){return text=>({label:'기록함에 저장',primary:true,fn:async()=>{const w=(work()||'').trim();const ok=await addRec({kind,title:(w?w+' · ':'')+titlePrefix,body:text,work:w,tags:tagsFn?tagsFn():[],status:'',source:'AI',ref:''});if(ok)toast('기록함에 저장했어요'+(Store.mode==='memory'?' (이 화면에서는 새로고침하면 사라져요)':''));}});}

/* ---------- 탭 ---------- */
const VIEWS=['home','about','monologue','analysis','image','records','talk','admin']; /* 이미지 분석은 MVP에서 뒤로 — 코드는 남겨 둠 */
const TITLES={home:'SOKMAL',about:'SOKMAL 소개',monologue:'독백 만들기',analysis:'해석',records:'내 기록',talk:'연기 대화',image:'내 이미지',admin:'관리자'};

/* ---------- 모드 (입시 / 전문) ---------- */
const MODE_KEY='sokmal.mode';
let MODE='exam',CHOSEN=false;
try{const v=localStorage.getItem(MODE_KEY);if(v==='exam'||v==='pro'){MODE=v;CHOSEN=true;}}catch(e){}
function paintMode(){
  document.body.classList.toggle('mode-exam',MODE==='exam');document.body.classList.toggle('mode-pro',MODE==='pro');
  $$('#mode-top button').forEach(b=>b.classList.toggle('on',b.dataset.v===MODE));
  if(MODE==='exam'){const bx=$('#r-seg button[data-v="box"]');if(bx&&!bx.classList.contains('on'))bx.click();} /* 이야기 설계는 전문 모드에서만 (11-27, 준비 중) */
  $$('#mode-pick button').forEach(b=>b.classList.toggle('on',CHOSEN&&b.dataset.v===MODE));
  const at=$('#a-text');if(at)at.placeholder=MODE==='exam'?'희곡 본문을 붙여 넣어 주세요 (작품명만 적어도 돼요)':'장면이나 대본을 붙여 넣어 주세요';
  if(typeof paintUsage==='function')try{paintUsage();}catch(e){}
  $('#hub-pick').hidden=CHOSEN;$('#hub-modeline').textContent=CHOSEN?'지금은 '+(MODE==='exam'?'입시':'전문')+' 모드예요. 위쪽 버튼으로 언제든 바꿀 수 있어요.':'';
  $('#mode-q').textContent=CHOSEN?'지금은 '+(MODE==='exam'?'입시':'전문')+' 모드예요':'어떤 준비를 하고 있나요?';
}
function setMode(m,announce){MODE=m;CHOSEN=true;try{localStorage.setItem(MODE_KEY,m);}catch(e){}paintMode();if(announce)toast((m==='exam'?'입시':'전문')+' 모드로 바꿨어요');}
$('#mode-top').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(b&&(b.dataset.v!==MODE||!CHOSEN))setMode(b.dataset.v,true);});
$('#mode-pick').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b)return;const first=!CHOSEN;setMode(b.dataset.v,!first);if(first){toast((b.dataset.v==='exam'?'입시':'전문')+' 모드로 시작해요');}});
paintMode();
const isPro=()=>MODE==='pro';
function route(){let n=(location.hash||'').replace('#','');if(!VIEWS.includes(n))n='home';VIEWS.forEach(v=>{$('#v-'+v).hidden=v!==n;});$('#back').hidden=n==='home';$('#bar-title').textContent=TITLES[n];window.scrollTo(0,0);if(n==='admin')Admin.open();if(n==='about')paintAboutReview();}
$('#back').addEventListener('click',()=>{location.hash='#home';});
/* 연기 대화 (11-27, 화면만 — AI 연결 전): 예시 질문을 누르면 입력칸에 넣기만 함 */
$('#t-ex').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;$('#t-q').value=b.textContent;$('#t-q').focus();});
window.addEventListener('hashchange',route);

/* ---------- 공통 전문가 기반(EXPERT) ---------- */
/* 프롬프트 문구는 서버로 옮김 (11-26 이식): lib/prompts/sokmal-prompts.js */

/* ---------- 내 이미지 (사진 없이: 자기 이야기 + 오지선다 10문항, 11-25 송무) ---------- */
const imgOut=makeOut($('#img-out'));
const IQ=$$('#v-image .iq').map(d=>({q:d.querySelector('.iq-t').textContent.replace(/^\d+\s*/,'').trim(),g:d.querySelector('[data-group]').dataset.group}));
function parseKw(text){const m=String(text).match(/독백 키워드\s*[:：]\s*(.+)/);return m?m[1].split(/[,，、]/).map(s=>s.trim()).filter(Boolean).slice(0,8):[];}
$('#img-run').addEventListener('click',()=>{
  const f={self:$('#i-self').value.trim(),char:$('#i-char').value.trim(),look:$('#i-look').value.trim(),strength:$('#i-strength').value.trim(),others:$('#i-others').value.trim(),want:$('#i-want').value.trim()};
  const purpose=(G.ipurpose&&G.ipurpose.get()[0])||'그냥 나를 알아보기';
  const answers=IQ.map((x,i)=>{const a=(G[x.g]&&G[x.g].get()[0])||'';return a?`${i+1}. ${x.q} → ${a}`:'';}).filter(Boolean);
  const written=[f.self,f.char,f.look,f.strength].filter(Boolean).length;
  if(written===0&&answers.length<5){toast('나에 대해 한 칸 이상 쓰거나, 질문에 5개 이상 답해 주세요');return;}
  imgOut.meta={feature:'내 이미지',purpose,written,answered:answers.length};
  runAI({spec:{kind:'image',input:{f,purpose,answers}},out:imgOut,btn:$('#img-run'),actions:(text,again)=>[
    {label:'이걸로 독백 만들기',primary:true,fn:()=>{const kw=parseKw(text);const m=text.split('## 찾는 것에 맞춘 참고')[1];const one=(text.split('## 내 답에서 보이는 모습')[1]||'').split('##')[0].trim();
      const wantUse=$('#i-want-use').checked&&$('#i-want').value.trim();
      $('#m-image-memo').value=[one?'내 이미지: '+one:'',kw.length?'키워드: '+kw.join(', '):'',m?('참고한 결'+m.split('##')[0]).trim():'',wantUse?'배우가 원하는 역·장르(이쪽으로 써 주세요): '+$('#i-want').value.trim():'장르는 정하지 않음 — 배우가 따로 원하지 않는 한 특정 장르로 끌고 가지 않음'].filter(Boolean).join('\n').slice(0,1200);
      $('#m-memo-wrap').hidden=false;location.hash='#monologue';toast('내 이미지를 독백 만들기에 채웠어요');}},
    saveAction('메모',()=>'',()=>['내 이미지',purpose,...parseKw(text)].slice(0,8),'내 이미지 참고 자료 '+new Date().toLocaleDateString('ko-KR'))(text),
    {label:'복사',fn:()=>copyText(text)},{label:'다시 정리',fn:again}]});
});

/* ---------- 독백 종류별 감각 (11-25 송무가 준 예시 독백에서 특징만 뽑음, 원문은 넣지 않음) ---------- */
/* ---------- 독백 (11-26 00:29 개편: 짧은 기준 + 묻고 쓰기) ---------- */
/* 프롬프트 문구는 서버로 옮김 (11-26 이식): lib/prompts/sokmal-prompts.js */
const MONO_HIST=[];
function parseDesign(t){const m=String(t).match(/^\s*\[설계\]\s*(.+)$/m);return m?m[1].slice(0,240):null;}
function monoCtx(){
  const pro=isPro();
  const kw={mtype:G.mtype.get()[0]||'입시 독백',writer:pro?(G.writer.get()[0]||'희곡 작가'):'희곡 작가',emotion:G.emotion.get(),situation:G.situation.get(),listener:G.listener.get(),mood:pro?G.mood.get():[],temper:pro?G.temper.get():[],hide:pro?(G.hide.get()[0]||''):'',length:G.length.get()[0]||'1분'};
  const story=$('#m-story').value.trim(),draft=$('#m-draft').value.trim(),memo=$('#m-image-memo').value.trim(),goal=pro?$('#m-goal').value.trim():'',voice=pro?$('#m-voice').value.trim():'';
  const chars={'1분':'약 250~300자','2분':'약 500~600자','3분':'약 750~900자'}[kw.length]||'약 500~600자';
  const lines=[`독백 종류: ${kw.mtype}`,`길이: ${kw.length} (${chars}, [상대] 줄 제외)`];
  if(kw.emotion.length)lines.push('감정: '+(kw.emotion.length===2?kw.emotion.join(' → ')+' (처음 → 끝)':kw.emotion[0]));
  if(kw.situation.length)lines.push('상황: '+kw.situation[0]);
  if(kw.listener.length)lines.push('말을 거는 상대: '+(kw.listener.length===2?kw.listener[0]+' (말이 주로 향함) / 함께 있는 사람: '+kw.listener[1]+' ([상대] 줄 앞에 누구인지 적음)':kw.listener[0]));
  if(pro){if(kw.temper.length)lines.push('인물의 기질: '+kw.temper.join(', '));if(kw.hide)lines.push('숨기는 방식: '+kw.hide);if(kw.mood.length)lines.push('분위기: '+kw.mood[0]);if(goal)lines.push('얻고 싶은 것·막는 것: '+goal);if(voice)lines.push('말투 정보: '+voice);if(kw.writer!=='희곡 작가')lines.push('쓰는 형식: '+kw.writer+'의 감각으로');}
  return {pro,kw,story,draft,memo,src:($('#m-src')||{}).value?$('#m-src').value.trim():'',srcFrom:($('#m-src-from')||{}).value?$('#m-src-from').value.trim():'',mat:lines.join('\n')};
}


/* ---------- ② 독백 만들기 ---------- */
let mMode='new';
seg($('#m-mode'),v=>{mMode=v;$('#m-draft-wrap').hidden=v!=='refine';$('#m-adapt-wrap').hidden=v!=='adapt';$('#m-ask').replaceChildren();});
const mOut=makeOut($('#m-out'));
function writeMono(c,qa){
  $('#m-ask').replaceChildren();
  const work=()=>$('#m-work').value;const kw=c.kw;
  mOut.meta={feature:'독백',chatCfg:c.pro?CHAT.monologue:null,sub:mMode==='refine'?'초안 다듬기':mMode==='adapt'?'번안':(qa&&qa.some(x=>x.a)?'묻고 쓰기':'바로 쓰기'),length:kw.length};
  if(!gate('mono'))return;
  runAI({spec:{kind:'mono',c,qa,mMode,hist:MONO_HIST.slice()},out:mOut,btn:$('#m-run'),onDone:t=>{const d=parseDesign(t);if(d&&mMode==='new'){MONO_HIST.push(d);if(MONO_HIST.length>4)MONO_HIST.shift();}},actions:(text)=>[
    {label:'기록함에 저장',primary:true,fn:()=>saveAction('독백',work,()=>[c.pro?'전문':'입시',...kw.emotion,...kw.situation].slice(0,8),(mMode==='adapt'?'번안 ':'독백 ')+(kw.emotion[0]||kw.situation[0]||new Date().toLocaleDateString('ko-KR')))(cleanText(text)+(mMode==='adapt'&&c.srcFrom?'\n\n— 원작: '+c.srcFrom:'')).fn()},
    {label:'복사',fn:()=>copyText(cleanText(text))},
    {label:'같은 답으로 다시 쓰기',fn:()=>writeMono(c,qa)}]});
}
$('#m-run').addEventListener('click',async()=>{
  const c=monoCtx();
  if(mMode==='refine'&&!c.draft){toast('다듬을 초안을 넣어 주세요');return;}
  if(mMode==='adapt'&&!c.src){toast('바꾸고 싶은 문장을 붙여 넣어 주세요');return;}
  if(mMode==='new'&&!c.story&&!c.kw.emotion.length&&!c.kw.situation.length){toast('키워드를 고르거나 내 이야기를 적어 주세요');return;}
  if(!Api.ready){toast('이 화면에서는 AI 기능을 쓸 수 없어요');return;}
  if(!gate('mono'))return;
  if(mMode==='refine'){writeMono(c,null);return;}
  const box=$('#m-ask');const btn=$('#m-run');btn.disabled=true;
  box.replaceChildren(h('div',{class:'card'},h('div',{class:'status'},'쓰기 전에 몇 가지만 여쭤볼게요…')));
  let qs=[];
  try{const r=await Api.run({kind:'mono_ask',c});qs=String(r.text).split('\n').map(x=>x.trim()).filter(x=>/^Q[.:]\s*/.test(x)).map(x=>x.replace(/^Q[.:]\s*/,'')).slice(0,3);}catch(e){}
  btn.disabled=false;
  if(!qs.length){writeMono(c,null);return;}
  const tas=qs.map(()=>h('textarea',{rows:'2',maxlength:'500',placeholder:'짧게, 떠오르는 대로. 비워 둬도 돼요'}));
  const go=h('button',{type:'button',class:'btn primary'},'이 답으로 독백 쓰기');
  const skip=h('button',{type:'button',class:'btn'},'질문 없이 바로 쓰기');
  go.addEventListener('click',()=>writeMono(c,qs.map((q,i)=>({q,a:tas[i].value.trim().slice(0,500)}))));
  skip.addEventListener('click',()=>writeMono(c,null));
  box.replaceChildren(h('div',{class:'card ask'},h('h3',{},'쓰기 전에, 당신 이야기를 조금만'),
    h('p',{class:'hint',style:'margin:0 0 8px'},'답한 만큼 당신의 독백이 돼요. 거창한 일이 아니어도 괜찮아요. 고맙다는 말을 놓친 일, 하려다 삼킨 한마디면 충분해요.'),
    ...qs.map((q,i)=>h('div',{class:'f'},h('label',{class:'f'},q),tas[i])),
    h('div',{class:'out-acts'},go,skip)));
  box.scrollIntoView({behavior:'smooth',block:'start'});tas[0].focus({preventScroll:true});
});

/* ---------- ③ 해석 학습 (명세 v1.1) ---------- */
const aOut=makeOut($('#a-out'));
let aStart='mine';
seg($('#a-start'),v=>{aStart=v;$('#a-mine-wrap').hidden=v!=='mine';});
function paintCount(){const n=$('#a-text').value.length;const over=n>LIMITS.maxText;$('#a-count').textContent=n.toLocaleString('ko-KR')+'자'+(over?' · 한 번에 '+LIMITS.maxText.toLocaleString('ko-KR')+'자까지 받아요. 막·장면 단위로 나눠 넣어 주세요':'');$('#a-count').style.color=over?'#B4503B':'';}
$('#a-text').addEventListener('input',paintCount);
$('#a-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const t=await f.text();$('#a-text').value=t;paintCount();toast(t.length>LIMITS.maxText?'불러왔어요. 다만 너무 길어서 나눠 넣어야 해요':'불러왔어요');}catch(x){toast('파일을 읽지 못했어요');}});

/* SRC_RULE·TITLE_RULE·CHECK_RULE·PRO_RULES·CLOSING·examPromptOf·proPromptOf */
/* 프롬프트 문구는 서버로 옮김 (11-26 이식): lib/prompts/sokmal-prompts.js */
const EXAM_FOLLOW={title:'더 묻기',hint:'정리에서 더 알고 싶은 걸 물어보세요. 한 번 물을 때마다 오늘 횟수 1번을 써요.',ph:'예) 2막 독백 후보를 더 찾아 줘',mode:'exam',
  chips:['인물 관계를 더 알려 줘','독백 후보 구간을 더 찾아 줘','내 생각은 이래요: '],
  /* wrap은 서버로 옮김: examFollowWrap */
  turnActions:defaultTurnActions('분석')};
function proTurnActions(ctxInfo){return (t,q)=>{const memo=parseMemo(t);return [
  {label:'이 읽기 저장',primary:true,fn:async()=>{const ok=await addRec({kind:'분석',title:(ctxInfo.work?ctxInfo.work+' · ':'')+(memo['읽기']||'해석').slice(0,40),body:cleanText(t),work:ctxInfo.work,tags:['전문',ctxInfo.char].filter(Boolean),status:'',source:'AI',ref:''});if(ok)toast('저장함에 저장했어요');}},
  {label:'독백 만들기로 가져오기',fn:()=>fillMonoFromPro(memo,cleanText(t),ctxInfo)},
  {label:'복사',fn:()=>copyText(cleanText(t))}];};}
function proChatCfg(ctxInfo){return {title:'이어서 생각 넓히기',hint:'내 생각을 말하거나 더 묻고 싶은 걸 적어 보세요.',ph:'예) 저는 이 인물이 화난 게 아니라 무서운 거라고 봐요',mode:'pro',
  chips:['내 생각은 이래요: ','반대로 읽으면?','상대 인물 입장에서는?','이 장면 직전에는 무슨 일이?','이 대사가 왜 하필 지금 나와요?'],
  /* wrap은 서버로 옮김: proFollowWrap */
  turnActions:proTurnActions(ctxInfo)};}
function fillMonoFromPro(memo,text,ci){
  if(MODE!=='pro')setMode('pro',false);
  const goal=[memo['원하는 것'],memo['숨기는 것']&&('숨기는 것: '+memo['숨기는 것'])].filter(Boolean).join(' / ');
  if(goal)$('#m-goal').value=goal;
  $('#m-story').value=[ci.char?'인물: '+ci.char:'',memo['읽기']?'내가 고른 해석: '+memo['읽기']:'','',text.slice(0,900)].filter((x,i)=>x||i===2).join('\n').trim();
  if(ci.work)$('#m-work').value=ci.work;
  location.hash='#monologue';toast('해석을 독백 만들기에 채웠어요. 고친 뒤 만들기를 눌러 주세요');
}
function parseCands(t){const part=String(t).split(/^##\s*독백 후보 구간\s*$/m)[1];if(!part)return [];return part.split(/^##\s/m)[0].split('\n').map(x=>x.trim()).filter(x=>/^[-•·]\s+/.test(x)).map(x=>x.replace(/^[-•·]\s+/,'').replace(/\*\*/g,'')).slice(0,6);}
function fillMonoFromExam(c,work){
  if(MODE!=='exam')setMode('exam',false);
  $('#m-story').value=`${work?'〈'+work+'〉 ':''}독백 후보 구간: ${c}\n\n(이 인물이 이 순간 상대에게 무엇을 원하는지, 내 경험에서 닮은 순간이 있다면 덧붙여 보세요)`;
  if(work)$('#m-work').value=work;
  location.hash='#monologue';toast('후보 구간을 독백 만들기에 채웠어요. 고친 뒤 만들기를 눌러 주세요');
}
$('#a-run').addEventListener('click',()=>{
  const m=MODE||'exam';let text=$('#a-text').value.trim(),work=$('#a-work').value.trim();const part=$('#a-part').checked;
  // 본문 칸에 작품명만 적은 경우(짧고 한 줄) → 작품명으로 받기
  if(m==='exam'&&text&&text.length<=40&&!/\n/.test(text)&&(!work||work===text.replace(/[〈〉<>《》「」'"]/g,''))){work=work||text.replace(/[〈〉<>《》「」'"]/g,'').trim();text='';$('#a-work').value=work;$('#a-text').value='';paintCount();toast('작품명으로 알아들었어요');}
  if(m==='exam'&&!text&&!work){toast('본문을 붙여 넣거나 작품명을 적어 주세요');return;}
  if(m==='pro'&&!text){toast('장면이나 대본을 붙여 넣어 주세요');return;}
  if(text.length>LIMITS.maxText){paintCount();toast('본문이 너무 길어요. 막·장면 단위로 나눠 넣어 주세요');return;}
  if(!gate(m))return;
  let spec,meta;
  if(m==='exam'){
    const mineE=$('#a-mine-exam').value.trim();
    spec={kind:'interpret',mode:'exam',input:{text,work,part,mine:mineE}};
    meta={feature:'해석',mode:'exam',titleOnly:!text,textLen:text.length,part,chatCfg:EXAM_FOLLOW,
      extra:t=>{if(isMetaReply(t))return null;const box=h('div');
        if(!text)box.append(h('div',{class:'note warn'},'작품명만으로 정리했어요. 본문과 다를 수 있으니 확인이 필요해요.'));
        else if(part)box.append(h('div',{class:'note'},'일부 본문 기준으로 정리했어요.'));
        const memo=h('textarea',{placeholder:'정리를 보며 떠오른 내 분석을 적어 두세요. 시험장에서 말할 건 결국 내 생각이에요',maxlength:'3000'});
        box.append(h('div',{class:'mymemo'},h('b',{},'내 분석 메모'),memo,h('button',{type:'button',class:'btn small primary',onclick:async()=>{const v=memo.value.trim();if(!v){toast('먼저 적어 주세요');return;}const ok=await addRec({kind:'분석',title:(work||'작품')+' · 내 분석',body:v+'\n\n— 참고한 AI 정리 —\n'+t,work,tags:['입시','내 분석'],status:'',source:'직접',ref:''});if(ok)toast('내 분석을 기록에 저장했어요');}},'내 분석 저장')));
        const cs=parseCands(t);if(cs.length)box.append(h('div',{class:'cands'},h('b',{},'독백 후보 구간으로 독백 만들기'),cs.map(c=>h('div',{class:'cand'},h('div',{},c),h('button',{type:'button',class:'btn small',onclick:()=>fillMonoFromExam(c,work)},'이 구간으로 독백 만들기')))));
        return box;}};
  }else{
    const char=$('#a-char').value.trim();const mine=aStart==='mine'?$('#a-mine').value.trim():'';
    const ci={work,char};
    spec={kind:'interpret',mode:'pro',input:{text,work,char,part,mine}}; /* 오늘 마지막 1번인지(last)는 서버가 판단 */
    meta={feature:'해석',mode:'pro',start:mine?'내 생각 먼저':'바로 분석',startChosen:aStart==='mine'?'내 생각 먼저':'바로 분석',textLen:text.length,part,chatCfg:proChatCfg(ci)};
  }
  aOut.meta=meta;
  const ci={work,char:m==='pro'?$('#a-char').value.trim():''};
  runAI({spec,out:aOut,btn:$('#a-run'),
    onDone:t=>{if(!isMetaReply(t))return useOne(m,'run');},
    actions:t=>isMetaReply(t)?[]:(m==='exam'?[saveAction('분석',()=>work,()=>['입시'],'작품 정리')(t),{label:'복사',fn:()=>copyText(t)}]:proTurnActions(ci)(t,''))});
});

/* ---------- ④ 창작의 기록 ---------- */
seg($('#r-seg'),v=>{$('#r-design').hidden=v!=='design';$('#r-mood').hidden=v!=='mood';$('#r-box').hidden=v!=='box';if(v==='box')renderBox();});
const DF=['d-work','d-premise','d-theme','d-characters','d-conflict','d-setting','d-events','d-material','d-plants'];
function readDesign(){const o={form:G.dform.get()[0]||''};DF.forEach(id=>o[id.slice(2)]=$('#'+id).value);return o;}
function loadDraft(){const d=Store.draft;if(!d)return;if($('#d-work').value||$('#d-premise').value)return;DF.forEach(id=>{if(d[id.slice(2)])$('#'+id).value=d[id.slice(2)];});if(d.form)G.dform.set([d.form]);}
let draftT=null;
function queueDraft(){clearTimeout(draftT);draftT=setTimeout(()=>Store.saveDraft(readDesign()),1200);}
DF.forEach(id=>$('#'+id).addEventListener('input',queueDraft));G.dform.onChange(queueDraft);
const dOut=makeOut($('#d-out'));
function designText(d){const L=[['작품명',d.work],['형식',d.form],['만들고 싶은 이야기',d.premise],['주제',d.theme],['인물',d.characters],['갈등',d.conflict],['배경',d.setting],['사건',d.events],['소재',d.material],['떡밥',d.plants]];return L.map(([k,v])=>k+': '+(v&&v.trim()?v.trim():'(비어 있음)')).join('\n');}
$('#d-check').addEventListener('click',()=>{
  const d=readDesign();if(!DF.some(id=>$('#'+id).value.trim())){toast('설계를 조금 적은 뒤에 점검해 보세요');return;}
  dOut.meta={feature:'설계 점검'};
  runAI({spec:{kind:'design',d},out:dOut,btn:$('#d-check'),actions:(t,again)=>[saveAction('설계',()=>$('#d-work').value,()=>['점검'],'설계 점검')(t),{label:'복사',fn:()=>copyText(t)},{label:'다시 점검',fn:again}]});
});
$('#d-save').addEventListener('click',async()=>{
  const d=readDesign();if(!DF.some(id=>$('#'+id).value.trim())){toast('저장할 내용이 없어요');return;}
  const w=(d.work||'').trim()||'제목 미정';let n=0;
  const parts=[['설계',w+' · 설계',designText(d),''],['인물',w+' · 인물',[d.characters&&'인물: '+d.characters,d.conflict&&'갈등: '+d.conflict].filter(Boolean).join('\n\n'),''],['배경',w+' · 배경',d.setting,''],['사건',w+' · 사건',d.events,''],['소재',w+' · 소재',d.material,''],['떡밥',w+' · 떡밥',d.plants,'회수 전']];
  for(const [kind,title,body,status] of parts){
    if(!body||!body.trim())continue;const ref='design:'+w+':'+kind;const ex=Store.items.find(x=>x.ref===ref);
    try{if(ex)await Store.update(ex.id,{title,body:body.trim(),work:w,status:ex.status||status});else await Store.add({kind,title,body:body.trim(),work:w,tags:d.form?[d.form]:[],status,source:'직접',ref});n++;}catch(e){toast('저장하지 못한 항목이 있어요');}
  }
  Store.saveDraft(d);toast('기록함에 나눠 저장했어요'+(Store.mode==='memory'?' (이 화면에서는 새로고침하면 사라져요)':''));
});
$('#d-clear').addEventListener('click',()=>{if(!window.__clr){window.__clr=true;toast('한 번 더 누르면 설계를 비워요 (기록함은 그대로예요)');setTimeout(()=>{window.__clr=false},3000);return;}window.__clr=false;DF.forEach(id=>$('#'+id).value='');G.dform.clear();Store.saveDraft(readDesign());toast('설계를 비웠어요');});

/* 분위기 */
const moodPicker=mediaPicker($('#mood-picker'));const moodOut=makeOut($('#mood-out'));
$('#mood-run').addEventListener('click',()=>{
  const note=$('#mood-note').value.trim();const blobs=moodPicker.blobs;
  if(!blobs.length&&!note){toast('사진·영상을 넣거나 느낌을 적어 주세요');return;}
  if(blobs.length&&!S.canImages){toast('이 화면에서는 사진 분석을 쓸 수 없어요');return;}
  toast('분위기 구체화는 지금 쓰지 않아요');return; /* 11-26 이식: 사진 분석은 MVP 제외(PRD 4-2). 프롬프트는 legacy/index.html에 보존 */
  // eslint-disable-next-line no-unreachable
  const work=()=>$('#mood-work').value;
    runAI({spec:{kind:'mood'},out:moodOut,btn:$('#mood-run'),actions:(t,again)=>[saveAction('분위기',work,()=>[],'분위기 '+new Date().toLocaleDateString('ko-KR'))(t),{label:'복사',fn:()=>copyText(t)},{label:'다시 구체화',fn:again}]});
});

/* 기록함 */
let bKind='전체',editId=null,bSearch='',bWork='';
const kindsRow=$('#b-kinds');
['전체','독백','분석','메모'].forEach(k=>{const b=h('button',{type:'button',class:'chip'+(k==='전체'?' on':''),'data-k':k},k);b.addEventListener('click',()=>{bKind=k;$$('.chip',kindsRow).forEach(x=>x.classList.toggle('on',x===b));renderBox();});kindsRow.append(b);});
$('#b-search').addEventListener('input',e=>{bSearch=e.target.value.trim().toLowerCase();renderBox();});
$('#b-work').addEventListener('change',e=>{bWork=e.target.value;renderBox();});
function openForm(rec){editId=rec?rec.id:null;$('#b-form').hidden=false;$('#b-form-title').textContent=rec?'기록 고치기':'새 기록';G.bkind.set([rec?rec.kind:'메모']);$('#b-f-work').value=rec?rec.work||'':(bWork||'');$('#b-f-title').value=rec?rec.title||'':'';$('#b-f-body').value=rec?rec.body||'':'';$('#b-f-tags').value=rec?(rec.tags||[]).join(', '):'';$('#b-form').scrollIntoView({behavior:'smooth',block:'start'});}
$('#b-new').addEventListener('click',()=>openForm(null));
$('#b-f-cancel').addEventListener('click',()=>{$('#b-form').hidden=true;editId=null;});
$('#b-f-save').addEventListener('click',async()=>{
  const kind=G.bkind.get()[0]||'메모',title=$('#b-f-title').value.trim(),body=$('#b-f-body').value.trim();
  if(!title&&!body){toast('제목이나 내용을 적어 주세요');return;}
  const tags=$('#b-f-tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean).slice(0,12);const work=$('#b-f-work').value.trim();
  try{if(editId){await Store.update(editId,{kind,title:title||body.slice(0,24),body,work,tags});}else{await Store.add({kind,title:title||body.slice(0,24),body,work,tags,status:kind==='떡밥'?'회수 전':'',source:'직접',ref:''});}
    $('#b-form').hidden=true;editId=null;toast('저장했어요'+(Store.mode==='memory'?' (이 화면에서는 새로고침하면 사라져요)':''));}catch(e){toast('저장하지 못했어요');}
});
function renderBox(){
  const items=Store.items;$('#r-count').textContent=items.length?'('+items.length+')':'';
  const works=[...new Set(items.map(x=>x.work).filter(Boolean))];
  const sel=$('#b-work');const cur=sel.value;sel.replaceChildren(h('option',{value:''},'전체 작품'),...works.map(w=>h('option',{value:w},w)));sel.value=works.includes(cur)?cur:'';bWork=sel.value;
  $('#b-works').replaceChildren(...works.map(w=>h('option',{value:w})));
  const list=$('#b-list');
  if(!Store.ready){list.replaceChildren(h('div',{class:'empty'},'기록을 불러오는 중…'));return;}
  let rows=items.filter(x=>(bKind==='전체'||x.kind===bKind)&&(!bWork||x.work===bWork)&&(!bSearch||[x.title,x.body,x.work,x.kind,(x.tags||[]).join(' ')].join(' ').toLowerCase().includes(bSearch)));
  if(Store.slow)list.replaceChildren(h('div',{class:'note warn'},'기록을 아직 다 불러오지 못했어요. 잠시 뒤에 다시 확인해 주세요.'));else list.replaceChildren();
  if(!rows.length){list.append(h('div',{class:'empty'},items.length?'조건에 맞는 기록이 없어요':'아직 기록이 없어요. 설계를 저장하거나 ＋ 새 기록을 써 보세요.'));return;}
  rows.forEach(x=>{
    const card=h('div',{class:'rec'});
    const head=h('div',{class:'rh'},h('span',{class:'badge'+(x.source==='AI'?' ai':'')},x.kind),h('div',{class:'rt'},x.title||'(제목 없음)'));
    const meta=h('div',{class:'rm'},[x.work,new Date(x.createdAt||Date.now()).toLocaleDateString('ko-KR'),x.source==='AI'?'AI 답변을 내가 고른 기록':'직접 작성',x.kind==='떡밥'&&x.status?x.status:''].filter(Boolean).join(' · '));
    const body=h('div',{class:'rb'},x.body||'');
    const tags=(x.tags||[]).length?h('div',{class:'chip-row',style:'margin-top:6px'},(x.tags||[]).map(t=>h('span',{class:'tag'},t))):null;
    const acts=h('div',{class:'ra'},
      h('button',{type:'button',class:'btn small',onclick:()=>card.classList.toggle('open')},'펼치기/접기'),
      h('button',{type:'button',class:'btn small',onclick:()=>openForm(x)},'고치기'),
      x.kind==='떡밥'?h('button',{type:'button',class:'btn small',onclick:()=>Store.update(x.id,{status:x.status==='회수됨'?'회수 전':'회수됨'}).catch(()=>toast('바꾸지 못했어요'))},x.status==='회수됨'?'회수 전으로':'회수했어요'):null,
      h('button',{type:'button',class:'btn small danger',onclick:e=>{const b=e.currentTarget;if(b.dataset.c){Store.remove(x.id).catch(()=>toast('지우지 못했어요'));}else{b.dataset.c='1';b.textContent='한 번 더 누르면 삭제';setTimeout(()=>{b.dataset.c='';b.textContent='삭제'},3000);}}},'삭제'));
    card.append(head,meta,body,tags,acts);list.append(card);
  });
}
Store.sub(()=>{$('#hub-rec').textContent=Store.items.length?Store.items.length+'개':'';$('#r-count2').textContent=Store.items.length?'('+Store.items.length+(LIMITS.storageCap?' / '+LIMITS.storageCap:'')+'개)':'';if(!$('#r-box').hidden)renderBox();else $('#r-count').textContent=Store.items.length?'('+Store.items.length+')':'';updateBanner();});
function updateBanner(){const b=$('#banner2');if(Store.ready&&Store.mode==='memory')b.replaceChildren(h('div',{class:'note warn'},'이 브라우저에서는 기록을 저장할 수 없어요(사생활 보호 모드 등). 지금 쓴 기록은 새로고침하면 사라져요.'));else b.replaceChildren();}

/* ---------- 내 계정 (11-26 이식: 익명으로 시작, 이메일 연결은 선택) ---------- */
const Acct={paint(){const host=$('#hub-acct');if(!host)return;const A=Api.auth;if(!A){host.hidden=true;return;}host.hidden=false;
  const st=A.state();const P='margin:6px 0 10px;font-size:14px;color:#2D3748';
  if(st.mode!=='supabase'){host.replaceChildren(h('b',{},'개발 모드'),h('p',{style:P},'이 기기 아이디로 횟수를 세요. 기록(저장함)은 이 기기에만 저장돼요.'));return;}
  if(!st.anonymous&&st.email){host.replaceChildren(h('b',{},'내 계정'),h('p',{style:P},st.email+'(으)로 이어 쓰고 있어요. 기록(저장함)은 아직 이 기기에만 저장돼요.'),
    h('div',{class:'out-acts'},h('button',{type:'button',class:'btn small',onclick:async()=>{await A.signOut();Acct.paint();Api.usage();toast('로그아웃했어요');}},'로그아웃')));return;}
  const inp=h('input',{type:'email',placeholder:'이메일 주소',autocomplete:'email',maxlength:'200'});
  const btn=h('button',{type:'button',class:'btn small primary'},'확인 메일 받기');const msg=h('div',{class:'adm-leg',style:'margin-top:6px'});
  btn.addEventListener('click',async()=>{const v=inp.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){toast('이메일 주소를 확인해 주세요');return;}btn.disabled=true;let r;try{r=await A.linkEmail(v);}catch(e){r={msg:'메일을 보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.'};}btn.disabled=false;msg.textContent=r.msg;});
  host.replaceChildren(h('b',{},'이메일로 이어 쓰기 (선택)'),h('p',{style:P},'지금은 이 기기로만 알아봐요. 이메일을 연결하면 다른 기기에서도 같은 계정으로 이어 써요. 기록(저장함)은 아직 이 기기에만 저장돼요.'),inp,h('div',{class:'out-acts'},btn),msg);
}};

/* ---------- 입장 화면: 초대 코드 (11-26). 코드를 넣기 전에는 앱이 보이지 않음. 나중에 로그인이 이 자리에 들어감 ---------- */
const Invite={wired:false,
  lock(){document.documentElement.classList.add('gated');window.scrollTo(0,0);const i=$('#gate-code');if(i)i.focus({preventScroll:true});},
  unlock(){document.documentElement.classList.remove('gated');},
  show(){this.lock();if(this.wired)return;this.wired=true;
    const form=$('#gate-form'),inp=$('#gate-code'),btn=$('#gate-go'),msg=$('#gate-msg');
    inp.addEventListener('input',()=>{const d=inp.value.replace(/\D/g,'').slice(0,6);if(d!==inp.value)inp.value=d;msg.textContent='';});
    form.addEventListener('submit',async e=>{e.preventDefault();const v=inp.value.trim();
      if(!/^\d{6}$/.test(v)){msg.textContent='숫자 6자리를 넣어 주세요.';inp.focus();return;}
      btn.disabled=true;msg.textContent='확인하는 중…';let ok=false,err='';
      try{const r=await fetch('/api/invite',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:v})});const j=await r.json();ok=r.ok&&j.ok;err=j.error||'';}catch(x){err='network';}
      btn.disabled=false;
      if(!ok){msg.textContent=err==='too_many'?'여러 번 틀려서 잠시 막혔어요. 15분 뒤에 다시 넣어 주세요.':err==='network'?'연결이 끊겼어요. 인터넷을 확인하고 다시 눌러 주세요.':'맞지 않는 코드예요. 받은 숫자를 다시 확인해 주세요.';inp.select();return;}
      try{localStorage.setItem('sokmal.invite',v);}catch(x){}
      msg.textContent='';inp.value='';location.hash='#home';Invite.unlock();toast('반가워요. 이제 시작할 수 있어요');
      await Api.init();if(!Api.ready)$('#banner').prepend(h('div',{class:'note warn'},'이 화면에서는 AI 답변을 쓸 수 없어요. 양식은 볼 수 있지만 분석·독백 만들기는 동작하지 않아요.'));});}};

/* ---------- 시작 ---------- */
route();
(async()=>{
  await Api.init();
  if(Api.needInvite){try{localStorage.removeItem('sokmal.invite');}catch(e){}Invite.show();} /* 저장된 코드가 없거나 더는 맞지 않음 → 입장 화면 */
  else if(!Api.ready)$('#banner').prepend(h('div',{class:'note warn'},'이 화면에서는 AI 답변을 쓸 수 없어요. 양식은 볼 수 있지만 분석·독백 만들기는 동작하지 않아요.'));
  else if(Api.examplePrompts&&!Api.mock)$('#banner').prepend(h('div',{class:'note warn',id:'example-note'},'예시 프롬프트로 돌고 있어요. 답의 품질은 실제 SOKMAL과 달라요.'));
  else if(Api.mock)$('#banner').prepend(h('div',{class:'note warn',id:'mock-note'},'시험 모드: AI 대신 정해 둔 가짜 답이 나와요. 진짜 AI로 바꾸는 법은 「바탕화면에서 열기」 안내서에 있어요.'));
  if(Api.auth){Acct.paint();if(Api.auth.onChange)Api.auth.onChange(()=>{Acct.paint();Api.usage();});}
  Shared.load();
  await Store.init();
  Admin.check();
})();
})();
