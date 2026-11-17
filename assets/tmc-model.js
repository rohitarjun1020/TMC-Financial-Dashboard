/* TMC finance model: every derived figure the dashboard, the built-in "Ask the data"
   answers and the claude.ai chatbot show is computed here from TMC_DATA, so all three
   always agree. Pure functions, no DOM. Works in browsers and in Python-built pages. */
(function (root) {
  'use strict';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function create(D) {
    /* ---------- months ---------- */
    const idx = m => { const [mn, yr] = m.split('-'); return +yr * 12 + MON.indexOf(mn); };
    const fromIdx = i => MON[i % 12] + '-' + Math.floor(i / 12);
    const shortM = m => m.replace('-20', ' ');                       // "Nov 26"
    const longM = m => { const [mn, yr] = m.split('-'); return MON_LONG[MON.indexOf(mn)] + ' ' + yr; };
    const sortM = arr => [...arr].sort((a, b) => idx(a) - idx(b));
    const uniq = a => [...new Set(a)];
    const fyOf = m => { const i = idx(m); const y = Math.floor((i - 3) / 12); return 'FY ' + y + '-' + String(y + 1).slice(2); };
    const fyMonths = (fy, pool) => pool.filter(m => fyOf(m) === fy);

    /* ---------- money ---------- */
    function inr(n, opts) {
      if (n == null || isNaN(n)) return '—';
      const neg = n < 0, v = Math.round(Math.abs(n));
      const s = String(v), last3 = s.slice(-3), rest = s.slice(0, -3);
      const g = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
      const out = (opts && opts.bare ? '' : '₹') + g;
      return neg ? '(' + out + ')' : out;
    }
    function lakh(n, dp) {
      if (n == null || isNaN(n)) return '—';
      const d = dp == null ? 2 : dp, v = Math.abs(n) / 1e5;
      const s = Math.abs(n) >= 1e7 ? '₹' + (Math.abs(n) / 1e7).toFixed(2) + 'Cr' : '₹' + v.toFixed(d) + 'L';
      return n < 0 ? '(' + s + ')' : s;
    }
    const pct = (a, b, dp) => (b ? (a / b * 100).toFixed(dp == null ? 1 : dp) + '%' : '—');

    /* ---------- cash flow: base case ---------- */
    const cfMonths = sortM(uniq(D.cfSummary.map(r => r.m)));
    const sumIdx = {};
    D.cfSummary.forEach(r => { (sumIdx[r.m] = sumIdx[r.m] || {})[r.p] = r.a; });
    const horiz = {};
    (D.cfHorizontal || []).forEach(r => { horiz[r.m] = r; });
    function base(m) {
      const s = sumIdx[m] || {};
      return { m, ob: s['Opening balance'] || 0, rc: s['Receipts'] || 0, out: s['Outflows'] || 0, adj: s['Adjustments'] || 0,
        cb: s['Closing Balance'] || 0, nb: s['Net Burn'] || 0, rwy: s['Runway'] == null ? null : s['Runway'] };
    }
    const asOfText = (D.cfBriefing && D.cfBriefing.asOf) || '';
    const asOfMonth = (() => { const p = asOfText.split(' '); return p.length === 3 ? p[1].slice(0, 3) + '-' + p[2] : null; })();
    const forecastFrom = D.cfForecastFrom || cfMonths[cfMonths.length - 1];
    function status(m) {
      if (idx(m) < idx(forecastFrom)) return 'actual';
      if (m === asOfMonth) return 'progress';
      return 'forecast';
    }
    const lastActual = cfMonths.filter(m => status(m) === 'actual').slice(-1)[0];

    /* ---------- pipeline scenarios ---------- */
    const P = D.cfPipeline || {};
    const TIERS = { none: [], high: ['HighlyLikely'], med: ['HighlyLikely', 'MediumLikely'], all: ['HighlyLikely', 'MediumLikely', 'LowLikely'] };
    const SCEN = {
      none: { key: 'none', short: 'Base', name: 'Base case', note: 'Confirmed business only, no pipeline' },
      high: { key: 'high', short: 'Scenario 1', name: 'Scenario 1', note: 'Adds Highly Likely deals (90%)' },
      med: { key: 'med', short: 'Scenario 2', name: 'Scenario 2', note: 'Adds Medium Likely deals (60%)' },
      all: { key: 'all', short: 'Scenario 3', name: 'Scenario 3', note: 'Adds Low Likely deals (30%)' }
    };
    const TIER_NAME = { HighlyLikely: 'Highly Likely', MediumLikely: 'Medium Likely', LowLikely: 'Low Likely' };
    const pv = (k, m) => (P[k] && P[k][m]) || 0;
    function addon(m, b2b, rtd) {
      let rB = 0, rR = 0, cost = 0;
      TIERS[b2b].forEach(t => { rB += pv('b2b' + t, m); cost += pv('b2b' + t + 'Cost', m); });
      TIERS[rtd].forEach(t => { rR += pv('rtd' + t, m); cost += pv('rtd' + t + 'Cost', m); });
      return { b2b: rB, rtd: rR, rev: rB + rR, cost };
    }
    /* Mirrors the workbook: pipeline revenue joins receipts, delivery cost joins payments, and the
       running net carries into every later opening balance. */
    function series(b2b, rtd) {
      b2b = b2b || 'none'; rtd = rtd == null ? b2b : rtd;
      let cum = 0;
      return cfMonths.map(m => {
        const b = base(m), a = addon(m, b2b, rtd), net = a.rev - a.cost;
        const r = { m, status: status(m), ob: b.ob + cum, rc: b.rc + a.rev, out: b.out + a.cost, adj: b.adj, pipeRev: a.rev, pipeB2B: a.b2b, pipeRTD: a.rtd, pipeCost: a.cost, baseRc: b.rc, baseOut: b.out };
        cum += net;
        r.cb = b.cb + cum;
        r.nb = r.out - r.rc;
        r.rwy = (r.rc - r.out) !== 0 ? r.cb / (r.rc - r.out) : null;
        return r;
      });
    }
    const seriesCache = {};
    const scen = (b2b, rtd) => { const k = b2b + '|' + (rtd == null ? b2b : rtd); return seriesCache[k] || (seriesCache[k] = series(b2b, rtd)); };
    const closing = (s, m) => { const r = scen(s).find(x => x.m === m); return r ? r.cb : NaN; };
    function tierNet(tier, months, kind) {
      const ks = kind ? [kind] : ['b2b', 'rtd'];
      return months.reduce((a, m) => a + ks.reduce((b, k) => b + pv(k + tier, m) - pv(k + tier + 'Cost', m), 0), 0);
    }
    function tierMonth(tier, m) {
      return { rev: pv('b2b' + tier, m) + pv('rtd' + tier, m), cost: pv('b2b' + tier + 'Cost', m) + pv('rtd' + tier + 'Cost', m),
        b2bRev: pv('b2b' + tier, m), rtdRev: pv('rtd' + tier, m), b2bCost: pv('b2b' + tier + 'Cost', m), rtdCost: pv('rtd' + tier + 'Cost', m) };
    }
    const DEALS = D.cfPipelineDeals || {};
    const dealNames = (tier, kind) => ((DEALS[tier] || {})[kind] || []).map(d => d.c);
    const PROB = { HighlyLikely: '90%', MediumLikely: '60%', LowLikely: '30%' };
    const ADDS = { high: 'HighlyLikely', med: 'MediumLikely', all: 'LowLikely' };
    /* what a scenario adds on top of the one before it, in plain English */
    function scenarioKey(k) {
      if (k === 'none') return { title: 'Base case', adds: 'Confirmed business only', text: 'Only invoiced and confirmed batches. No pipeline deals are counted.' };
      const tier = ADDS[k], prev = { high: 'The base case', med: 'Scenario 1', all: 'Scenario 2' }[k];
      const b = dealNames(tier, 'b2b'), r = dealNames(tier, 'rtd');
      const parts = [b.length ? 'B2B: ' + b.join(', ') : '', r.length ? 'RTD: ' + r.join(', ') : ''].filter(Boolean).join(' · ');
      return { title: SCEN[k].name, adds: '+ ' + TIER_NAME[tier] + ' · ' + PROB[tier], tier,
        text: `${prev} plus the ${TIER_NAME[tier]} deals (${PROB[tier]} chance of closing)${parts ? ' — ' + parts : ''}.` };
    }
    /* ---------- what-if: adjust the forecast months of a scenario ----------
       p = { scen, b2b, rtd, delay (months), delayWho ('all'|'Somika'), shortfall (% of confirmed receipts not collected),
             travel (% change), salaries (% change), pipeConv (% of pipeline net that converts), oneOff (₹, +in/-out), oneOffMonth } */
    function whatIf(p) {
      const b2b = p.b2b || p.scen || 'none', rtd = p.rtd || p.scen || 'none';
      const plan = scen(b2b, rtd);
      const first = plan.findIndex(r => r.status !== 'actual');
      const confirmed = m => { const it = receipts(m).filter(r => r.kind !== 'investment'); return it.reduce((a, r) => a + r.a, 0); };
      const who = m => p.delayWho === 'all' ? confirmed(m) : receipts(m).filter(r => r.label === p.delayWho).reduce((a, r) => a + r.a, 0);
      const line = (m, ln) => (exps[m] || []).filter(r => r.p === ln).reduce((a, r) => a + r.a, 0);
      const sal = m => (sals[m] || []).reduce((a, r) => a + r.a, 0);
      let cb = first > 0 ? plan[first - 1].cb : plan[0].ob;
      return plan.map((r, i) => {
        if (i < first) return Object.assign({}, r, { plan: r.cb });
        const m = r.m, d = p.delay || 0;
        const moved = who(m), arriving = d && i - d >= first ? who(cfMonths[i - d]) : 0;
        let rc = r.baseRc - (d ? moved : 0) + arriving;
        rc -= (p.shortfall || 0) / 100 * (confirmed(m) - (d ? moved : 0) + arriving);
        let out = r.baseOut + (p.travel || 0) / 100 * line(m, 'Travel Costs') + (p.salaries || 0) / 100 * sal(m);
        const net = (r.pipeRev - r.pipeCost) * (p.pipeConv == null ? 100 : p.pipeConv) / 100;
        if (p.oneOff && p.oneOffMonth === m) { if (p.oneOff > 0) rc += p.oneOff; else out -= p.oneOff; }
        const ob = cb;
        cb = ob + rc - out + r.adj + net;
        return { m, status: r.status, ob, rc, out, net, cb, plan: r.cb };
      });
    }
    /* the one-line verdict: when confirmed business runs out, and the smallest scenario that keeps cash positive */
    function verdict() {
      const fromM = asOfMonth || lastActual, hz = horizon.filter(m => idx(m) >= idx(fromM));
      const pos = k => hz.every(m => closing(k, m) >= 0);
      const t = turns('none', hz);
      const save = ['high', 'med', 'all'].find(pos);
      return { negative: t.firstNegative, pinch: t.pinch, save, end: horizonEnd, positiveBase: pos('none') };
    }
    /* things to watch, computed from the data */
    function watch() {
      const out = [], fromM = asOfMonth || lastActual, fut = cfMonths.filter(m => idx(m) >= idx(fromM));
      const b = scen('none');
      const t = turns('none', horizon.filter(m => idx(m) >= idx(fromM)));
      if (t.firstNegative) out.push({ level: 'critical', title: `Cash goes below zero in ${longM(t.firstNegative.m)}`, text: `On confirmed business alone, ${longM(t.firstNegative.m)} closes at ${lakh(t.firstNegative.cb)}.` });
      fut.forEach((m, i) => { const r = b.find(x => x.m === m), nx = b.find(x => x.m === fut[i + 1]);
        if (r && nx && r.cb > 0 && r.cb < nx.out && !(t.firstNegative && t.firstNegative.m === nx.m) && !out.some(o => o.kind === 'buffer')) out.push({ level: 'warning', kind: 'buffer', title: `Thin buffer going into ${longM(nx.m)}`, text: `${longM(m)} closes at ${lakh(r.cb)}, less than ${longM(nx.m)}'s payments of ${lakh(nx.out)}.` }); });
      const next3 = fut.slice(0, 3), tot = {}; let all = 0;
      next3.forEach(m => receipts(m).filter(r => r.kind !== 'investment').forEach(r => { tot[r.label] = (tot[r.label] || 0) + r.a; all += r.a; }));
      const top = Object.entries(tot).sort((a, c) => c[1] - a[1])[0];
      if (top && all && top[1] / all > 0.6) out.push({ level: 'warning', title: `${top[0]} is ${Math.round(top[1] / all * 100)}% of receipts`, text: `${lakh(top[1])} of the ${lakh(all)} expected from ${shortM(next3[0])} to ${shortM(next3[next3.length - 1])}. A late payment moves every month after it.` });
      const big = fut.filter(m => idx(m) <= idx(horizonEnd)).map(m => b.find(x => x.m === m)).reduce((a, r) => (!a || r.out > a.out ? r : a), null);
      if (big) out.push({ level: 'info', title: `Largest payment month: ${longM(big.m)}`, text: `${lakh(big.out)} goes out against ${lakh(big.rc)} coming in.` });
      const hl = (DEALS.HighlyLikely || {}), deals = [].concat(hl.b2b || [], hl.rtd || []).sort((a, c) => c.a - a.a);
      if (deals[0]) out.push({ level: 'info', title: `Scenario 1 leans on ${deals[0].c}`, text: `${deals[0].c} is the largest Highly Likely deal: ${lakh(deals[0].a)} of revenue in the forecast.` });
      return out;
    }
    const brief = D.cfBriefing || null;
    const horizon = (brief && brief.horizon) || cfMonths.filter(m => idx(m) >= idx(lastActual));
    const horizonEnd = horizon[horizon.length - 1];
    /* first month a scenario closes below zero, and its lowest positive month */
    function turns(s, months) {
      const ms = months || cfMonths.filter(m => idx(m) >= idx(lastActual));
      const rows = scen(s).filter(r => ms.includes(r.m));
      const neg = rows.find(r => r.cb < 0) || null;
      const positives = rows.filter(r => r.cb > 0 && (!neg || idx(r.m) < idx(neg.m)) && idx(r.m) > idx(lastActual));
      const pinch = positives.reduce((a, b) => (!a || b.cb < a.cb ? b : a), null);
      return { firstNegative: neg, pinch };
    }

    /* ---------- cash flow: month detail ---------- */
    const byM = arr => { const o = {}; arr.forEach(r => (o[r.m] = o[r.m] || []).push(r)); return o; };
    const infl = byM(D.cfInflows || []), exps = byM(D.cfExpenses || []), sals = byM(D.cfSalaries || []), det = byM(D.cfInflowsDetail || []);
    const SAL_LABEL = { 'COGS-Manpowers Cost': 'Operations', 'S&M-Manpower Costs': 'Sales & marketing', 'G&A-Manpower Costs': 'General & admin' };
    function receipts(m) {
      const rows = (infl[m] || []).filter(r => r.a);
      const items = rows.map(r => ({ label: r.c || r.p, group: r.p, a: r.a,
        kind: r.p === 'Investment (initate Request)' ? 'investment' : r.p.startsWith('Collection from Recruitment') ? 'rtd' : r.p === 'Collections from B2B Invoices' ? 'b2b' : 'other',
        batches: r.p === 'Collections from B2B Invoices' ? (det[m] || []).filter(d => d.c === r.c) : [] }));
      items.forEach(i => { if (i.kind === 'investment') i.label = 'Investment'; else if (i.kind === 'rtd') i.label = 'RTD & recruitment'; });
      const CLIENT_NAME = { 'Not Language Training': 'CCT videos project (VIN TECH)', 'B2C for Booby': 'Booby Salwan', 'Nitin': 'Nitin Malik', 'VMF India': 'Vinmart (VMF India)', 'VMF-DRC': 'Vinmart (VMF DRC)' };
      items.forEach(i => { if (CLIENT_NAME[i.label]) i.label = CLIENT_NAME[i.label]; });
      return items.sort((a, b) => b.a - a.a);
    }
    const EXP_LABEL = { 'Ops-Manpowers Cost': 'Salaries · operations', 'S&M-Manpower Costs': 'Salaries · sales & marketing', 'G&A-Manpower Costs': 'Salaries · general & admin',
      'B2B Costs': 'B2B teacher payouts', 'RTD Costs': 'RTD costs', 'Travel Costs': 'Travel', 'Website & Software Costs': 'Software & website',
      'Marketing Costs': 'Marketing', 'Recruitment Consultant Expense': 'Other consultancy', 'Professional Fees - G&A': 'Professional fees',
      'G&A-Miscellaneous Costs': 'Office, phone & other', 'Office Maintainance': 'Repairs & maintenance', 'Office Rent': 'Office rent',
      'S&M-Miscellaneous Costs': 'Other S&M', 'B2B Pipeline Cost': 'B2B pipeline cost', 'Consultant Costs - B2B': 'Consultants · B2B', 'Consultant Costs - RTD': 'Consultants · RTD' };
    function payments(m) {
      return (exps[m] || []).filter(r => r.a).map(r => ({ label: EXP_LABEL[r.p] || r.p, line: r.p, dept: r.d, a: r.a })).sort((a, b) => b.a - a.a);
    }
    function salaries(m) {
      return (sals[m] || []).filter(r => r.a).map(r => ({ label: SAL_LABEL[r.d] || r.d, dept: r.d, a: r.a }));
    }
    /* language level of a batch code: A1.75 -> A1, "B1.9 (Sudeepa)" -> B1 */
    function level(batch) { const mm = /\b([ABC][12])(?:\.|\b)/.exec(batch || ''); return mm ? mm[1] : null; }
    function levels(months) {
      const out = {};
      months.forEach(m => (det[m] || []).forEach(d => { const l = level(d.batch) || 'Other'; out[l] = (out[l] || 0) + d.a; }));
      return out;
    }

    /* ---------- MIS (accrual P&L) ---------- */
    const misMonths = D.misMonths || [];
    const mis = byM(D.misSummary || []), misExp = byM(D.misExpenses || []), misSal = byM(D.misSalaries || []), bud = byM(D.budgetSummary || []), prof = byM(D.profFeesDetail || []);
    const DEPTS = ['Revenue', 'COGS', 'S&M', 'G&A'];
    function pl(months) {
      const lines = {}, order = [];
      let rev = 0, cogs = 0, sm = 0, ga = 0, oi = 0, gp = 0, eb = 0;
      months.forEach(m => (mis[m] || []).forEach(r => {
        if (r.d === 'Gross Profit') { gp += r.a; return; }
        if (r.d === 'EBITDA') { eb += r.a; return; }
        if (r.d === 'Other Income') { oi += r.a; return; }
        const k = r.d + '|' + r.p.trim();
        if (!(k in lines)) { lines[k] = { d: r.d, p: r.p.trim(), a: 0, byClient: {} }; order.push(k); }
        lines[k].a += r.a;
        if (r.c) lines[k].byClient[r.c] = (lines[k].byClient[r.c] || 0) + r.a;
        if (r.d === 'Revenue') rev += r.a; else if (r.d === 'COGS') cogs += r.a; else if (r.d === 'S&M') sm += r.a; else if (r.d === 'G&A') ga += r.a;
      }));
      return { months, lines: order.map(k => lines[k]), revenue: rev, cogs, sm, ga, gp, ebitda: eb, otherIncome: oi };
    }
    function budget(months) {
      const o = { lines: {}, revenue: 0, cogs: 0, sm: 0, ga: 0, gp: 0, ebitda: 0, has: false };
      months.forEach(m => (bud[m] || []).forEach(r => {
        o.has = true;
        const k = r.d + '|' + r.p.trim();
        o.lines[k] = (o.lines[k] || 0) + r.a;
        if (r.d === 'Revenue') o.revenue += r.a; else if (r.d === 'COGS') o.cogs += r.a; else if (r.d === 'S&M') o.sm += r.a; else if (r.d === 'G&A') o.ga += r.a;
        else if (r.d === 'Gross Profit') o.gp += r.a; else if (r.d === 'EBITDA') o.ebitda += r.a;
      }));
      return o;
    }
    function customers(months) {
      const o = {};
      months.forEach(m => (mis[m] || []).forEach(r => { if (r.d === 'Revenue' && r.p.trim() === 'Revenue from B2B training' && r.a) o[r.c || 'Not itemised'] = (o[r.c || 'Not itemised'] || 0) + r.a; }));
      return Object.entries(o).map(([label, a]) => ({ label, a })).sort((a, b) => b.a - a.a);
    }
    function ledgers(months) {
      const o = {};
      months.forEach(m => (misExp[m] || []).forEach(r => { if (!r.a) return; const k = r.h.trim() + '|' + r.l.trim(); o[k] = o[k] || { line: r.h.trim(), ledger: r.l.trim(), a: 0 }; o[k].a += r.a; }));
      return Object.values(o).sort((a, b) => b.a - a.a);
    }
    function misSalaries(months) {
      const o = {};
      months.forEach(m => (misSal[m] || []).forEach(r => { if (r.a) o[r.d] = (o[r.d] || 0) + r.a; }));
      return Object.entries(o).map(([d, a]) => ({ dept: d, label: SAL_LABEL[d] || d, a }));
    }
    function profFees(months) {
      const o = {};
      months.forEach(m => (prof[m] || []).forEach(r => { o[r.b] = (o[r.b] || 0) + r.a; }));
      return Object.entries(o).map(([label, a]) => ({ label, a })).sort((a, b) => b.a - a.a);
    }
    const lastMis = misMonths[misMonths.length - 1];
    const curFY = fyOf(lastMis);
    const ytd = fyMonths(curFY, misMonths);

    return {
      D, MON, MON_LONG, idx, fromIdx, shortM, longM, sortM, fyOf, fyMonths, inr, lakh, pct,
      cfMonths, base, status, forecastFrom, asOfMonth, asOfText, lastActual, SCEN, TIERS, TIER_NAME,
      addon, scen, closing, tierNet, tierMonth, turns, brief, horizon, horizonEnd, scenarioKey, dealNames, PROB, whatIf, verdict, watch,
      receipts, payments, salaries, level, levels, SAL_LABEL, EXP_LABEL,
      misMonths, pl, budget, customers, ledgers, misSalaries, profFees, lastMis, curFY, ytd, DEPTS
    };
  }
  root.TMCModel = { create };
})(typeof window !== 'undefined' ? window : this);
