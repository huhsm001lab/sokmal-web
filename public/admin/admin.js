/* SOKMAL 관리자 페이지 (11-27). 시제품 관리자 화면(legacy/index.html 의 Admin)을 바탕으로, 서버(/api/admin) 데이터로 그린다 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  let toastEl = null, toastT = null;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(toastEl);
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl && toastEl.remove(); toastEl = null; }, 2600);
  }
  function copyText(t) {
    const p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject();
    p.then(() => toast('복사했어요'), () => toast('복사가 막혀 있어요. 글자를 길게 눌러 직접 선택해 주세요'));
  }
  const KEY = 'sokmal.admin';
  const getCode = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const setCode = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
  const won = (n) => '₩' + Math.round(n || 0).toLocaleString('ko-KR');
  const ymdOf = (t) => { if (!t) return ''; const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate(); };
  const timeOf = (iso) => { if (!iso) return ''; const d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const dayShort = (d) => (d ? d.slice(5).replace('-', '/') : '-');

  /* 시제품과 같은 후기 설문 8문항 */
  const RV_Q = [
    { k: 'career', q: '연기·창작을 한 지는?', o: ['준비 중', '1년 안', '1~3년', '3~10년', '10년 넘게'] },
    { k: 'most', q: '가장 많이 쓴 기능은?', o: ['해석', '독백 만들기', '내 이미지', '내 기록'] },
    { k: 'help', q: '가장 도움이 된 점은?', o: ['시야가 넓어졌다', '시간이 줄었다', '내 이야기를 꺼내게 됐다', '글이 좋아졌다', '별로 없었다'] },
    { k: 'miss', q: '가장 아쉬운 점은?', o: ['AI 티가 난다', '흐름이 약하다', '정해 주는 느낌', '정보가 틀렸다', '느리거나 불편하다', '딱히 없다'] },
    { k: 'own', q: '결과가 내 것 같았나요?', o: ['내 것 같았다', '반반', '남의 것 같았다'] },
    { k: 'again', q: '정식으로 나오면 또 쓸 건가요?', o: ['꼭 쓴다', '아마 쓴다', '모르겠다', '안 쓴다'] },
    { k: 'price', q: '돈을 낸다면 한 달에 얼마까지 괜찮나요?', o: ['무료일 때만', '5천 원까지', '1만 원까지', '2만 원까지', '그 이상도'] },
    { k: 'recommend', q: '주변 사람에게 권하겠어요?', o: ['꼭 권한다', '권할 만하다', '글쎄', '안 권한다'] },
  ];
  const STATUS = { ok: '완료', meta: '확인 질문', refused: '거절', error: '오류', cancelled: '중단' };

  async function api(method, body) {
    const res = await fetch('/api/admin', {
      method,
      headers: Object.assign({ 'x-sokmal-admin': getCode() }, body ? { 'content-type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    let j = {};
    try { j = await res.json(); } catch (e) {}
    return { status: res.status, j };
  }

  const login = $('#adm-login'), body = $('#adm-body'), msg = $('#adm-msg');
  const refreshBtn = $('#adm-refresh'), logoutBtn = $('#adm-logout');
  function showLogin(text) {
    login.hidden = false; body.replaceChildren(); refreshBtn.hidden = true; logoutBtn.hidden = true;
    msg.textContent = text || '';
    $('#adm-code').focus();
  }

  async function load() {
    body.replaceChildren(h('p', { class: 'adm-leg' }, '불러오는 중…'));
    let r;
    try { r = await api('GET'); } catch (e) { body.replaceChildren(h('div', { class: 'note warn' }, '연결이 끊겼어요. 인터넷을 확인하고 새로고침을 눌러 주세요.')); return; }
    if (r.status === 200) { login.hidden = true; refreshBtn.hidden = false; logoutBtn.hidden = false; render(r.j); return; }
    const e = r.j.error;
    if (e === 'wrong') { setCode(''); showLogin('맞지 않는 관리자 코드예요.'); }
    else if (e === 'too_many') showLogin('여러 번 틀려서 잠시 막혔어요. 15분 뒤에 다시 넣어 주세요.');
    else if (e === 'admin_not_configured') showLogin('관리자 코드가 아직 설정되지 않았어요. Vercel 환경변수 SOKMAL_ADMIN_CODE 를 넣고 다시 배포해 주세요.');
    else if (e === 'not_configured') { login.hidden = true; body.replaceChildren(h('div', { class: 'note warn' }, '저장소가 연결되지 않았어요. Vercel에서 Upstash Redis를 연결하거나 초대 코드를 설정해 주세요.')); }
    else body.replaceChildren(h('div', { class: 'note warn' }, '데이터를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.'));
  }

  login.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#adm-code').value.trim();
    if (!v) { msg.textContent = '관리자 코드를 넣어 주세요.'; return; }
    setCode(v); $('#adm-code').value = ''; msg.textContent = '';
    load();
  });
  refreshBtn.addEventListener('click', load);
  logoutBtn.addEventListener('click', () => { setCode(''); showLogin('나갔어요.'); });

  function label(t) { return t.name || (t.code ? '코드 ' + t.code : '테스터 ' + t.uid.slice(-4)); }

  function render(d) {
    const testers = (d.testers || []).slice().sort((a, b) => (b.last || '').localeCompare(a.last || ''));
    const byUid = Object.fromEntries(testers.map((t) => [t.uid, t]));
    const who = (uid) => (byUid[uid] ? label(byUid[uid]) : '테스터 ' + String(uid).slice(-4));
    const all = testers.flatMap((t) => ((t.feedback && t.feedback.entries) || []).map((e) => Object.assign({ _who: label(t) }, e)));
    const rvs = testers.filter((t) => t.feedback && t.feedback.review && t.feedback.review.text);
    const sum = (f) => testers.reduce((a, t) => a + f(t), 0);
    const useOf = (t) => ['exam', 'pro', 'mono'].reduce((a, k) => a + t.totals[k].run + t.totals[k].follow, 0);
    const m = d.meta || {};

    const notes = [];
    if (!m.persistent) notes.push('저장소가 연결되지 않아 서버가 꺼지면 이 기록이 사라져요. Vercel에서 Upstash Redis를 연결해 주세요.');
    if (m.notReady) notes.push('AI가 꺼져 있어요: ' + m.notReady + '. Vercel 환경변수를 확인하고 다시 배포해 주세요.');
    if (m.mock) notes.push('지금은 시험 모드(가짜 답)예요. AI 호출·비용은 실제가 아니에요.');
    if (!m.pricesKnown) notes.push('모델 가격 값을 넣지 않아 AI 비용이 0원으로 보여요. 실제 비용은 OpenAI 대시보드에서 확인해 주세요.');

    const stats = h('div', { class: 'adm-stats admin-stats' },
      h('div', {}, h('b', {}, testers.length), h('span', {}, '참여 테스터')),
      h('div', {}, h('b', {}, sum(useOf)), h('span', {}, 'AI 사용 (해석·독백)')),
      h('div', {}, h('b', {}, sum((t) => t.calls)), h('span', {}, 'AI 호출 (질문 만들기 포함)')),
      h('div', {}, h('b', {}, won(d.monthCostKrw)), h('span', {}, '이번 달 AI 비용' + (m.monthlyBudgetKrw ? ' / 상한 ' + won(m.monthlyBudgetKrw) : ''))),
      h('div', {}, h('b', {}, all.length), h('span', {}, '보낸 의견')),
      h('div', {}, h('b', {}, rvs.length), h('span', {}, '후기 (실어도 됨 ' + rvs.filter((t) => t.feedback.review.consent).length + ')')));

    /* 테스터 표 */
    const tTable = h('table', { class: 'adm-table' },
      h('thead', {}, h('tr', {}, ['이름 메모', '코드', '처음', '마지막', '쓴 날', '해석 입시', '해석 전문', '독백', '한도 걸림', 'AI 호출', '비용', '의견', '후기'].map((x) => h('th', {}, x)))),
      h('tbody', {}, testers.map((t) => {
        const inp = h('input', { type: 'text', value: t.name || '', placeholder: '이름', maxlength: '40', 'aria-label': '이름 메모 ' + (t.code || t.uid.slice(-4)) });
        const save = h('button', { type: 'button', class: 'btn small' }, '저장');
        save.addEventListener('click', async () => {
          save.disabled = true;
          const r = await api('POST', { name: { uid: t.uid, name: inp.value } }).catch(() => ({ status: 0 }));
          save.disabled = false;
          if (r.status === 200) { t.name = inp.value.trim(); toast('이름 메모를 저장했어요'); render(d); } else toast('저장하지 못했어요');
        });
        const fb = t.feedback || {};
        const hits = t.totals.exam.hits + t.totals.pro.hits + t.totals.mono.hits;
        return h('tr', {},
          h('td', {}, h('div', { class: 'adm-name' }, inp, save)),
          h('td', {}, t.code || '-'),
          h('td', {}, dayShort(t.first)), h('td', {}, dayShort(t.last)), h('td', { class: 'num' }, t.days),
          h('td', { class: 'num' }, t.totals.exam.run + t.totals.exam.follow),
          h('td', { class: 'num' }, t.totals.pro.run + t.totals.pro.follow),
          h('td', { class: 'num' }, t.totals.mono.run + t.totals.mono.follow),
          h('td', { class: 'num' }, hits),
          h('td', { class: 'num' }, t.calls), h('td', { class: 'num' }, won(t.costKrw)),
          h('td', { class: 'num' }, (fb.entries || []).length),
          h('td', {}, fb.review ? '있음' : fb.reviewSkip ? '미룸' : '없음'));
      })));
    const tCard = h('div', { class: 'card' }, h('h3', {}, '테스터'),
      testers.length ? h('div', { class: 'adm-scroll' }, tTable) : h('div', { class: 'adm-leg' }, '아직 들어온 테스터가 없어요.'),
      h('p', { class: 'adm-leg' }, '이름 메모는 송무만 보여요. 코드를 누구에게 줬는지 적어 두세요.'));

    /* AI 호출 */
    const calls = (d.calls || []).slice(0, 100);
    const cCard = h('div', { class: 'card' }, h('h3', {}, 'AI 호출 (최근 100건)'),
      calls.length ? h('div', { class: 'adm-scroll' }, h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {}, ['시간', '테스터', '기능', '모델', '입력 토큰', '출력 토큰', '비용', '결과'].map((x) => h('th', {}, x)))),
        h('tbody', {}, calls.map((c) => h('tr', {},
          h('td', {}, timeOf(c.at)), h('td', {}, who(c.uid)), h('td', {}, c.feature), h('td', {}, c.model),
          h('td', { class: 'num' }, (c.inputTokens + c.cacheReadTokens + c.cacheWriteTokens).toLocaleString('ko-KR')),
          h('td', { class: 'num' }, (c.outputTokens || 0).toLocaleString('ko-KR')),
          h('td', { class: 'num' }, won(c.costKrw)), h('td', { style: c.detail ? 'white-space:normal;min-width:220px' : '' }, STATUS[c.status] || c.status, c.detail ? h('div', { class: 'adm-leg' }, c.detail) : null)))))) : h('div', { class: 'adm-leg' }, '아직 AI 호출이 없어요.'));

    /* 지표 3문항 (시제품과 같은 막대) */
    const COL = ['#2F4A7A', '#8FA3C4', '#D9DEE7'];
    const bar = (q, key, opts) => {
      const c = opts.map((o) => all.filter((e) => e[key] === o).length); const n = c.reduce((a, b) => a + b, 0);
      return h('div', { class: 'adm-q' }, h('div', {}, q + ' ', h('span', { class: 'adm-leg' }, '(' + n + '건)')),
        h('div', { class: 'adm-bar' }, ...c.map((v, i) => { const e = h('i'); e.style.width = (n ? v / n * 100 : 0) + '%'; e.style.background = COL[i]; return e; })),
        h('div', { class: 'adm-leg' }, opts.map((o, i) => o + ' ' + c[i]).join(' · ')));
    };
    const byFeat = {};
    all.forEach((e) => { const k = (e.feature || '기타') + (e.mode ? ' · ' + (e.mode === 'exam' ? '입시' : '전문') : ''); byFeat[k] = (byFeat[k] || 0) + 1; });
    const ind = h('div', { class: 'card' }, h('h3', {}, '지표'),
      bar('내게 맞았나요?', 'fit', ['맞았다', '애매하다', '안 맞았다']),
      bar('AI가 쓴 것 같았나요?', 'aiLike', ['사람 같았다', '조금', 'AI 같았다']),
      bar('새로운 생각이 났나요?', 'newThought', ['났다', '조금', '아니다']),
      h('div', { class: 'adm-leg', style: 'margin-top:10px' }, '기능별 의견 수: ' + (Object.entries(byFeat).map(([k, v]) => k + ' ' + v).join(' · ') || '아직 없음')));

    /* 후기 설문 */
    const rvAll = rvs.map((t) => t.feedback.review.answers || {});
    const rbar = (x) => {
      const c = x.o.map((o) => rvAll.filter((a) => a[x.k] === o).length); const n = c.reduce((a, b) => a + b, 0);
      return h('div', { class: 'adm-q' }, h('div', {}, x.q + ' ', h('span', { class: 'adm-leg' }, '(' + n + '명)')),
        h('div', { class: 'adm-bar' }, ...c.map((v, i) => { const e = h('i'); e.style.width = (n ? v / n * 100 : 0) + '%'; e.style.background = ['#1F3A5F', '#2F4A7A', '#5B76A3', '#8FA3C4', '#BCC8DC', '#D9DEE7'][i]; return e; })),
        h('div', { class: 'adm-leg' }, x.o.map((o, i) => o + ' ' + c[i]).join(' · ')));
    };
    const roleOf = (r) => (r.role === '기타' ? (r.roleEtc || '기타') : r.role);
    const roleCnt = {}; rvs.forEach((t) => { const r = roleOf(t.feedback.review); roleCnt[r] = (roleCnt[r] || 0) + 1; });
    const sv = h('div', { class: 'card' }, h('h3', {}, '후기 설문'),
      rvs.length ? h('div', { class: 'adm-leg' }, '하는 일: ' + Object.entries(roleCnt).map(([k, v]) => k + ' ' + v).join(' · ')) : h('div', { class: 'adm-leg' }, '아직 없어요.'),
      ...(rvs.length ? RV_Q.map(rbar) : []));

    /* 후기 목록 */
    const appr = d.approved || {};
    const rvCard = h('div', { class: 'card' }, h('h3', {}, '후기'),
      rvs.length ? null : h('div', { class: 'adm-leg' }, '아직 받은 후기가 없어요. 의견을 2번 보낸 테스터에게 한 번 물어봐요.'),
      ...rvs.sort((a, b) => (b.feedback.review.at || 0) - (a.feedback.review.at || 0)).map((t) => {
        const r = t.feedback.review; const ok = !!appr[t.uid];
        const btn = h('button', { type: 'button', class: 'btn small' + (ok ? '' : ' primary'), disabled: !r.consent }, ok ? '랜딩 표시 빼기' : '랜딩에 쓸 후기로 표시');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const res = await api('POST', { approve: { uid: t.uid, v: !ok } }).catch(() => ({ status: 0 }));
          if (res.status === 200) { if (ok) delete appr[t.uid]; else appr[t.uid] = true; toast(ok ? '표시를 뺐어요' : '랜딩에 쓸 후기로 표시했어요'); render(d); } else { btn.disabled = false; toast('저장하지 못했어요'); }
        });
        return h('div', { class: 'adm-rv' },
          h('div', {}, h('span', { class: 'tag' }, roleOf(r)), r.consent ? h('span', { class: 'tag ok' }, '실어도 됨') : h('span', { class: 'tag' }, '내부용만'), ok ? h('span', { class: 'tag ok' }, '랜딩 후보') : null),
          h('p', {}, r.text), h('div', { class: 'adm-leg' }, label(t) + ' · ' + ymdOf(r.at)),
          h('div', { class: 'out-acts' }, btn, h('button', { type: 'button', class: 'btn small', onclick: () => copyText('“' + r.text + '” — ' + (roleOf(r) || '테스터')) }, '복사')));
      }));

    /* 한 줄 의견 */
    const notesList = all.filter((e) => e.note).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 60);
    const nCard = h('div', { class: 'card' }, h('h3', {}, '한 줄 의견'),
      notesList.length ? null : h('div', { class: 'adm-leg' }, '아직 없어요.'),
      ...notesList.map((e) => h('div', { class: 'adm-row' }, h('div', {}, e.note), h('div', { class: 'm adm-leg' }, e._who + ' · ' + (e.feature || '') + ' · ' + ymdOf(e.at) + ' · ' + [e.fit, e.aiLike, e.newThought].filter(Boolean).join(' / ')))));

    /* 대기 명단 (소개 페이지에서 남김) */
    const wl = d.waitlist || [];
    const wCard = h('div', { class: 'card' }, h('h3', {}, '대기 명단 ' + wl.length + '명'),
      h('p', { class: 'adm-leg' }, '소개 페이지에서 초대 코드가 없는 사람이 남긴 연락처예요. 초대 코드 안내에만 쓰고, 지워 달라고 하면 지워 주세요.'),
      wl.length ? h('div', { class: 'adm-scroll' }, h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {}, ['남긴 때', '연락처', '하는 일', '한 줄', ''].map((x) => h('th', {}, x)))),
        h('tbody', {}, wl.map((w) => {
          const del = h('button', { type: 'button', class: 'btn small' }, '지우기');
          del.addEventListener('click', async () => {
            if (!confirm(w.contact + ' 을(를) 대기 명단에서 지울까요?')) return;
            del.disabled = true;
            const r = await api('POST', { waitDelete: { contact: w.contact, kind: w.kind } }).catch(() => ({ status: 0 }));
            if (r.status === 200) { d.waitlist = (d.waitlist || []).filter((x) => x !== w); toast('지웠어요'); render(d); } else { del.disabled = false; toast('지우지 못했어요'); }
          });
          return h('tr', {}, h('td', {}, timeOf(w.at)), h('td', {}, w.contact), h('td', {}, w.role), h('td', { style: 'white-space:normal;min-width:180px' }, w.note || '-'), h('td', {}, del));
        })))) : h('div', { class: 'adm-leg' }, '아직 없어요.'));

    /* CSV */
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const download = (name, rows) => {
      const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
      const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
    };
    const today = new Date().toISOString().slice(0, 10);
    const csvFb = h('button', { type: 'button', class: 'btn' }, '의견·후기 CSV');
    csvFb.addEventListener('click', () => {
      const rows = [['구분', '테스터', '코드', '날짜', '기능', '모드', '맞았나', 'AI같았나', '새생각', '한줄의견/후기', '하는 일', '실어도됨', '랜딩후보', ...RV_Q.map((x) => x.q)]];
      testers.forEach((t) => ((t.feedback && t.feedback.entries) || []).forEach((e) => rows.push(['의견', label(t), t.code || '', ymdOf(e.at), e.feature, e.mode, e.fit, e.aiLike, e.newThought, e.note, '', '', ''])));
      rvs.forEach((t) => { const r = t.feedback.review; rows.push(['후기', label(t), t.code || '', ymdOf(r.at), '', '', '', '', '', r.text, roleOf(r), r.consent ? '예' : '아니오', appr[t.uid] ? '예' : '아니오', ...RV_Q.map((x) => (r.answers || {})[x.k] || '')]); });
      download('sokmal-feedback-' + today + '.csv', rows);
    });
    const csvWait = h('button', { type: 'button', class: 'btn' }, '대기 명단 CSV');
    csvWait.addEventListener('click', () => {
      const rows = [['남긴 때', '연락처', '종류', '하는 일', '한 줄']];
      (d.waitlist || []).forEach((w) => rows.push([w.at, w.contact, w.kind === 'email' ? '이메일' : '휴대폰', w.role, w.note]));
      download('sokmal-waitlist-' + today + '.csv', rows);
    });
    const csvCalls = h('button', { type: 'button', class: 'btn' }, 'AI 호출 CSV');
    csvCalls.addEventListener('click', () => {
      const rows = [['시간', '테스터', '코드', '기능', '모델', '입력', '캐시 읽기', '캐시 쓰기', '출력', '비용(원)', '결과']];
      (d.calls || []).forEach((c) => { const t = byUid[c.uid]; rows.push([c.at, who(c.uid), t && t.code ? t.code : '', c.feature, c.model, c.inputTokens, c.cacheReadTokens, c.cacheWriteTokens, c.outputTokens, c.costKrw, (STATUS[c.status] || c.status) + (c.detail ? ' · ' + c.detail : '')]); });
      download('sokmal-ai-calls-' + today + '.csv', rows);
    });

    /* 독백 지침 스위치 (11-27): 켜고 끄며 비교. 바로 다음 독백부터 모든 테스터에게 적용 */
    const sw = Object.assign({ monoRules: true, monoExamples: true }, d.switches || {});
    const swRow = (key, title, desc) => {
      const box = h('input', { type: 'checkbox', id: 'sw-' + key, role: 'switch' });
      box.checked = !!sw[key];
      const state = h('b', { class: 'sw-state' }, sw[key] ? '켜짐' : '꺼짐');
      box.addEventListener('change', async () => {
        box.disabled = true;
        const r = await api('POST', { switches: { [key]: box.checked } }).catch(() => ({ status: 0 }));
        box.disabled = false;
        if (r.status === 200 && r.j.switches) {
          Object.assign(sw, r.j.switches); d.switches = sw;
          state.textContent = sw[key] ? '켜짐' : '꺼짐';
          toast(title + (sw[key] ? ' 켰어요' : ' 껐어요') + '. 다음 독백부터 적용돼요');
        } else { box.checked = !box.checked; toast('바꾸지 못했어요. 다시 눌러 주세요'); }
      });
      return h('label', { class: 'sw-row', for: 'sw-' + key }, box, h('span', { class: 'sw-txt' }, h('b', {}, title), h('span', {}, desc)), state);
    };
    const swCard = h('div', { class: 'card sw-card' }, h('h3', {}, '독백 지침 스위치'),
      h('p', { class: 'adm-leg' }, '끄면 바로 다음 독백부터 모든 테스터에게 적용돼요. AI 호출 기록에 "(지침 끔)"처럼 표시돼서 나중에 비교할 수 있어요.'),
      swRow('monoRules', '쓰는 기준', '기본 7줄. 아래 「제작 기준」을 넣으면 그 기준으로 바뀌어요'),
      swRow('monoExamples', '송무 예시 독백 5편', '말의 감각을 참고하라고 함께 보내는 예시'),
      h('p', { class: 'adm-leg' }, '둘 다 꺼도 배우의 재료(이야기·답)와 결과 형식은 그대로 보내요.'));

    /* 기준 (11-27 독백, 11-28 해석·내 이미지·연기 대화): 한글 그대로 넣고 저장 → 다음 호출부터 적용 */
    const g = Object.assign({ make: '', review: '', reviewOn: false, exam: '', pro: '', image: '', talk: '', updatedAt: null }, d.guide || {});
    const ta = (id, v, ph) => { const t = h('textarea', { class: 'guide-ta', id, placeholder: ph, maxlength: '30000' }); t.value = v || ''; return t; };
    const cnt = (t) => { const c = h('span', { class: 'adm-leg' }); const f = () => { c.textContent = t.value.length.toLocaleString('ko-KR') + ' / 30,000자'; }; t.addEventListener('input', f); f(); return c; };
    const T = {
      make: ta('guide-make', g.make, '여기에 「창작 독백 제작 기준」을 붙여 넣어요. 비워 두면 기본 7줄로 써요.'),
      review: ta('guide-review', g.review, '여기에 「평가 및 검수 기준」을 붙여 넣어요. 비워 두면 검수하지 않아요.'),
      exam: ta('guide-exam', g.exam, '입시 해석에 더할 기준. 비워 두면 기본 지침만 써요.'),
      pro: ta('guide-pro', g.pro, '전문 해석(주고받기)에 더할 기준. 비워 두면 기본 지침만 써요.'),
      image: ta('guide-image', g.image, '내 이미지에 더할 기준. 비워 두면 기본 지침만 써요.'),
      talk: ta('guide-talk', g.talk, '연기 대화의 기준. 비워 두면 기본 원칙(원리는 분명히, 선택은 여러 갈래, 연기 방식은 정해 주지 않음)만 써요.'),
    };
    const revOn = h('input', { type: 'checkbox', id: 'guide-review-on', role: 'switch' }); revOn.checked = !!g.reviewOn;
    const saveG = h('button', { type: 'button', class: 'btn primary' }, '기준 저장');
    saveG.addEventListener('click', async () => {
      saveG.disabled = true;
      const body = { reviewOn: revOn.checked };
      Object.keys(T).forEach((k) => { body[k] = T[k].value; });
      const r = await api('POST', { guide: body }).catch(() => ({ status: 0 }));
      saveG.disabled = false;
      if (r.status === 200 && r.j.guide) { d.guide = r.j.guide; toast('기준을 저장했어요. 다음 호출부터 적용돼요'); render(d); } else toast('저장하지 못했어요. 다시 눌러 주세요');
    });
    const fld = (label, k) => [h('label', { class: 'f', for: T[k].id }, label), T[k], cnt(T[k])];
    const PANES = [
      ['mono', '독백', [...fld('창작 독백 제작 기준', 'make'), ...fld('평가 및 검수 기준', 'review'),
        h('label', { class: 'sw-row', for: 'guide-review-on' }, revOn, h('span', { class: 'sw-txt' }, h('b', {}, '검수 단계 켜기'), h('span', {}, '1차로 쓴 독백을 검수 기준으로 평가·수정해 최종본만 배우에게 보내요. AI를 두 번 불러 시간·비용이 약 두 배예요.')))]],
      ['exam', '해석 입시', fld('입시 해석 기준 (기본 지침 끝에 덧붙음)', 'exam')],
      ['pro', '해석 전문', fld('전문 해석 기준 (기본 지침 끝에 덧붙음)', 'pro')],
      ['image', '내 이미지', fld('내 이미지 기준 (기본 지침 끝에 덧붙음)', 'image')],
      ['talk', '연기 대화', fld('연기 대화 기준', 'talk')],
    ];
    window.__gTab = window.__gTab || 'mono';
    const panes = {};
    const tabs = h('div', { class: 'seg guide-tabs', role: 'tablist' }, PANES.map(([k, label]) => {
      const b = h('button', { type: 'button', role: 'tab', 'data-k': k, class: window.__gTab === k ? 'on' : '' }, label + ((k === 'mono' ? g.make || g.review : g[k]) ? ' •' : ''));
      b.addEventListener('click', () => { window.__gTab = k; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); Object.entries(panes).forEach(([pk, el]) => { el.hidden = pk !== k; }); });
      return b;
    }));
    PANES.forEach(([k, , kids]) => { panes[k] = h('div', { class: 'guide-pane', 'data-k': k, hidden: window.__gTab !== k }, kids); });
    const gCard = h('div', { class: 'card' }, h('h3', {}, '기준 (독백 · 해석 · 내 이미지 · 연기 대화)'),
      h('p', { class: 'adm-leg' }, '한글 그대로 붙여 넣고 저장하면 바로 다음 호출부터 적용돼요. 다시 배포할 필요 없어요. • 표시는 기준이 들어 있는 탭이에요. 위 스위치에서 「쓰는 기준」을 끄면 독백 제작 기준도 함께 꺼져요.' + (g.updatedAt ? ' 마지막 저장: ' + timeOf(g.updatedAt) : '')),
      tabs, ...Object.values(panes),
      h('div', { class: 'out-acts' }, saveG));

    /* 검수 기록 (관리자만) */
    const rv = d.reviews || [];
    const rvsCard = h('div', { class: 'card' }, h('h3', {}, '독백 검수 기록 (최근 ' + rv.length + '건)'),
      rv.length ? null : h('div', { class: 'adm-leg' }, '아직 없어요. 검수 단계를 켜면 독백마다 여기에 남아요.'),
      ...rv.map((x) => h('details', { class: 'adm-row' },
        h('summary', {}, timeOf(x.at) + ' · ' + who(x.uid) + ' · ' + x.feature + ' · 점수 ' + (x.before ?? '?') + ' → ' + (x.after ?? '?') + (x.used ? '' : ' · 형식이 깨져 1차본을 보냄')),
        h('div', { class: 'adm-leg', style: 'margin-top:8px' }, '검수'), h('pre', { class: 'guide-pre' }, x.review),
        h('div', { class: 'adm-leg' }, '1차 독백'), h('pre', { class: 'guide-pre' }, x.draft),
        h('div', { class: 'adm-leg' }, '최종 (배우가 받은 것)'), h('pre', { class: 'guide-pre' }, x.final))));

    body.replaceChildren(
      ...notes.map((n) => h('div', { class: 'note warn' }, n)),
      swCard, gCard, rvsCard, stats, tCard, cCard, ind, sv, rvCard, nCard, wCard,
      h('div', { class: 'out-acts', style: 'margin:16px 0 40px' }, csvFb, csvCalls, csvWait),
      h('p', { class: 'adm-leg' }, '저장소: ' + ({ redis: 'Upstash Redis', supabase: 'Supabase', file: '내 컴퓨터 파일', memory: '서버 메모리(꺼지면 사라짐)' }[m.storage] || m.storage) + ' · AI: ' + (m.provider === 'openai' ? 'OpenAI' : 'Anthropic')));
  }

  if (getCode()) load(); else showLogin('');
})();
