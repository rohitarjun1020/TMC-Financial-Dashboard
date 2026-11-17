/* TMC Financial Dashboard — page logic. Every figure comes from TMC_DATA through TMCModel. */
(function () {
  'use strict';
  const D = typeof TMC_DATA !== 'undefined' ? TMC_DATA : window.TMC_DATA, M = TMCModel.create(D), A = TMCAsk.create(M), CH = TMCCharts, I18N = window.TMC_I18N;
  const ASK_CLAUDE_URL = 'https://claude.ai/artifact/X21128BiwquoeoyaZx2B1P';
  /* passcode gate: casual protection only (the site itself is public). SHA-256 of the passcode. */
  const PASS_HASH = 'c9663751379a66a3cb69282511350f6ba452ebf044c4709ba57175a763a4189d';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (v, dp) => M.lakh(v, dp), INR = v => M.inr(v);
  const store = { get(k, d) { try { const v = localStorage.getItem('tmc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tmc.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };

  /* ---------------- state ---------------- */
  const SC = ['none', 'high', 'med', 'all'];
  const S = {
    tab: 'brief', lang: 'en',
    mis: { period: 'ytd', budget: store.get('misBudget', false), line: null },
    cf: { month: store.get('cfMonth', M.asOfMonth || M.lastActual), b2b: 'none', rtd: 'none', split: false },
    tr: { from: M.cfMonths[Math.max(0, M.cfMonths.indexOf(M.lastActual) - 12)], to: M.cfMonths[M.cfMonths.length - 1], b2b: store.get('scen', 'high'), rtd: store.get('scen', 'high'), split: false }
  };
  if (!M.cfMonths.includes(S.cf.month)) S.cf.month = M.asOfMonth || M.lastActual;
  const t = (k, vars) => { let s = (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k; if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]); return s; };
  const mShort = m => { const [mn, yr] = m.split('-'); return I18N.months[S.lang][M.MON.indexOf(mn)] + ' ' + yr.slice(2); };
  const mLong = m => { const [mn, yr] = m.split('-'); return I18N.months[S.lang + 'L'][M.MON.indexOf(mn)] + ' ' + yr; };
  const statusName = s => t({ actual: 'statusActual', progress: 'statusProgress', forecast: 'statusForecast' }[s]);
  const scenName = k => t('scenFull')[k];
  const SCOL = { none: '--s-none', high: '--s-high', med: '--s-med', all: '--s-all' };

  /* ---------------- icons (authored, one stroke weight) ---------------- */
  const ICON = {
    check: '<path d="M4 12.5l5 5L20 6.5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', send: '<path d="M4 12l16-8-6 16-2-7z"/>', refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/>', table: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M9.5 10v9"/>'
  };
  const icon = (k, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  /* ---------------- shared bits ---------------- */
  function proof(live, said) {
    if (said == null) return '';
    return Math.abs(live - said) <= 2 ? `<span class="proof">${icon('check')}${esc(t('asNarrated'))}</span>`
      : `<span class="proof chg">${esc(t('updatedVideo', { v: L(said) }))}</span>`;
  }
  function field(label, value, sub, opts) {
    const o = opts || {};
    return `<div class="field ${o.lead ? 'lead' : ''}"><label>${esc(label)}</label><span class="v ${value < 0 ? 'neg' : ''} ${o.text ? 'txt' : ''}">${esc(o.text || L(value))}</span>${sub ? `<small>${sub}</small>` : ''}${o.proof || ''}</div>`;
  }
  function stampChip(status) {
    return `<span class="chip-stamp ${status}">${status === 'actual' ? icon('check') : ''}${esc(statusName(status))}</span>`;
  }
  function bigStamp(status, m, extra, cls) {
    const word = statusName(status);
    return `<span class="stamp ${status} ${cls || ''}" style="--d:86px;--r:-9deg" role="img" aria-label="${esc(word + ' ' + mLong(m))}">${esc(word)}<b>${esc(mShort(m))}</b>${esc(extra || (status === 'actual' ? t('bankOk') : status === 'progress' ? (M.asOfText || '') : ''))}</span>`;
  }
  function rank(items, opts) {
    const o = opts || {}, max = Math.max(...items.map(i => Math.abs(i.a)), 1);
    return `<div class="rank">${items.map((i, k) => `<div class="rank-row">${o.button ? `<button class="l" data-k="${k}" aria-expanded="false">${icon('chev')}${esc(i.label)}</button>` : `<span class="l" title="${esc(i.label)}">${esc(i.label)}</span>`}<span class="track"><i style="width:${(Math.abs(i.a) / max * 100).toFixed(1)}%;--c:var(${i.color || o.color || '--brand'})"></i></span><span class="a">${esc(o.full ? INR(i.a) : L(i.a))}</span></div>`).join('')}</div>`;
  }
  function tableHTML(cols, rows, opts) {
    const o = opts || {};
    return `<div class="tbl-wrap"><table class="t">${o.caption ? `<caption class="sr">${esc(o.caption)}</caption>` : ''}<thead><tr>${cols.map((c, i) => `<th class="${o.num && o.num[i] ? 'n' : ''}" scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr class="${r.cls || ''}">${r.cells.map((c, i) => `<td class="${o.num && o.num[i] ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function tableToggle(host, cols, rows, num) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<button class="linkish table-toggle" aria-expanded="false">${icon('table')}<span>${esc(t('showTable'))}</span></button><div hidden></div>`;
    const btn = wrap.firstChild, box = wrap.lastChild;
    btn.addEventListener('click', () => {
      const open = box.hidden; box.hidden = !open; btn.setAttribute('aria-expanded', open);
      btn.querySelector('span').textContent = t(open ? 'hideTable' : 'showTable');
      if (open && !box.innerHTML) box.innerHTML = tableHTML(cols, rows, { num });
    });
    host.appendChild(wrap);
  }
  function scenControl(st, onChange, idp) {
    const segs = SC.map(k => { const sk = M.scenarioKey(k); return `<button type="button" class="two" data-s="${k}" aria-pressed="${!st.split && st.b2b === k && st.rtd === k}" title="${esc(sk.text)}"><i class="key" style="background:var(${SCOL[k]})"></i><span>${esc(scenName(k))}<small>${esc(sk.adds)}</small></span></button>`; }).join('');
    const opt = v => SC.map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc({ none: t('none'), high: 'Highly Likely', med: '+ Medium Likely', all: '+ Low Likely' }[k])}</option>`).join('');
    const html = `<div class="seg" role="group" aria-label="${esc(t('scenario'))}">${segs}</div>
      <button type="button" class="switch" role="switch" aria-checked="${st.split}" id="${idp}-split"><i></i>${esc(t('separately'))}</button>
      <span id="${idp}-sel" ${st.split ? '' : 'hidden'} style="display:${st.split ? 'inline-flex' : 'none'};gap:10px;flex-wrap:wrap">
        <label>${esc(t('b2bTier'))}<select data-k="b2b">${opt(st.b2b)}</select></label><label>${esc(t('rtdTier'))}<select data-k="rtd">${opt(st.rtd)}</select></label></span>`;
    return { html, bind(root) {
      $$('.seg button', root).forEach(b => b.addEventListener('click', () => { st.b2b = st.rtd = b.dataset.s; st.split = false; store.set('scen', b.dataset.s); onChange(); }));
      $('#' + idp + '-split', root).addEventListener('click', () => { st.split = !st.split; onChange(); });
      $$('#' + idp + '-sel select', root).forEach(s => s.addEventListener('change', () => { st[s.dataset.k] = s.value; onChange(); }));
    } };
  }
  function scenKey(st, idp) {
    const k = st.split ? null : st.b2b, sk = k ? M.scenarioKey(k) : null;
    const now = k ? `<b><i style="background:var(${SCOL[k]})"></i>${esc(scenName(k))} · ${esc(sk.adds)}</b><span>${esc(sk.text)}</span>`
      : `<b>${esc(scenLabel(st))}</b><span>B2B and RTD pipelines set separately.</span>`;
    return `<div class="skey">${now}<button class="linkish" aria-expanded="false" id="${idp}-skey">What the scenarios mean</button>
      <div class="skey-all" hidden>${SC.map(x => { const q = M.scenarioKey(x); return `<div><strong><i style="background:var(${SCOL[x]})"></i>${esc(scenName(x))}</strong>${esc(q.text)}</div>`; }).join('')}</div></div>`;
  }
  function bindKey(root, idp) {
    const b = $('#' + idp + '-skey', root); if (!b) return;
    b.addEventListener('click', () => { const box = b.nextElementSibling, open = box.hidden; box.hidden = !open; b.setAttribute('aria-expanded', open); b.textContent = open ? 'Hide' : 'What the scenarios mean'; });
  }
  const scenLabel = st => st.b2b === st.rtd ? scenName(st.b2b) : `B2B ${({ none: t('none'), high: 'HL', med: 'HL+ML', all: 'All' })[st.b2b]} · RTD ${({ none: t('none'), high: 'HL', med: 'HL+ML', all: 'All' })[st.rtd]}`;

  /* ---------------- shell ---------------- */
  const TABS = [['brief', 'tabBrief'], ['mis', 'tabMis'], ['cf', 'tabCf'], ['trends', 'tabTrends'], ['whatif', 'tabWhatIf'], ['ask', 'tabAsk']];
  function renderShell() {
    document.documentElement.lang = S.lang;
    $('#brand-sub').textContent = t('sub');
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab" role="tab" id="tab-${k}" aria-controls="page-${k}" aria-selected="${S.tab === k}" tabindex="${S.tab === k ? 0 : -1}" data-tab="${k}">${esc(t(l))}</button>`).join('');
    $('#asof').innerHTML = `${esc(t('asofCf'))} <b>${esc(M.asOfText)}</b><br>${esc(t('asofMis'))} <b>${esc(mLong(M.lastMis))}</b>`;
    $$('#lang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === S.lang));
    $('#theme').setAttribute('aria-label', t('theme')); $('#theme').title = t('theme');
    $('#lock').setAttribute('aria-label', t('lock')); $('#lock').title = t('lock');
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    $('#theme').innerHTML = icon(dark ? 'sun' : 'moon');
    $('#lock').innerHTML = icon('lock');
    $('#foot').innerHTML = `<span>${esc(t('preparedBy'))}</span><span>${esc(t('figuresNote'))}</span>`;
    $$('#tabs .tab').forEach(b => {
      b.addEventListener('click', () => go(b.dataset.tab));
      b.addEventListener('keydown', e => {
        const i = TABS.findIndex(x => x[0] === b.dataset.tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]; go(n); $('#tab-' + n).focus(); e.preventDefault(); }
      });
    });
  }
  const rendered = {};
  function go(tab, opts) {
    if (!TABS.some(x => x[0] === tab)) tab = 'brief';
    S.tab = tab;
    TABS.forEach(([k]) => { const p = $('#page-' + k); p.hidden = k !== tab; });
    $$('#tabs .tab').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    if (tab !== 'brief') { const v = $('#bvideo'); if (v && !v.paused) v.pause(); }
    if (!rendered[tab] || (opts && opts.force)) { RENDER[tab](); rendered[tab] = true; }
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    if (!(opts && opts.keepScroll)) window.scrollTo({ top: 0 });
  }
  function rerenderAll() { Object.keys(rendered).forEach(k => delete rendered[k]); renderShell(); go(S.tab, { keepScroll: true }); }

  /* ================= BRIEFING ================= */
  const B = M.brief;
  let chapter = -1, started = false;
  function briefFields() {
    const N = (B && B.narrated) || {}, mp = B && B.monthPanel, end = M.horizonEnd, tb = M.turns('none');
    const cur = mp ? mp.m : M.asOfMonth, prev = mp ? mp.prev : M.lastActual, b = M.scen('none').find(r => r.m === cur);
    return `<div class="fields" style="--cols:5">
      ${field(t('cashToday'), M.closing('none', prev), esc(mLong(prev) + ', bank-tallied'), { lead: true })}
      ${field(mLong(cur) + ' ' + t('closeOf'), b.cb, esc(t('inOut', { in: L(b.rc), out: L(b.out) })))}
      ${tb.pinch ? field(t('pinch'), tb.pinch.cb, esc(mLong(tb.pinch.m))) : ''}
      ${field(mLong(end) + ' · ' + t('baseCase'), M.closing('none', end), esc(t('noPipeline')))}
      ${field(mLong(end) + ' · ' + t('scen1'), M.closing('high', end), esc('Highly Likely deals'))}
    </div>`;
  }
  function briefProof() {
    const N = (B && B.narrated) || {}, mp = B && B.monthPanel, end = M.horizonEnd, tb = M.turns('none');
    if (!mp) return '';
    const pairs = [[M.closing('none', mp.prev), N.prevClose], [M.closing('none', mp.m), N.monthClose], [tb.pinch && tb.pinch.cb, N.febClose], [M.closing('none', end), N.marBase], [M.closing('high', end), N.marS1]].filter(p => p[1] != null);
    const ok = pairs.filter(p => Math.abs(p[0] - p[1]) <= 2).length;
    return ok === pairs.length ? `<span class="dp-proof">${icon('check')}All ${pairs.length} figures match the ${esc(M.asOfText)} video</span>`
      : `<span class="dp-proof chg">${ok} of ${pairs.length} figures match the video; the rest have been updated since</span>`;
  }
  function verdictHTML() {
    const v = M.verdict(), prevM = m => mLong(M.fromIdx(M.idx(m) - 1));
    if (v.positiveBase) return `Cash stays positive through ${esc(mLong(v.end))} on confirmed business alone.`;
    const n = v.negative;
    const save = v.save ? `<strong>${esc(mLong(n.m))} needs the ${esc(scenName(v.save))} deals</strong> to stay above zero.` : `<strong>${esc(mLong(n.m))} goes below zero even with every pipeline deal.</strong>`;
    return `Cash holds until ${esc(prevM(n.m))} on confirmed business. ${save} <button class="linkish" id="go-whatif">Try a what-if ${icon('arrow')}</button>`;
  }
  function watchHTML() {
    const w = M.watch().slice(0, 4);
    if (!w.length) return '';
    return `<section class="watch" aria-labelledby="h-watch"><h2 class="h2" id="h-watch">Watch</h2><ul>${w.map(x => `<li class="${x.level}"><span class="dot" aria-hidden="true"></span><div><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div></li>`).join('')}</ul></section>`;
  }
  function renderBrief() {
    const p = $('#page-brief');
    if (!B) { p.innerHTML = `<section class="dp"><div class="dp-head"><h1 class="title">${esc(t('cashPosition'))}</h1></div>${briefFields()}</section>`; return; }
    const dur = B.duration, mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const ends = B.chapters.map((c, k) => k + 1 < B.chapters.length ? B.chapters[k + 1].t : dur);
    p.innerHTML = `
      <section class="dp" aria-labelledby="h-brief">
        <div class="dp-head"><h1 class="title" id="h-brief">${esc(t('cashPosition'))}</h1><span style="display:grid;gap:6px;justify-items:end"><span class="dp-meta">${esc(t('basis'))} · ${esc(M.asOfText)}</span>${briefProof()}</span></div>
        <p class="verdict">${verdictHTML()}</p>
        ${briefFields()}
      </section>
      ${watchHTML()}
      <div class="brief">
        <section class="player" aria-label="${esc(t('briefingVideo'))}">
          <div class="player-v"><video id="bvideo" preload="metadata" playsinline controls src="${esc(B.video)}"></video>
            <button class="cover" id="bcover"><span class="play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg></span><strong>${esc(t('watch'))}</strong><span>${esc(t('narrated', { d: mmss(dur) }))}</span></button></div>
          <div class="rail" aria-hidden="true">${B.chapters.map((c, k) => `<button tabindex="-1" style="--w:${(ends[k] - c.t).toFixed(1)}" data-k="${k}"><i id="seg-${k}"></i></button>`).join('')}</div>
          <ol class="chapters" aria-label="${esc(t('chapters'))}">${B.chapters.slice(1).map((c, k) => `<li><button data-k="${k + 1}"><b>${esc(c.title)}</b><span>${mmss(c.t)}</span></button></li>`).join('')}</ol>
        </section>
        <aside class="live" id="live" aria-live="polite"></aside>
      </div>
      <div class="grid g-2e">
        <section class="panel"><div class="panel-h"><h2 class="h2">${esc(t('keyMessages'))}</h2></div><ol class="msgs">${B.keyMessages.map(m => `<li>${esc(m)}</li>`).join('')}</ol></section>
        <section class="panel"><div class="panel-h"><h2 class="h2">${esc(t('priorities'))}</h2></div><div class="prios">${B.priorities.map(x => `<div class="prio"><b>${esc(x.title)}</b><p><strong>${esc(x.hl)}</strong> ${esc(x.d)}</p></div>`).join('')}</div></section>
      </div>`;
    CH.guilloche($('.dp', p));
    if ($('#go-whatif')) $('#go-whatif').addEventListener('click', () => go('whatif'));
    const v = $('#bvideo');
    $('#bcover').addEventListener('click', () => { v.play().catch(() => {}); });
    v.addEventListener('play', () => { started = true; $('#bcover').hidden = true; });
    v.addEventListener('timeupdate', () => { const tt = v.currentTime; B.chapters.forEach((c, k) => { const e = $('#seg-' + k); if (e) e.style.width = Math.max(0, Math.min(1, (tt - c.t) / (ends[k] - c.t))) * 100 + '%'; }); setChapter(chapterAt(tt)); });
    v.addEventListener('seeked', () => setChapter(chapterAt(v.currentTime)));
    $$('.chapters button, .rail button', p).forEach(b => b.addEventListener('click', () => { const k = +b.dataset.k; v.currentTime = B.chapters[k].t + 0.05; setChapter(k, true); if (started) v.play().catch(() => {}); }));
    chapter = -1; setChapter(0, true);
  }
  const chapterAt = s => { let i = 0; B.chapters.forEach((c, k) => { if (s >= c.t) i = k; }); return i; };
  function lrow(label, live, said, sub) {
    return `<div class="lrow"><div class="l">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="v ${live < 0 ? 'neg' : ''}">${esc(L(live))}${proof(live, said)}</div></div>`;
  }
  function setChapter(k, force) {
    if (k === chapter && !force) return;
    chapter = k;
    $$('.chapters button').forEach(b => b.setAttribute('aria-current', +b.dataset.k === k));
    const c = B.chapters[k], N = B.narrated, mp = B.monthPanel, end = M.horizonEnd, endL = mShort(end);
    const hz = M.horizon.filter(m => M.idx(m) >= M.idx(mp.m));
    let body = '', note = '';
    const prevSc = B.prevMarch || {};
    switch (c.panel) {
      case 'intro': body = lrow(mLong(mp.prev), M.closing('none', mp.prev), N.prevClose, statusName('actual')) + lrow(mLong(mp.m), M.closing('none', mp.m), N.monthClose, statusName(M.status(mp.m))) + lrow(endL + ' · ' + scenName('none'), M.closing('none', end), N.marBase) + lrow(endL + ' · ' + scenName('high'), M.closing('high', end), N.marS1);
        note = 'Each figure is recalculated from the dashboard data, so you can see it ties to the video.'; break;
      case 'month': { const r = M.scen('none').find(x => x.m === mp.m); body = lrow(t('opening'), r.ob, N.prevClose) + lrow(t('receipts'), r.rc, N.monthRcpt) + lrow(t('payments'), r.out, N.monthOut) + lrow(t('closing'), r.cb, N.monthClose); break; }
      case 'base': { const tb = M.turns('none'); body = (tb.pinch ? lrow(t('pinch') + ' · ' + mShort(tb.pinch.m), tb.pinch.cb, N.febClose, t('lowestPositive')) : '') + lrow(endL + ' · ' + scenName('none'), M.closing('none', end), N.marBase); break; }
      case 's1': case 's2': case 's3': {
        const map = { s1: ['HighlyLikely', 'high', N.s1Net, N.marS1], s2: ['MediumLikely', 'med', N.s2Net, N.marS2], s3: ['LowLikely', 'all', N.s3Net, N.marS3] }[c.panel];
        body = lrow('Net contribution', M.tierNet(map[0], hz), map[2], `${mShort(hz[0])} – ${endL}`) + lrow(endL + ' · ' + scenName(map[1]), M.closing(map[1], end), map[3]); break; }
      case 'all': body = SC.map(s => { const v = M.closing(s, end), pv = prevSc[{ none: 'base', high: 's1', med: 's2', all: 's3' }[s]]; return lrow(endL + ' · ' + scenName(s), v, N[{ none: 'marBase', high: 'marS1', med: 'marS2', all: 'marS3' }[s]], pv != null ? `${v - pv >= 0 ? '+' : '−'}${L(Math.abs(v - pv))} vs ${B.prevLabel || 'previous update'}` : ''); }).join(''); break;
      case 'prio': body = lrow(t('receipts') + ' · ' + mShort(mp.m), M.scen('none').find(x => x.m === mp.m).rc, N.monthRcpt) + lrow(t('payments') + ' · ' + mShort(mp.m), M.scen('none').find(x => x.m === mp.m).out, N.monthOut); break;
    }
    const link = c.link ? `<button class="btn" id="explore" style="margin-top:12px">${esc(t('openIn', { x: c.link.page === 'cf' ? mLong(c.link.month) : t('tabTrends') + ' · ' + scenName(c.link.scen) }))} ${icon('arrow')}</button>` : '';
    $('#live').innerHTML = `<div class="live-k"><i></i>${esc(t('liveFrom'))}</div><h3>${esc(c.title)}</h3><div class="sub">${esc(c.sub)}</div>${body}${link}${note ? `<p class="note">${esc(note)}</p>` : ''}`;
    if (c.link) $('#explore').addEventListener('click', () => {
      const v = $('#bvideo'); if (!v.paused) v.pause();
      if (c.link.page === 'cf') { S.cf.month = c.link.month; S.cf.b2b = S.cf.rtd = 'none'; S.cf.split = false; delete rendered.cf; go('cf'); }
      else { S.tr.b2b = S.tr.rtd = c.link.scen; S.tr.split = false; delete rendered.trends; go('trends'); }
    });
  }

  /* ================= P&L (MIS) ================= */
  function misPeriods() {
    const fys = [...new Set(M.misMonths.map(M.fyOf))].reverse();
    const opts = [{ v: 'ytd', l: `${t('ytd')} · ${mShort(M.ytd[0])} – ${mShort(M.ytd[M.ytd.length - 1])}`, ms: M.ytd }];
    fys.forEach(f => { if (f !== M.curFY) opts.push({ v: f, l: f.replace('FY', S.lang === 'de' ? 'GJ' : 'FY'), ms: M.fyMonths(f, M.misMonths) }); });
    [...M.misMonths].reverse().forEach(m => opts.push({ v: m, l: mLong(m), ms: [m] }));
    return opts;
  }
  const LINE_NAME = { 'Revenue from B2B training': 'B2B language training', 'Revenue From RTD - Training': 'RTD training', 'Revenue From RTD - Placement': 'RTD placement',
    'Cost of Training - RTD': 'RTD training cost', 'Project Expense - CCT Videos': 'CCT video project cost', 'COGS-Manpowers Cost': 'Operations salaries', 'B2B - Training Cost': 'Trainer fees (B2B)',
    'Marketing Costs': 'Marketing', 'Website & Software Costs': 'Website & software', 'S&M-Manpower Costs': 'S&M salaries', 'Travel Costs': 'Travel', 'S&M Consultants': 'S&M consultants',
    'Recruitment Consultant Expense': 'Recruitment consultants', 'S&M-Miscellaneous Costs': 'Other S&M', 'Office Rent': 'Office rent', 'Office Maintainance': 'Office maintenance',
    'G&A-Manpower Costs': 'G&A salaries', 'G&A-Professional Fees': 'Professional & legal fees', 'Recruitment Fees': 'Recruitment fees', 'G&A-Miscellaneous Costs': 'Other G&A', 'Other Income ': 'Other income', 'Other Income': 'Other income' };
  const lineName = p => LINE_NAME[p] || LINE_NAME[p.trim()] || p.trim();
  function renderMIS() {
    const p = $('#page-mis'), per = misPeriods(), cur = per.find(o => o.v === S.mis.period) || per[0], ms = cur.ms;
    const pl = M.pl(ms), bd = M.budget(ms), showB = S.mis.budget && bd.has;
    const varCell = (a, b, cost) => { if (!showB || b == null) return ''; const d = a - b, good = cost ? d <= 0 : d >= 0; return `<span class="${good ? 'var-pos' : 'var-neg'}">${d >= 0 ? '+' : '−'}${esc(L(Math.abs(d)))}</span>`; };
    const opex = pl.sm + pl.ga;
    p.innerHTML = `
      <div class="toolbar"><label>${esc(t('period'))}<select id="mis-period">${per.map(o => `<option value="${o.v}" ${o.v === cur.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>
        <button class="switch" role="switch" id="mis-budget" aria-checked="${S.mis.budget}"><i></i>${esc(t('compareBudget'))}</button>${S.mis.budget && !bd.has ? `<span class="lede">${esc(t('noBudget'))}</span>` : ''}</div>
      <section class="dp" aria-labelledby="h-mis">
        <div class="dp-head"><h1 class="title" id="h-mis">${esc(t('pl'))}</h1><span class="dp-meta">${esc(t('plSub'))} · ${esc(cur.l)}</span></div>
        <div class="fields" style="--cols:5">
          ${field(t('revenue'), pl.revenue, bd.has ? esc(`${M.pct(pl.revenue, bd.revenue, 0)} of the ${L(bd.revenue)} budget`) : '', { lead: true, proof: `<span class="proof">${icon('check')}${esc(t('tiesTo', { src: 'MIS · ' + mLong(M.lastMis) }))}</span>` })}
          ${field(t('grossProfit'), pl.gp, esc(t('margin', { p: M.pct(pl.gp, pl.revenue) })))}
          ${field(t('ebitda'), pl.ebitda, esc(t('ofRevenue', { p: M.pct(pl.ebitda, pl.revenue) })) + (bd.has ? ' · ' + esc(`${t('budget')} ${L(bd.ebitda)}`) : ''))}
          ${field(t('opex'), opex, esc(`S&M ${L(pl.sm)} · G&A ${L(pl.ga)}`))}
          ${field(t('salariesDept'), M.misSalaries(ms).reduce((a, s) => a + s.a, 0), esc(t('ofRevenue', { p: M.pct(M.misSalaries(ms).reduce((a, s) => a + s.a, 0), pl.revenue) })))}
        </div></section>
      <div class="grid g-2">
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('statement'))}</h2></div></div><div id="mis-stmt"></div></section>
        <div class="grid">
          <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('customers'))}</h2><p>${esc(cur.l)}</p></div></div><div id="mis-cust"></div></section>
          <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('salariesDept'))}</h2><p>${esc(cur.l)}</p></div></div><div id="mis-sal"></div></section>
        </div>
      </div>
      <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('revByMonth'))}</h2><p>${esc(t('revByMonthSub'))}</p></div><div class="legend"><span><i class="box" style="background:var(--c-rec)"></i>${esc(t('revenue'))}</span><span><i style="background:var(--s-none)"></i>${esc(t('ebitda'))}</span></div></div><div id="mis-rev"></div></section>
      <div class="grid g-2e">
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('costsByDept'))}</h2><p>FY ${esc(M.curFY.slice(3))}</p></div><div class="legend"><span><i class="box" style="background:var(--s-high)"></i>COGS</span><span><i class="box" style="background:var(--s-med)"></i>S&amp;M</span><span><i class="box" style="background:var(--s-all)"></i>G&amp;A</span></div></div><div id="mis-dept"></div></section>
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('ledger'))}</h2><p id="ledger-for">${esc(S.mis.line ? t('ledgerFor', { x: lineName(S.mis.line) }) : t('ledgerAll'))}</p></div>${S.mis.line ? `<button class="linkish" id="ledger-clear">${esc(t('clear'))}</button>` : ''}</div><div id="mis-ledger"></div></section>
      </div>`;
    CH.guilloche($('.dp', p));
    $('#mis-period').addEventListener('change', e => { S.mis.period = e.target.value; S.mis.line = null; renderMIS(); });
    $('#mis-budget').addEventListener('click', () => { S.mis.budget = !S.mis.budget; store.set('misBudget', S.mis.budget); renderMIS(); });
    if ($('#ledger-clear')) $('#ledger-clear').addEventListener('click', () => { S.mis.line = null; renderMIS(); });

    // statement
    const rows = [], cols = [t('statement'), t('actual'), t('pctRev')].concat(showB ? [t('budget'), t('variance')] : []), num = [0, 1, 1, 1, 1];
    const sec = (title) => rows.push({ cls: 'hd', cells: [esc(title)].concat(cols.slice(1).map(() => '')) });
    const add = (l, cost) => { const b = bd.lines[l.d + '|' + l.p]; rows.push({ cls: cost ? 'click' + (S.mis.line === l.p ? ' on' : '') : '', key: l.p, cells: [esc(lineName(l.p)), esc(INR(l.a)), esc(M.pct(l.a, pl.revenue)), ...(showB ? [b == null ? '—' : esc(INR(b)), varCell(l.a, b, cost)] : [])] }); };
    const tot = (label, a, b, cost) => rows.push({ cls: 'tot', cells: [esc(label), `<span class="${a < 0 ? 'neg' : ''}">${esc(INR(a))}</span>`, esc(M.pct(a, pl.revenue)), ...(showB ? [esc(INR(b)), varCell(a, b, cost)] : [])] });
    sec(t('revenue')); pl.lines.filter(l => l.d === 'Revenue').forEach(l => { if (l.a || bd.lines[l.d + '|' + l.p]) add(l); });
    tot(t('revenue'), pl.revenue, bd.revenue);
    sec('Direct costs'); pl.lines.filter(l => l.d === 'COGS').forEach(l => { if (l.a || bd.lines[l.d + '|' + l.p]) add(l, true); });
    tot(t('grossProfit'), pl.gp, bd.gp);
    sec('Sales & marketing'); pl.lines.filter(l => l.d === 'S&M').forEach(l => { if (l.a || bd.lines[l.d + '|' + l.p]) add(l, true); });
    sec('General & admin'); pl.lines.filter(l => l.d === 'G&A').forEach(l => { if (l.a || bd.lines[l.d + '|' + l.p]) add(l, true); });
    tot(t('ebitda'), pl.ebitda, bd.ebitda);
    if (pl.otherIncome) rows.push({ cls: 'sub', cells: [esc(t('otherIncome')), esc(INR(pl.otherIncome)), '', ...(showB ? ['', ''] : [])] });
    $('#mis-stmt').innerHTML = tableHTML(cols, rows, { num, caption: t('statement') });
    $$('#mis-stmt tr.click').forEach((tr, i) => {
      const key = rows.filter(r => r.cls && r.cls.startsWith('click'))[i].key;
      tr.tabIndex = 0; tr.setAttribute('role', 'button');
      const pick = () => { S.mis.line = S.mis.line === key ? null : key; renderMIS(); $('#mis-ledger').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
      tr.addEventListener('click', pick); tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    // customers
    const cust = M.customers(ms);
    $('#mis-cust').innerHTML = cust.length ? rank(cust, { color: '--c-rec' }) : '<p class="lede">—</p>';
    // salaries
    const sal = M.misSalaries(ms), salT = sal.reduce((a, s) => a + s.a, 0), sc = { 'COGS-Manpowers Cost': '--s-high', 'S&M-Manpower Costs': '--s-med', 'G&A-Manpower Costs': '--s-all' };
    $('#mis-sal').innerHTML = `<div class="segbar" role="img" aria-label="${esc(sal.map(s => s.label + ' ' + L(s.a)).join(', '))}">${sal.map(s => `<span style="flex:${s.a} 1 0;background:var(${sc[s.dept]})">${s.a / salT > 0.14 ? Math.round(s.a / salT * 100) + '%' : ''}</span>`).join('')}</div>` + rank(sal.map(s => ({ label: s.label, a: s.a, color: sc[s.dept] })));
    // revenue + EBITDA by month (current and previous FY)
    const rms = M.misMonths.slice(-Math.min(M.misMonths.length, 19));
    const plm = rms.map(m => M.pl([m]));
    CH.columns($('#mis-rev'), { months: rms, height: 280, label: 'Revenue and EBITDA by month', up: [{ label: t('revenue'), color: '--c-rec', values: plm.map(x => x.revenue) }],
      line: { label: t('ebitda'), color: '--s-none', values: plm.map(x => x.ebitda) }, down: [], fmtAxis: v => (Math.abs(v) / 1e5 % 1 ? (v / 1e5).toFixed(1) : (v / 1e5).toFixed(0)) + 'L', fmtTip: v => L(v), fmtMonth: mShort, fmtTipHead: mLong, keepZero: true,
      onPick: m => { S.mis.period = m; S.mis.line = null; renderMIS(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    tableToggle($('#mis-rev'), [t('month'), t('revenue'), t('ebitda')], rms.map((m, i) => ({ cells: [esc(mLong(m)), esc(INR(plm[i].revenue)), esc(INR(plm[i].ebitda))] })), [0, 1, 1]);
    // costs by department
    const fyM = M.fyMonths(M.curFY, M.misMonths), fpl = fyM.map(m => M.pl([m]));
    CH.columns($('#mis-dept'), { months: fyM, height: 260, label: 'Costs by department by month', up: [{ label: 'COGS', color: '--s-high', values: fpl.map(x => x.cogs) }, { label: 'S&M', color: '--s-med', values: fpl.map(x => x.sm) }, { label: 'G&A', color: '--s-all', values: fpl.map(x => x.ga) }],
      fmtAxis: v => (Math.abs(v) / 1e5 % 1 ? (v / 1e5).toFixed(1) : (v / 1e5).toFixed(0)) + 'L', fmtTip: v => L(v), fmtMonth: mShort, fmtTipHead: mLong });
    tableToggle($('#mis-dept'), [t('month'), 'COGS', 'S&M', 'G&A'], fyM.map((m, i) => ({ cells: [esc(mLong(m)), esc(INR(fpl[i].cogs)), esc(INR(fpl[i].sm)), esc(INR(fpl[i].ga))] })), [0, 1, 1, 1]);
    // ledger
    let led = M.ledgers(ms);
    if (S.mis.line) led = led.filter(l => l.line === S.mis.line);
    let html = tableHTML([t('ledger'), 'Line', t('actual')], led.map(l => ({ cells: [esc(l.ledger), `<span class="dept">${esc(lineName(l.line))}</span>`, esc(INR(l.a))] })).concat([{ cls: 'tot', cells: ['Total', '', esc(INR(led.reduce((a, l) => a + l.a, 0)))] }]), { num: [0, 0, 1] });
    if (S.mis.line && S.mis.line.trim() === 'G&A-Professional Fees') {
      const pf = M.profFees(ms);
      if (pf.length) html += `<h3 class="h2" style="font-size:var(--t-lg);margin:20px 0 10px">${esc(t('vendors'))}</h3>` + rank(pf, { color: '--s-all' });
    }
    $('#mis-ledger').innerHTML = html;
  }

  /* ================= MONTH (cash) ================= */
  function renderCF() {
    const p = $('#page-cf'), m = S.cf.month, st = M.status(m);
    const row = M.scen(S.cf.b2b, S.cf.rtd).find(r => r.m === m), sc = scenControl(S.cf, renderCF, 'cf');
    const runway = row.cb < 0 ? t('belowZero') : row.out <= row.rc ? t('cashRising') : t('monthsAtBurn', { n: (row.cb / (row.out - row.rc)).toFixed(1) });
    const fmtAx = v => (Math.abs(v) / 1e5 % 1 ? (v / 1e5).toFixed(1) : (v / 1e5).toFixed(0)) + 'L';
    p.innerHTML = `
      <div class="toolbar"><label>${esc(t('month'))}<select id="cf-month">${[...M.cfMonths].reverse().map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${esc(mLong(x))} · ${esc(statusName(M.status(x)))}</option>`).join('')}</select></label>${sc.html}</div>
      ${scenKey(S.cf, 'cf')}
      <section class="dp" aria-labelledby="h-cf">
        <div class="dp-head"><div><h1 class="title" id="h-cf">${esc(mLong(m))}</h1><span class="dp-meta">${esc(t('monthTitle'))} · ${esc(scenLabel(S.cf))}</span></div>${bigStamp(st, m, null, 'landing')}</div>
        <div class="fields" style="--cols:5">
          ${field(t('opening'), row.ob, '')}
          ${field(t('receipts'), row.rc, row.pipeRev ? esc(`incl. pipeline ${L(row.pipeRev)}`) : '')}
          ${field(t('payments'), row.out, row.pipeCost ? esc(`incl. pipeline cost ${L(row.pipeCost)}`) : '')}
          ${field(t('closing'), row.cb, '', { lead: true })}
          ${field(t('runway'), 0, '', { text: runway })}
        </div></section>
      <div class="grid g-2e">
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('moneyIn'))}</h2><p>${esc(INR(row.rc))}</p></div></div><div id="cf-in"></div></section>
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('moneyOut'))}</h2><p>${esc(INR(row.out))}</p></div></div><div id="cf-out"></div></section>
      </div>
      <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('salariesDept'))}</h2><p>${esc(mLong(m))} · cash paid</p></div></div><div id="cf-sal"></div></section>`;
    $('#cf-month').addEventListener('change', e => { S.cf.month = e.target.value; store.set('cfMonth', S.cf.month); renderCF(); });
    sc.bind(p); bindKey(p, 'cf');
    // money in
    const rec = M.receipts(m).map(r => Object.assign({}, r, { color: r.kind === 'investment' ? '--c-inv' : '--c-rec' }));
    if (row.pipeB2B) rec.push({ label: t('pipeAdd', { t: 'B2B' }), a: row.pipeB2B, color: '--s-med', batches: [] });
    if (row.pipeRTD) rec.push({ label: t('pipeAdd', { t: 'RTD' }), a: row.pipeRTD, color: '--s-all', batches: [] });
    const box = $('#cf-in');
    box.innerHTML = rec.length ? rank(rec, { button: true, full: true }) + `<div id="cf-batches"></div>` : '<p class="lede">—</p>';
    $$('.rank-row button.l', box).forEach(b => {
      const it = rec[+b.dataset.k];
      if (!it.batches || !it.batches.length) { b.disabled = true; b.querySelector('svg').style.visibility = 'hidden'; b.style.cursor = 'default'; return; }
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        $$('.rank-row button.l', box).forEach(x => x.setAttribute('aria-expanded', 'false'));
        b.setAttribute('aria-expanded', open);
        $('#cf-batches').innerHTML = open ? `<h3 class="h2" style="font-size:var(--t-lg);margin:20px 0 10px">${esc(it.label)} · ${it.batches.length} ${esc(t('batches'))}</h3>` + tableHTML(['Batch', 'Level', t('receipts')], it.batches.map(d => ({ cells: [esc(d.batch), esc(M.level(d.batch) || '—'), esc(INR(d.a))] })), { num: [0, 0, 1] }) : '';
      });
    });
    // money out
    const pay = M.payments(m).map(r => Object.assign({}, r, { color: r.dept === 'COGS' ? '--s-high' : r.dept === 'S&M' ? '--s-med' : '--s-all' }));
    if (row.pipeCost) pay.push({ label: t('pipeCost'), a: row.pipeCost, color: '--s-none' });
    $('#cf-out').innerHTML = pay.length ? rank(pay, { full: true }) + `<div class="legend" style="margin-top:12px"><span><i class="box" style="background:var(--s-high)"></i>Direct (COGS)</span><span><i class="box" style="background:var(--s-med)"></i>Sales &amp; marketing</span><span><i class="box" style="background:var(--s-all)"></i>General &amp; admin</span></div>` : '<p class="lede">—</p>';
    // salaries
    const sal = M.salaries(m), tot = sal.reduce((a, s) => a + s.a, 0), scc = { 'COGS-Manpowers Cost': '--s-high', 'S&M-Manpower Costs': '--s-med', 'G&A-Manpower Costs': '--s-all' };
    $('#cf-sal').innerHTML = tot ? `<div class="segbar" role="img" aria-label="${esc(sal.map(s => s.label + ' ' + L(s.a)).join(', '))}">${sal.map(s => `<span style="flex:${s.a} 1 0;background:var(${scc[s.dept]})">${s.a / tot > 0.12 ? esc(s.label) + ' ' + Math.round(s.a / tot * 100) + '%' : ''}</span>`).join('')}</div>` + rank(sal.map(s => ({ label: s.label, a: s.a, color: scc[s.dept] })), { full: true })
      : `<p class="lede">No salaries are paid in cash this month; they fall in the next month.</p>`;
  }

  /* ================= TRENDS ================= */
  function renderTrends() {
    const p = $('#page-trends'), sc = scenControl(S.tr, renderTrends, 'tr');
    let fi = M.cfMonths.indexOf(S.tr.from), ti = M.cfMonths.indexOf(S.tr.to);
    if (fi > ti) [fi, ti] = [ti, fi];
    const ms = M.cfMonths.slice(fi, ti + 1);
    const opt = sel => M.cfMonths.map(x => `<option value="${x}" ${x === sel ? 'selected' : ''}>${esc(mLong(x))}</option>`).join('');
    p.innerHTML = `
      <div class="toolbar"><label>${esc(t('from'))}<select id="tr-from">${opt(S.tr.from)}</select></label><label>${esc(t('to'))}<select id="tr-to">${opt(S.tr.to)}</select></label>${sc.html}</div>
      ${scenKey(S.tr, 'tr')}
      <section class="panel"><div class="panel-h"><div><h1 class="h2">${esc(t('cashPath'))}</h1><p>${esc(t('cashPathSub'))}</p></div>
        <div class="legend">${SC.map(k => `<span><i style="background:var(${SCOL[k]})"></i>${esc(scenName(k))}</span>`).join('')}</div></div><div id="tr-path"></div><div id="tr-stamps" class="legend" style="margin-top:10px"></div></section>

      <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('inOutTitle'))}</h2><p>${esc(t('inOutSub'))} · ${esc(scenLabel(S.tr))}</p></div>
        <div class="legend"><span><i class="box" style="background:var(--s-high)"></i>${esc(t('receipts'))}</span><span><i class="box" style="background:var(--s-all)"></i>Investment</span><span><i class="box" style="background:var(--ink-3)"></i>${esc(t('pipeLegend'))}</span><span><i class="box" style="background:var(--s-med)"></i>${esc(t('payments'))}</span></div></div><div id="tr-io"></div></section>
      <div class="grid g-2e">
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('pipelineTitle'))}</h2><p>${esc(t('pipelineSub'))}</p></div>
          <div class="legend"><span><i class="box" style="background:var(--s-high)"></i>Highly Likely</span><span><i class="box" style="background:var(--s-med)"></i>Medium Likely</span><span><i class="box" style="background:var(--s-all)"></i>Low Likely</span></div></div><div id="tr-pipe"></div></section>
        <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('ladder'))}</h2><p>${esc(t('ladderSub'))} · ${esc(mShort(ms[0]))} – ${esc(mShort(ms[ms.length - 1]))}</p></div></div><div id="tr-ladder"></div></section>
      </div>
      <section class="panel"><div class="panel-h"><div><h2 class="h2">${esc(t('monthTable'))}</h2><p>${esc(scenLabel(S.tr))}</p></div></div><div id="tr-table"></div></section>`;
    $('#tr-from').addEventListener('change', e => { S.tr.from = e.target.value; renderTrends(); });
    $('#tr-to').addEventListener('change', e => { S.tr.to = e.target.value; renderTrends(); });
    sc.bind(p); bindKey(p, 'tr');
    const sel = S.tr.b2b === S.tr.rtd ? S.tr.b2b : null;
    const custom = sel ? null : M.scen(S.tr.b2b, S.tr.rtd);
    const series = SC.map(k => ({ key: k, label: scenName(k), color: SCOL[k], values: ms.map(m => M.closing(k, m)), emph: k === sel, dim: !!sel && k !== sel }));
    if (custom) series.push({ key: 'custom', label: scenLabel(S.tr), color: '--ink', values: ms.map(m => custom.find(r => r.m === m).cb), emph: true });
    CH.line($('#tr-path'), { months: ms, series, height: 360, statusOf: M.status, statusName, label: 'Closing cash by scenario', fmtAxis: v => (Math.abs(v) / 1e5 % 1 ? (v / 1e5).toFixed(1) : (v / 1e5).toFixed(0)) + 'L', fmtTip: v => L(v), fmtEnd: v => L(v), fmtMonth: mShort, fmtTipHead: mLong });
    tableToggle($('#tr-path'), [t('month'), ...SC.map(scenName)], ms.map(m => ({ cells: [esc(mLong(m) + ' · ' + statusName(M.status(m))), ...SC.map(k => esc(INR(M.closing(k, m))))] })), [0, 1, 1, 1, 1]);
    // stamps: where each scenario ends, and when the base case goes below zero
    const tb = M.turns('none', ms);
    $('#tr-stamps').innerHTML = `<span>${stampChip('actual')}&nbsp;${esc(t('lgActual'))}</span><span>${stampChip('progress')}&nbsp;${esc(M.asOfText)}</span><span>${stampChip('forecast')}&nbsp;${esc(t('lgForecast'))}</span>` + (tb.firstNegative ? `<span style="color:var(--neg);font-weight:600">${esc(t('goesBelow', { s: scenName('none'), m: mLong(tb.firstNegative.m), v: L(tb.firstNegative.cb) }))}</span>` : '');
    // money in and out
    const rows = (custom || M.scen(sel || 'none')).filter(r => ms.includes(r.m));
    const inv = ms.map(m => M.receipts(m).filter(r => r.kind === 'investment').reduce((a, r) => a + r.a, 0));
    CH.columns($('#tr-io'), { months: ms, height: 300, statusOf: M.status, statusName, label: 'Receipts and payments by month',
      up: [{ label: t('receipts'), color: '--s-high', values: rows.map((r, i) => r.baseRc - inv[i]) }, { label: 'Investment', color: '--s-all', values: inv }, { label: 'Pipeline B2B', color: '--ink-3', values: rows.map(r => r.pipeB2B) }, { label: 'Pipeline RTD', color: '--ink-3', values: rows.map(r => r.pipeRTD) }],
      down: [{ label: t('payments'), color: '--s-med', values: rows.map(r => r.baseOut) }, { label: t('pipeCost'), color: '--ink-3', values: rows.map(r => r.pipeCost) }],
      fmtAxis: v => (Math.abs(v) / 1e5 % 1 ? (v / 1e5).toFixed(1) : (v / 1e5).toFixed(0)) + 'L', fmtTip: v => L(v), fmtMonth: mShort, fmtTipHead: mLong, onPick: m => { S.cf.month = m; S.cf.b2b = S.tr.b2b; S.cf.rtd = S.tr.rtd; S.cf.split = S.tr.split; delete rendered.cf; go('cf'); } });
    // pipeline by tier
    const pm = ms.filter(m => M.status(m) !== 'actual');
    const tiers = [['HighlyLikely', '--s-high'], ['MediumLikely', '--s-med'], ['LowLikely', '--s-all']];
    if (pm.length) {
      CH.columns($('#tr-pipe'), { months: pm, height: 260, label: 'Pipeline net contribution by tier', fmtAxis: v => (Math.abs(v) / 1e5 % 1 ? (v / 1e5).toFixed(1) : (v / 1e5).toFixed(0)) + 'L', fmtTip: v => L(v), fmtMonth: mShort, fmtTipHead: mLong,
        up: tiers.map(([k, c]) => ({ label: M.TIER_NAME[k], color: c, values: pm.map(m => Math.max(0, M.tierNet(k, [m]))) })),
        down: tiers.map(([k, c]) => ({ label: M.TIER_NAME[k] + ' (net cost)', color: c, values: pm.map(m => Math.max(0, -M.tierNet(k, [m]))) })) });
      tableToggle($('#tr-pipe'), [t('month'), 'Highly Likely', 'Medium Likely', 'Low Likely'], pm.map(m => ({ cells: [esc(mLong(m)), ...tiers.map(([k]) => esc(INR(M.tierNet(k, [m]))))] })).concat([{ cls: 'tot', cells: ['Total', ...tiers.map(([k]) => esc(INR(M.tierNet(k, pm))))] }]), [0, 1, 1, 1]);
    } else $('#tr-pipe').innerHTML = '<p class="lede">The selected range has no forecast months.</p>';
    // language ladder
    const lv = M.levels(ms), steps = ['A1', 'A2', 'B1', 'B2'].filter(k => lv[k]), totL = Object.values(lv).reduce((a, b) => a + b, 0) || 1;
    $('#tr-ladder').innerHTML = `<div class="rank">${steps.map((k, i) => `<div class="rank-row" style="padding-left:${i * 22}px"><span class="l"><b style="font-family:var(--serif);font-size:var(--t-lg);color:var(--ink);margin-right:8px">${k}</b>${Math.round(lv[k] / totL * 100)}%</span><span class="track"><i style="width:${(lv[k] / Math.max(...Object.values(lv)) * 100).toFixed(1)}%;--c:var(--c-rec)"></i></span><span class="a">${esc(L(lv[k]))}</span></div>`).join('')}
      ${lv.Other ? `<div class="rank-row"><span class="l">${esc(t('other'))}</span><span class="track"><i style="width:${(lv.Other / Math.max(...Object.values(lv)) * 100).toFixed(1)}%;--c:var(--ink-3)"></i></span><span class="a">${esc(L(lv.Other))}</span></div>` : ''}</div>`;
    // month table
    $('#tr-table').innerHTML = tableHTML([t('month'), '', t('opening'), t('receipts'), t('payments'), t('closing'), t('runway')], rows.map(r => ({
      cells: [esc(mLong(r.m)), stampChip(r.status), esc(INR(r.ob)), esc(INR(r.rc)), esc(INR(r.out)), `<span class="${r.cb < 0 ? 'neg' : ''}">${esc(INR(r.cb))}</span>`,
        esc(r.cb < 0 ? t('belowZero') : r.out <= r.rc ? (S.lang === 'de' ? 'steigt' : 'rising') : (r.cb / (r.out - r.rc)).toFixed(1) + (S.lang === 'de' ? ' Mon.' : ' mo'))] })), { num: [0, 0, 1, 1, 1, 1, 1] });
  }

  /* ================= WHAT IF ================= */
  const WI0 = { delay: 0, delayWho: 'Somika', shortfall: 0, pipeConv: 100, travel: 0, salaries: 0, oneOff: 0, oneOffMonth: null };
  const WI = Object.assign({}, WI0);
  const SWI = { b2b: store.get('scen', 'high'), rtd: store.get('scen', 'high'), split: false };
  function renderWhatIfPage() {
    const p = $('#page-whatif'), sc = scenControl(SWI, renderWhatIfPage, 'wi');
    p.innerHTML = `<div class="toolbar">${sc.html}</div>${scenKey(SWI, 'wis')}<section class="panel" id="whatif" aria-labelledby="h-wi"></section>`;
    sc.bind(p); bindKey(p, 'wis');
    renderWhatIf();
  }
  function renderWhatIf() {
    const box = $('#whatif'); if (!box) return;
    const fc = M.cfMonths.filter(m => M.status(m) !== 'actual');
    if (!WI.oneOffMonth) WI.oneOffMonth = fc[1] || fc[0];
    const p = Object.assign({}, WI, { b2b: SWI.b2b, rtd: SWI.rtd });
    const res = M.whatIf(p), end = M.horizonEnd, last = M.cfMonths[M.cfMonths.length - 1];
    const get = (m, k) => (res.find(r => r.m === m) || {})[k];
    const firstNeg = arr => arr.find(r => r.status !== 'actual' && r[0] === undefined && r.cb < 0);
    const nNew = res.find(r => r.status !== 'actual' && r.cb < 0), nOld = res.find(r => r.status !== 'actual' && r.plan < 0);
    const low = res.filter(r => r.status !== 'actual').reduce((a, r) => (!a || r.cb < a.cb ? r : a), null);
    const changed = JSON.stringify(Object.assign({}, WI, { oneOffMonth: null })) !== JSON.stringify(Object.assign({}, WI0, { oneOffMonth: null }));
    const delta = get(end, 'cb') - get(end, 'plan');
    const clients = [...new Set(fc.flatMap(m => M.receipts(m).filter(r => r.kind === 'b2b').map(r => r.label)))];
    const rng = (id, label, val, min, max, step, fmtv) => `<label class="wi-c"><span>${esc(label)}<b id="${id}-v">${esc(fmtv(val))}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
    box.innerHTML = `
      <div class="panel-h"><div><h1 class="title" id="h-wi">What if?</h1><p>Change one thing and see where ${esc(scenLabel(SWI))} lands. Only forecast months move; nothing here changes the workbook figures.</p></div>
        <button class="btn" id="wi-reset" ${changed ? '' : 'disabled'}>${icon('refresh')}Reset</button></div>
      <div class="wi-grid">
        <div class="wi-controls">
          <label class="wi-c"><span>Who pays late</span><select id="wi-who"><option value="all" ${WI.delayWho === 'all' ? 'selected' : ''}>Every client</option>${clients.map(c => `<option ${WI.delayWho === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          ${rng('wi-delay', 'Months late', WI.delay, 0, 3, 1, v => v === 0 || v === '0' ? 'On time' : v + (+v === 1 ? ' month' : ' months'))}
          ${rng('wi-short', 'Receipts never collected', WI.shortfall, 0, 50, 5, v => v + '%')}
          ${rng('wi-pipe', 'Pipeline that converts', WI.pipeConv, 0, 100, 10, v => v + '%')}
          ${rng('wi-travel', 'Travel spend', WI.travel, -50, 50, 10, v => (v > 0 ? '+' : '') + v + '%')}
          ${rng('wi-sal', 'Salary bill', WI.salaries, -20, 30, 5, v => (v > 0 ? '+' : '') + v + '%')}
          <label class="wi-c"><span>One-off amount <small>(+ money in, − money out)</small></span><span class="wi-row"><input class="input" id="wi-amt" type="number" step="50000" value="${WI.oneOff}" aria-label="One-off amount in rupees"><select id="wi-m" aria-label="Month of the one-off">${fc.map(m => `<option value="${m}" ${m === WI.oneOffMonth ? 'selected' : ''}>${esc(mShort(m))}</option>`).join('')}</select></span></label>
        </div>
        <div>
          <div class="wi-out">
            <div><label>${esc(mLong(end))} closing</label><span class="v ${get(end, 'cb') < 0 ? 'neg' : ''}">${esc(L(get(end, 'cb')))}</span><small>Plan ${esc(L(get(end, 'plan')))}${changed ? ` · <b class="${delta < 0 ? 'neg' : 'var-pos'}">${delta >= 0 ? '+' : '−'}${esc(L(Math.abs(delta)))}</b>` : ''}</small></div>
            <div><label>First month below zero</label><span class="v ${nNew ? 'neg' : ''}">${esc(nNew ? mShort(nNew.m) : 'None')}</span><small>Plan ${esc(nOld ? mShort(nOld.m) : 'none')} · to ${esc(mShort(last))}</small></div>
            <div><label>Lowest point</label><span class="v ${low && low.cb < 0 ? 'neg' : ''}">${esc(low ? L(low.cb) : '—')}</span><small>${esc(low ? mLong(low.m) : '')}</small></div>
          </div>
          <div class="legend" style="margin-top:12px"><span><i style="background:var(--ink-3)"></i>Plan</span><span><i style="background:var(--magenta)"></i>What if</span></div>
          <div id="wi-chart"></div>
        </div>
      </div>`;
    const months = M.cfMonths.filter(m => M.idx(m) >= M.idx(M.lastActual));
    CH.line($('#wi-chart'), { months, height: 340, statusOf: M.status, statusName, label: 'What-if closing cash against plan', fmtAxis: v => (v / 1e5).toFixed(0) + 'L', fmtTip: v => L(v), fmtEnd: v => L(v), fmtMonth: mShort, fmtTipHead: mLong,
      series: [{ key: 'plan', label: 'Plan', color: '--ink-3', values: months.map(m => get(m, 'plan')), dash: true }, { key: 'wi', label: 'What if', color: '--magenta', values: months.map(m => get(m, 'cb')), emph: true }] });
    const bind = (id, key, num) => { const el = $('#' + id, box); el.addEventListener(el.type === 'range' ? 'input' : 'change', () => { WI[key] = num ? +el.value : el.value; renderWhatIf(); const n = $('#' + id); if (n && el.type === 'range') n.focus(); }); };
    bind('wi-who', 'delayWho'); bind('wi-delay', 'delay', true); bind('wi-short', 'shortfall', true); bind('wi-pipe', 'pipeConv', true); bind('wi-travel', 'travel', true); bind('wi-sal', 'salaries', true); bind('wi-amt', 'oneOff', true); bind('wi-m', 'oneOffMonth');
    $('#wi-reset', box).addEventListener('click', () => { Object.assign(WI, WI0); renderWhatIf(); });
  }

  /* ================= ASK ================= */
  function renderAsk() {
    const p = $('#page-ask');
    p.innerHTML = `
      <div class="ask">
        <section aria-labelledby="h-ask">
          <h1 class="title" id="h-ask">${esc(t('askTitle'))}</h1><p class="lede">${esc(t('askSub'))}</p>
          <div class="thread" id="thread" aria-live="polite" style="margin-top:18px">
            <div><p class="lede" style="margin-bottom:10px">${esc(t('tryAsk'))}</p><div class="chips">${A.SUGGEST.slice(0, 8).map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
          </div>
          <form class="composer" id="ask-form"><label class="sr" for="ask-q">${esc(t('askTitle'))}</label><input id="ask-q" autocomplete="off" placeholder="${esc(t('askPh'))}"><button class="btn primary" type="submit">${icon('send')}${esc(t('ask'))}</button></form>
        </section>
        <aside class="grid">
          <div class="side-card"><h2 class="h2" style="font-size:var(--t-lg)">${esc(t('askClaude'))}</h2><p>${esc(t('askClaudeBody'))}</p><a class="btn primary" href="${ASK_CLAUDE_URL}" target="_blank" rel="noopener">${esc(t('askClaude'))} ${icon('ext')}</a></div>
          <div class="side-card"><h2 class="h2" style="font-size:var(--t-lg)">${esc(t('canAnswer'))}</h2><p>Closing cash by month or scenario · when cash goes below zero · receipts by client · payments by category · salaries by department · what each pipeline tier adds · revenue by customer · gross profit and EBITDA · budget against actual · P&amp;L cost lines such as travel or software.</p></div>
        </aside>
      </div>`;
    const form = $('#ask-form'), q = $('#ask-q');
    form.addEventListener('submit', e => { e.preventDefault(); if (q.value.trim()) { ask(q.value.trim()); q.value = ''; } });
    $$('.chip', p).forEach(c => c.addEventListener('click', () => ask(c.dataset.q)));
  }
  function ask(text) {
    const th = $('#thread'), a = A.answer(text);
    const qe = document.createElement('div'); qe.className = 'qa-q'; qe.textContent = text; th.appendChild(qe);
    const ae = document.createElement('div'); ae.className = 'qa-a';
    ae.innerHTML = `<p>${esc(a.text)}</p>
      ${a.source ? `<div class="qa-meta"><span class="src">${esc(t('source'))}: ${esc(a.source === 'MIS' ? 'MIS (P&L)' : 'Cash flow')}</span>${a.months && a.months.length ? `<span>${esc(t('months'))}: ${esc(a.months.length > 3 ? mShort(a.months[0]) + ' – ' + mShort(a.months[a.months.length - 1]) : a.months.map(mShort).join(', '))}</span>` : ''}</div>` : ''}
      ${a.bars && a.bars.length > 1 ? rank(a.bars.map(b => ({ label: b.label, a: b.a, color: b.key ? SCOL[b.key] : '--c-rec' }))) : ''}
      ${a.table ? tableHTML(a.table.cols, a.table.rows.map(r => ({ cls: r[0] === 'Total' || r[0] === 'B2B total' ? 'tot' : '', cells: r.map(esc) })), { num: a.table.cols.map((_, i) => i > 0 && a.table.cols.length > 1 && !/status|first|lowest/i.test(a.table.cols[i])) }) : ''}
      ${a.followups && a.followups.length ? `<div><p class="lede" style="margin-bottom:8px">${esc(a.ok ? t('tryAsk') : t('closestQ'))}</p><div class="chips">${a.followups.map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>${a.ok ? '' : `<p class="lede" style="margin-top:10px"><a href="${ASK_CLAUDE_URL}" target="_blank" rel="noopener">${esc(t('askClaude'))}</a></p>`}</div>` : ''}`;
    th.appendChild(ae);
    $$('.chip', ae).forEach(c => c.addEventListener('click', () => ask(c.dataset.q)));
    ae.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const RENDER = { brief: renderBrief, mis: renderMIS, cf: renderCF, trends: renderTrends, whatif: renderWhatIfPage, ask: renderAsk };

  /* ================= gate ================= */
  async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  function unlocked() { try { return sessionStorage.getItem('tmc.ok') === PASS_HASH || localStorage.getItem('tmc.ok') === PASS_HASH; } catch (e) { return false; } }
  function gate(onOpen) {
    const g = $('#gate');
    if (unlocked()) { g.hidden = true; onOpen(); return; }
    g.hidden = false;
    g.innerHTML = `<form autocomplete="off"><img src="tmc-logo.png" alt="The Migration Company"><h1>${esc(t('gateTitle'))}</h1><p>${esc(t('gateBody'))}</p>
      <label class="sr" for="pc">${esc(t('passcode'))}</label><input id="pc" type="password" placeholder="${esc(t('passcode'))}" autocomplete="current-password" required>
      <label class="rem"><input type="checkbox" id="rem">${esc(t('remember'))}</label><p class="err" id="pc-err" role="alert"></p><button class="btn primary" type="submit">${esc(t('open'))} ${icon('arrow')}</button></form>`;
    const WORDS = ['WILLKOMMEN', 'BIENVENUE', 'ZUKUNFT', 'AVENIR', 'REISE', 'VOYAGE', 'ARBEIT', 'TRAVAIL', 'SPRACHE', 'LANGUE', 'NEUANFANG', 'NOUVEAU DÉPART', 'ANKUNFT', 'ARRIVÉE', 'BERUF', 'MÉTIER', 'GUTEN TAG', 'BONJOUR', 'HORIZON', 'EN ROUTE'];
    let k = 0, rows = '';
    for (let r = 0; r < 14; r++) { let line = ''; for (let c = 0; c < 9; c++) { line += `<span>${WORDS[k % WORDS.length]}</span>`; k += 3; } rows += `<div>${line}</div>`; }
    g.insertAdjacentHTML('afterbegin', `<div class="g-words" aria-hidden="true">${rows}</div>`);
    $('#pc').focus();
    $('form', g).addEventListener('submit', async e => {
      e.preventDefault();
      const h = await sha($('#pc').value.trim());
      if (h !== PASS_HASH) { $('#pc-err').textContent = t('wrong'); $('#pc').select(); return; }
      try { sessionStorage.setItem('tmc.ok', h); if ($('#rem').checked) localStorage.setItem('tmc.ok', h); } catch (er) { /* storage blocked: stays open for this view */ }
      g.hidden = true; onOpen();
    });
  }

  /* ================= boot ================= */
  function boot() {
    const theme = store.get('theme', null);
    if (theme) document.documentElement.dataset.theme = theme;
    $$('#lang button').forEach(b => b.addEventListener('click', () => { S.lang = b.dataset.lang; store.set('lang', S.lang); rerenderAll(); }));
    $('#theme').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', document.documentElement.dataset.theme); rerenderAll();
    });
    $('#lock').addEventListener('click', () => { try { sessionStorage.removeItem('tmc.ok'); localStorage.removeItem('tmc.ok'); } catch (e) { /* ignore */ } location.reload(); });
    renderShell();
    gate(() => { const want = (location.hash || '').slice(1); go(TABS.some(x => x[0] === want) ? want : 'brief'); });
    window.addEventListener('hashchange', () => { const want = location.hash.slice(1); if (want !== S.tab && TABS.some(x => x[0] === want)) go(want); });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
