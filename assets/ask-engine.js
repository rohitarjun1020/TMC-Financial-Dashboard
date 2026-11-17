/* Built-in "Ask the data": recognises common question types and answers them in code from the
   TMC model. No AI, no network. Each answer names its source (MIS or Cash flow), the months used,
   and carries a small table and optional bar list. */
(function (root) {
  'use strict';
  function create(M) {
    const MONTHS = {};
    M.MON_LONG.forEach((n, i) => { MONTHS[n.toLowerCase()] = i; MONTHS[n.slice(0, 3).toLowerCase()] = i; });
    MONTHS.sept = 8;
    const L = M.lakh, I = M.inr;
    /* a figure in lakh with the exact rupees; negatives read as a shortfall, never double brackets */
    const both = (v, word) => v < 0 ? `${L(v)}, ${word || 'a shortfall of'} ${I(-v)}` : `${L(v)} (${I(v)})`;
    const CLIENTS = ['somika', 'tata', 'vinmart', 'vmf', 'booby', 'nitin', 'jambo', 'mn square', 'kalyan', 'devi'];

    /* ---- parsing helpers ---- */
    function norm(q) { return ' ' + q.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9&.\-' ]+/g, ' ').replace(/\s+/g, ' ') + ' '; }
    function findMonths(q, pool) {
      const found = [];
      const re = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[\s\-']*(20\d\d|\d\d)?/g;
      let mm;
      while ((mm = re.exec(q))) {
        const mi = MONTHS[mm[1]] != null ? MONTHS[mm[1]] : MONTHS[mm[1].slice(0, 3)];
        if (mi == null) continue;
        let yr = mm[2] ? +(mm[2].length === 2 ? '20' + mm[2] : mm[2]) : null;
        const name = M.MON[mi];
        let cand = pool.filter(m => m.startsWith(name + '-'));
        if (yr) cand = cand.filter(m => m.endsWith(String(yr)));
        if (!cand.length) continue;
        // no year given: prefer the current financial year of the pool, else the latest
        const pick = yr ? cand[0] : (cand.find(m => M.fyOf(m) === M.fyOf(pool === M.cfMonths ? M.lastActual : M.lastMis)) || cand[cand.length - 1]);
        if (!found.includes(pick)) found.push(pick);
      }
      if (/\b(this|current) month\b/.test(q)) found.push(pool === M.cfMonths ? (M.asOfMonth || M.lastActual) : M.lastMis);
      if (/\blast month\b/.test(q)) found.push(pool === M.cfMonths ? M.lastActual : M.lastMis);
      if (/\bnext month\b/.test(q) && pool === M.cfMonths) found.push(M.fromIdx(M.idx(M.asOfMonth || M.lastActual) + 1));
      return M.sortM([...new Set(found)].filter(m => pool.includes(m)));
    }
    function findFY(q, pool) {
      const mm = /\bfy\s*'?(20)?(\d\d)\s*[-\/]?\s*(20)?(\d\d)?\b/.exec(q) || /\b(20)(\d\d)\s*-\s*(20)?(\d\d)\b/.exec(q);
      if (!mm) return null;
      const y = 2000 + (+mm[2]);
      const fy = 'FY ' + y + '-' + String(y + 1).slice(2);
      const ms = M.fyMonths(fy, pool);
      return ms.length ? { fy, months: ms } : null;
    }
    function findScenario(q) {
      if (/\b(s3|scenario 3|scenario three|all likel|low likel|all pipeline|all three)\b/.test(q)) return 'all';
      if (/\b(s2|scenario 2|scenario two|medium likel)\b/.test(q)) return 'med';
      if (/\b(s1|scenario 1|scenario one|highly likel|high likel)\b/.test(q)) return 'high';
      if (/\b(base|no pipeline|confirmed only|without pipeline)\b/.test(q)) return 'none';
      return null;
    }
    const has = (q, ...words) => words.some(w => q.includes(w));
    const list = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
    const ml = m => M.longM(m);
    const statusWord = m => ({ actual: 'actual', progress: 'in progress', forecast: 'forecast' })[M.status(m)];

    /* ---- answer builders ---- */
    function ans(o) { return Object.assign({ table: null, bars: null, followups: [] }, o); }

    function closingAns(q) {
      let ms = findMonths(q, M.cfMonths);
      if (!ms.length) ms = [M.horizonEnd];
      const s = findScenario(q);
      const scens = s ? [s] : ['none', 'high', 'med', 'all'];
      const rows = [];
      ms.forEach(m => scens.forEach(k => rows.push([ml(m) + (scens.length > 1 ? ' · ' + M.SCEN[k].short : ''), statusWord(m), I(M.closing(k, m))])));
      const m0 = ms[ms.length - 1];
      let text;
      if (scens.length === 1) {
        const v = M.closing(scens[0], m0);
        text = `${M.SCEN[scens[0]].name} closes ${ml(m0)} at ${both(v)}, ${statusWord(m0)}.`;
      } else {
        text = `${ml(m0)} closing cash: base case ${L(M.closing('none', m0))}; Scenario 1 ${L(M.closing('high', m0))}, Scenario 2 ${L(M.closing('med', m0))}, Scenario 3 ${L(M.closing('all', m0))}.`;
        if (M.status(m0) === 'actual') text = `${ml(m0)} closed at ${both(M.closing('none', m0))}. It is an actual month, so every scenario is the same.`;
      }
      return ans({ text, source: 'Cash flow', months: ms, table: { cols: ['Month', 'Status', 'Closing cash'], rows },
        bars: scens.length > 1 && ms.length === 1 && M.status(m0) !== 'actual' ? scens.map(k => ({ label: M.SCEN[k].short, a: M.closing(k, m0), key: k })) : null,
        followups: ['When does the base case go negative?', 'What does Scenario 1 add?'] });
    }

    function runwayAns() {
      const t = M.turns('none');
      const rows = ['none', 'high', 'med', 'all'].map(k => { const tt = M.turns(k); return [M.SCEN[k].name, tt.firstNegative ? ml(tt.firstNegative.m) + ' · ' + L(tt.firstNegative.cb) : 'Stays positive to ' + ml(M.cfMonths[M.cfMonths.length - 1]), tt.pinch ? ml(tt.pinch.m) + ' · ' + L(tt.pinch.cb) : '—']; });
      const text = t.firstNegative
        ? `On confirmed business alone, cash stays positive through ${ml(M.fromIdx(M.idx(t.firstNegative.m) - 1))}${t.pinch ? `, with ${ml(t.pinch.m)} the lowest positive month at ${L(t.pinch.cb)}` : ''}, and goes below zero in ${ml(t.firstNegative.m)} at ${L(t.firstNegative.cb)}.`
        : 'On confirmed business alone, cash stays positive through the whole forecast.';
      return ans({ text, source: 'Cash flow', months: M.cfMonths.filter(m => M.idx(m) >= M.idx(M.lastActual)), table: { cols: ['Scenario', 'First month below zero', 'Lowest positive month'], rows },
        followups: ['What is the March 2027 closing by scenario?', 'What does Scenario 1 add?'] });
    }

    function pipelineAns(q) {
      const tiers = /medium/.test(q) || /\bs2\b|scenario 2/.test(q) ? ['MediumLikely'] : /low likel|\bs3\b|scenario 3/.test(q) ? ['LowLikely'] : /highly|\bs1\b|scenario 1/.test(q) ? ['HighlyLikely'] : ['HighlyLikely', 'MediumLikely', 'LowLikely'];
      const hz = M.horizon.filter(m => M.idx(m) >= M.idx(M.asOfMonth || M.lastActual));
      const rows = tiers.map(t => [M.TIER_NAME[t], I(hz.reduce((a, m) => a + M.tierMonth(t, m).rev, 0)), I(hz.reduce((a, m) => a + M.tierMonth(t, m).cost, 0)), I(M.tierNet(t, hz))]);
      const text = tiers.length === 1
        ? `${M.TIER_NAME[tiers[0]]} deals add ${L(M.tierNet(tiers[0], hz))} of net contribution (revenue less delivery cost) from ${ml(hz[0])} to ${ml(hz[hz.length - 1])}.`
        : `From ${ml(hz[0])} to ${ml(hz[hz.length - 1])}, Highly Likely deals add ${L(M.tierNet('HighlyLikely', hz))}, Medium Likely ${L(M.tierNet('MediumLikely', hz))} and Low Likely ${L(M.tierNet('LowLikely', hz))} of net contribution.`;
      return ans({ text, source: 'Cash flow', months: hz, table: { cols: ['Tier', 'Revenue', 'Delivery cost', 'Net'], rows },
        bars: hz.map(m => ({ label: M.shortM(m), a: tiers.reduce((a, t) => a + M.tierNet(t, [m]), 0) })), followups: ['What is the March 2027 closing by scenario?'] });
    }

    function receiptsAns(q) {
      let ms = findMonths(q, M.cfMonths);
      const fy = findFY(q, M.cfMonths);
      if (!ms.length) ms = fy ? fy.months : [M.asOfMonth || M.lastActual];
      const client = CLIENTS.find(c => q.includes(c));
      const tot = {};
      ms.forEach(m => M.receipts(m).forEach(r => { tot[r.label] = (tot[r.label] || 0) + r.a; }));
      let items = Object.entries(tot).map(([label, a]) => ({ label, a })).sort((a, b) => b.a - a.a);
      if (client) items = items.filter(i => i.label.toLowerCase().includes(client.split(' ')[0]));
      const total = items.reduce((a, b) => a + b.a, 0);
      const span = ms.length === 1 ? ml(ms[0]) : `${ml(ms[0])} to ${ml(ms[ms.length - 1])}`;
      if (!items.length) return ans({ text: `No receipts${client ? ' from ' + client : ''} are recorded for ${span}.`, source: 'Cash flow', months: ms });
      const top = items.slice(0, 3).map(i => `${i.label} ${L(i.a)}`);
      const text = `Receipts${client ? ' from ' + items[0].label : ''} for ${span}: ${both(total)}${ms.length === 1 ? ', ' + statusWord(ms[0]) : ''}. ${client ? '' : 'Largest: ' + list(top) + '.'}`;
      return ans({ text, source: 'Cash flow', months: ms, table: { cols: ['From', 'Amount'], rows: items.map(i => [i.label, I(i.a)]).concat([['Total', I(total)]]) },
        bars: items.slice(0, 8), followups: ['What are the payments this month?', 'What is the closing balance this month?'] });
    }

    function paymentsAns(q) {
      let ms = findMonths(q, M.cfMonths);
      if (!ms.length) ms = [M.asOfMonth || M.lastActual];
      const tot = {};
      ms.forEach(m => M.payments(m).forEach(r => { tot[r.label] = (tot[r.label] || 0) + r.a; }));
      const items = Object.entries(tot).map(([label, a]) => ({ label, a })).sort((a, b) => b.a - a.a);
      const total = items.reduce((a, b) => a + b.a, 0);
      const span = ms.length === 1 ? ml(ms[0]) : `${ml(ms[0])} to ${ml(ms[ms.length - 1])}`;
      const text = `Payments for ${span}: ${both(total)} in the base case${ms.length === 1 ? ', ' + statusWord(ms[0]) : ''}. Largest: ${list(items.slice(0, 3).map(i => `${i.label} ${L(i.a)}`))}.`;
      return ans({ text, source: 'Cash flow', months: ms, table: { cols: ['Category', 'Amount'], rows: items.map(i => [i.label, I(i.a)]).concat([['Total', I(total)]]) },
        bars: items.slice(0, 8), followups: ['What are the receipts this month?', 'Salaries by department this month?'] });
    }

    function salaryAns(q) {
      const useMis = has(q, 'mis', 'p&l', 'p & l', 'accrual', 'ytd', 'year to date');
      const pool = useMis ? M.misMonths : M.cfMonths;
      let ms = findMonths(q, pool);
      const fy = findFY(q, pool);
      if (!ms.length) ms = fy ? fy.months : useMis ? M.ytd : [M.asOfMonth || M.lastActual];
      const items = useMis ? M.misSalaries(ms) : (() => { const o = {}; ms.forEach(m => M.salaries(m).forEach(s => { o[s.label] = (o[s.label] || 0) + s.a; })); return Object.entries(o).map(([label, a]) => ({ label, a })); })();
      const total = items.reduce((a, b) => a + b.a, 0);
      const span = ms.length === 1 ? ml(ms[0]) : `${ml(ms[0])} to ${ml(ms[ms.length - 1])}`;
      const text = total ? `${useMis ? 'Salary cost booked in the P&L' : 'Salaries paid in cash'} for ${span}: ${both(total)}. ${list(items.map(i => `${i.label} ${L(i.a)}`))}. Salaries are shown by department only.`
        : `No salaries are recorded for ${span}${useMis ? '' : '; salary payments for that month fall in the next month'}.`;
      return ans({ text, source: useMis ? 'MIS' : 'Cash flow', months: ms, table: { cols: ['Department', 'Amount'], rows: items.map(i => [i.label, I(i.a)]).concat([['Total', I(total)]]) }, bars: items });
    }

    function misAns(q, what) {
      let ms = findMonths(q, M.misMonths);
      const fy = findFY(q, M.misMonths);
      if (!ms.length) ms = fy ? fy.months : has(q, 'ytd', 'year to date', 'this year', 'so far') ? M.ytd : [M.lastMis];
      const p = M.pl(ms), b = M.budget(ms);
      const span = ms.length === 1 ? ml(ms[0]) : `${ml(ms[0])} to ${ml(ms[ms.length - 1])}`;
      const rows = [['Revenue', I(p.revenue), b.has ? I(b.revenue) : '—'], ['Direct costs and operations salaries', I(p.cogs), b.has ? I(b.cogs) : '—'], ['Gross profit', I(p.gp), b.has ? I(b.gp) : '—'],
        ['Sales & marketing', I(p.sm), b.has ? I(b.sm) : '—'], ['General & admin', I(p.ga), b.has ? I(b.ga) : '—'], ['EBITDA', I(p.ebitda), b.has ? I(b.ebitda) : '—']];
      let text, bars = null;
      if (what === 'revenue') {
        const cust = M.customers(ms);
        text = `Revenue for ${span}: ${both(p.revenue)}${b.has ? `, against a budget of ${L(b.revenue)} (${M.pct(Math.abs(p.revenue - b.revenue), b.revenue)} ${p.revenue >= b.revenue ? 'above' : 'below'})` : ''}. By customer: ${list(cust.slice(0, 4).map(c => `${c.label} ${L(c.a)}`))}.`;
        bars = cust.slice(0, 8);
        return ans({ text, source: 'MIS', months: ms, table: { cols: ['Customer', 'Revenue'], rows: cust.map(c => [c.label, I(c.a)]).concat([['B2B total', I(cust.reduce((a, c) => a + c.a, 0))]]) }, bars, followups: ['What is EBITDA year to date?', 'Budget vs actual this year?'] });
      }
      if (what === 'ebitda') text = `EBITDA for ${span}: ${both(p.ebitda, 'a loss of')}, ${M.pct(p.ebitda, p.revenue)} of revenue${b.has ? `; budget was ${L(b.ebitda)}` : ''}.`;
      else if (what === 'gp') text = `Gross profit for ${span}: ${both(p.gp, 'a loss of')}, a ${M.pct(p.gp, p.revenue)} margin${b.has ? `; budget was ${L(b.gp)}` : ''}.`;
      else text = `${span}: revenue ${L(p.revenue)} vs budget ${b.has ? L(b.revenue) : '—'}; EBITDA ${L(p.ebitda)} vs budget ${b.has ? L(b.ebitda) : '—'}.`;
      return ans({ text, source: 'MIS', months: ms, table: { cols: ['Line', 'Actual', 'Budget'], rows }, followups: ['Revenue by customer this year?', 'Salaries by department in the P&L?'] });
    }

    function misCostAns(q) {
      let ms = findMonths(q, M.misMonths);
      if (!ms.length) ms = has(q, 'ytd', 'year to date', 'this year') ? M.ytd : [M.lastMis];
      const p = M.pl(ms);
      const keys = { travel: 'Travel Costs', software: 'Website & Software Costs', rent: 'Office Rent', marketing: 'Marketing Costs', professional: 'G&A-Professional Fees', consultant: 'S&M Consultants', teacher: 'B2B - Training Cost', trainer: 'B2B - Training Cost', recruitment: 'Recruitment Fees' };
      const k = Object.keys(keys).find(w => q.includes(w));
      const line = p.lines.find(l => l.p === keys[k]);
      const LINE_NAME = { 'Travel Costs': 'Travel cost', 'Website & Software Costs': 'Software and website cost', 'Office Rent': 'Office rent', 'Marketing Costs': 'Marketing cost', 'G&A-Professional Fees': 'Professional fees', 'S&M Consultants': 'S&M consultants', 'B2B - Training Cost': 'Trainer fees', 'Recruitment Fees': 'Recruitment fees' };
      const span = ms.length === 1 ? ml(ms[0]) : `${ml(ms[0])} to ${ml(ms[ms.length - 1])}`;
      if (!line) return null;
      const b = M.budget(ms).lines[line.d + '|' + line.p];
      const led = M.ledgers(ms).filter(l => l.line === line.p);
      return ans({ text: `${(LINE_NAME[line.p] || line.p)} for ${span}: ${both(line.a)}${b != null ? ` against a budget of ${L(b)}` : ''}.`, source: 'MIS', months: ms,
        table: led.length ? { cols: ['Ledger', 'Amount'], rows: led.map(l => [l.ledger, I(l.a)]) } : null });
    }

    /* ---- router ---- */
    function scenarioWhatAns(q) {
      const s = findScenario(q);
      const ks = s ? [s] : ['none', 'high', 'med', 'all'];
      const rows = ks.map(k => { const sk = M.scenarioKey(k); return [M.SCEN[k].name, sk.adds, sk.text]; });
      const text = s ? M.scenarioKey(s).text
        : 'Each scenario adds one more group of pipeline deals on top of the one before. The base case counts confirmed business only; ' + ['high', 'med', 'all'].map(k => `${M.SCEN[k].name} adds the ${M.TIER_NAME[M.scenarioKey(k).tier]} deals (${M.PROB[M.scenarioKey(k).tier]} chance of closing)`).join('; ') + '.';
      return ans({ text, source: 'Cash flow', months: [], table: { cols: ['Scenario', 'Adds', 'Includes'], rows }, followups: ['What is the March 2027 closing by scenario?', 'What does Scenario 1 add?'] });
    }
    const INTENTS = [
      { test: q => (/scenario|base case|\bs[123]\b/.test(q) && has(q, 'what is in', 'whats in', 'which deal', 'which client', 'include', 'mean', 'what is scenario', 'what are the scenario', 'explain', 'difference', 'stand for')) || has(q, 'which deals', 'which clients are in'), run: scenarioWhatAns },
      { test: q => has(q, 'runway', 'pinch', 'go negative', 'goes negative', 'below zero', 'run out', 'turn negative', 'turns negative', 'shortfall', 'deficit'), run: runwayAns },
      { test: q => has(q, 'pipeline', 'contribution', 'deal', 'w&b', 'invita', 'zenufa', ' tier', 'likely') || (/scenario/.test(q) && has(q, 'add', 'adds', 'worth')), run: pipelineAns },
      { test: q => has(q, 'salar', 'payroll', 'manpower', 'staff cost'), run: salaryAns },
      { test: q => has(q, 'ebitda'), run: q => misAns(q, 'ebitda') },
      { test: q => has(q, 'gross profit', 'gross margin', ' gp '), run: q => misAns(q, 'gp') },
      { test: q => has(q, 'budget', 'variance', 'vs plan', 'against plan'), run: q => misAns(q, 'budget') },
      { test: q => has(q, 'revenue', 'sales', 'billing', 'turnover') && !has(q, 'receipt', 'collect'), run: q => misAns(q, 'revenue') },
      { test: q => has(q, 'receipt', 'collection', 'collect', 'inflow', 'money in', 'coming in', 'received', 'get from', 'got from', 'paid us', 'pay us') || (CLIENTS.some(c => q.includes(c)) && !has(q, 'revenue', 'mis', 'p&l')), run: receiptsAns },
      { test: q => has(q, 'travel', 'software', 'rent', 'marketing', 'professional fee', 'consultant', 'teacher', 'trainer', 'recruitment') && has(q, 'mis', 'p&l', 'cost', 'spend', 'expense', 'ytd'), run: misCostAns },
      { test: q => has(q, 'payment', 'outflow', 'expense', 'spend', 'paying', 'pay out', 'paid', 'burn', 'costs'), run: paymentsAns },
      { test: q => has(q, 'closing', 'balance', 'cash', 'bank', 'end of', 'year end', 'scenario', 'march 2027', 'how much money'), run: closingAns }
    ];
    const SUGGEST = ['What does each scenario include?', 'What is the March 2027 closing by scenario?', 'When does the base case go negative?', 'What are the receipts this month?', 'What are the payments this month?',
      'Salaries by department this month?', 'What does Scenario 1 add?', 'Revenue by customer this year?', 'What is EBITDA year to date?', 'Budget vs actual this year?', 'Travel cost in the P&L year to date?'];

    function answer(raw) {
      const q = norm(raw || '');
      for (const it of INTENTS) {
        if (it.test(q)) { const a = it.run(q); if (a) return Object.assign({ ok: true }, a); }
      }
      const words = q.trim().split(' ').filter(w => w.length > 3);
      const scored = SUGGEST.map(s => ({ s, n: words.filter(w => s.toLowerCase().includes(w)).length })).sort((a, b) => b.n - a.n);
      return { ok: false, text: "I can't answer that one from the dashboard data on my own. These are the closest questions I can answer:", followups: scored.slice(0, 4).map(x => x.s), source: null, months: [] };
    }
    return { answer, SUGGEST };
  }
  root.TMCAsk = { create };
})(typeof window !== 'undefined' ? window : this);
