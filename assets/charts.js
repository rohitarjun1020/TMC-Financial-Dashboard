/* Small SVG chart kit for the TMC dashboard: a multi-series line chart with a crosshair and
   month stamps, and a diverging column chart (money in above the line, money out below).
   Both are keyboard reachable (arrow keys move the readout) and redraw on resize. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || v;
  const color = c => (c && c.startsWith('--') ? css(c) : c);

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, raw = span / (count || 5), mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= (count || 5)) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  function tooltip(host) {
    let t = host.querySelector('.tip');
    if (!t) { t = document.createElement('div'); t.className = 'tip'; t.setAttribute('aria-hidden', 'true'); host.appendChild(t); }
    return t;
  }
  function fillTip(t, head, sub, rows) {
    t.textContent = '';
    const h = document.createElement('div'); h.className = 't-h';
    const hs = document.createElement('span'); hs.textContent = head; h.appendChild(hs);
    if (sub) { const e = document.createElement('em'); e.textContent = sub; h.appendChild(e); }
    t.appendChild(h);
    rows.forEach(r => {
      const row = document.createElement('div'); row.className = 't-r';
      const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = color(r.color); s.appendChild(i); s.appendChild(document.createTextNode(r.label));
      const b = document.createElement('b'); b.textContent = r.value;
      row.appendChild(s); row.appendChild(b); t.appendChild(row);
    });
  }

  /* status glyph under a month: actual = solid ring with a tick, in progress = dotted, forecast = dashed */
  function stampGlyph(g, cx, cy, status) {
    const ink = status === 'forecast' ? css('--ink-3') : css('--stamp');
    const c = el('circle', { cx, cy, r: 7, fill: 'none', stroke: ink, 'stroke-width': status === 'progress' ? 2 : 1.5 }, g);
    if (status === 'forecast') c.setAttribute('stroke-dasharray', '2.5 2');
    if (status === 'progress') c.setAttribute('stroke-dasharray', '1 2.2');
    if (status === 'actual') el('path', { d: `M${cx - 3} ${cy} l2 2.2 l4 -4.4`, fill: 'none', stroke: ink, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  }

  /* ---------------- line chart ---------------- */
  function line(host, o) {
    host.classList.add('chart');
    const draw = () => {
      host.querySelectorAll('svg').forEach(s => s.remove());
      const W = Math.max(320, host.clientWidth), H = o.height || 340, narrow = W < 560;
      const padL = narrow ? 44 : 56, padR = o.endLabels === false ? 16 : (narrow ? 16 : 128), padT = 14, padB = o.statusOf ? 52 : 32;
      const months = o.months, n = months.length;
      const all = o.series.flatMap(s => s.values.filter(v => v != null));
      const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), narrow ? 4 : 6);
      const y0 = ticks[0], y1 = ticks[ticks.length - 1];
      const X = i => padL + (n === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
      const Y = v => padT + (y1 - v) * (H - padT - padB) / (y1 - y0);
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', tabindex: 0, 'aria-label': o.label || 'Chart' });
      host.insertBefore(svg, host.firstChild);
      const ax = el('g', { class: 'ax' }, svg);
      // forecast region
      if (o.statusOf) {
        const fi = months.findIndex(m => o.statusOf(m) !== 'actual');
        if (fi > 0) el('rect', { x: X(fi) - (X(1) - X(0)) / 2, y: padT, width: W - padR - (X(fi) - (X(1) - X(0)) / 2), height: H - padT - padB, fill: css('--paper-2') }, ax);
      }
      ticks.forEach(t => {
        el('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), class: t === 0 ? 'zero' : 'g' }, ax);
        const tx = el('text', { x: padL - 8, y: Y(t) + 4, 'text-anchor': 'end' }, ax); tx.textContent = o.fmtAxis ? o.fmtAxis(t) : t;
      });
      // shortfall wash below zero
      if (y0 < 0) el('rect', { x: padL, y: Y(0), width: W - padL - padR, height: Y(y0) - Y(0), fill: css('--neg-soft') }, ax);
      const every = Math.ceil(n / (narrow ? 5 : 12));
      const showLab = i => (i === n - 1) || (!(i % every) && n - 1 - i >= every * 0.75);
      months.forEach((m, i) => {
        if (!showLab(i)) return;
        const tx = el('text', { x: X(i), y: H - padB + 18, 'text-anchor': 'middle' }, ax); tx.textContent = o.fmtMonth ? o.fmtMonth(m) : m;
      });
      if (o.statusOf) {
        const sg = el('g', { 'aria-hidden': 'true' }, svg);
        months.forEach((m, i) => { if (showLab(i) || !narrow) stampGlyph(sg, X(i), H - padB + 36, o.statusOf(m)); });
      }
      // series
      const sorted = [...o.series].sort((a, b) => (a.emph ? 1 : 0) - (b.emph ? 1 : 0));
      sorted.forEach(s => {
        const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
        if (!pts.length) return;
        const p = el('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: color(s.color), 'stroke-width': s.emph ? 3 : 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.dim ? 0.35 : 1 }, svg);
        if (s.dash) p.setAttribute('stroke-dasharray', '6 5');
        const last = pts[pts.length - 1];
        el('circle', { cx: last[0], cy: last[1], r: s.emph ? 5 : 4, fill: color(s.color), stroke: css('--paper'), 'stroke-width': 2, opacity: s.dim ? 0.5 : 1 }, svg);
      });
      // end labels with simple collision push
      if (o.endLabels !== false && !narrow) {
        const labs = o.series.map(s => { const v = s.values[n - 1]; return v == null ? null : { s, y: Y(v), v }; }).filter(Boolean).sort((a, b) => a.y - b.y);
        for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 34) labs[i].y = labs[i - 1].y + 34;
        labs.forEach(l => {
          const g = el('g', {}, svg);
          el('line', { x1: X(n - 1) + 7, x2: X(n - 1) + 16, y1: Y(l.v), y2: l.y, stroke: css('--rule'), 'stroke-width': 1 }, g);
          const t1 = el('text', { x: X(n - 1) + 20, y: l.y - 2, style: `font:600 14px var(--font);fill:${css('--ink')}` }, g); t1.textContent = o.fmtEnd ? o.fmtEnd(l.v) : l.v;
          const t2 = el('text', { x: X(n - 1) + 20, y: l.y + 13, style: `font:500 12px var(--font);fill:${css('--ink-3')}` }, g); t2.textContent = l.s.label;
        });
      }
      // crosshair + tooltip
      const cross = el('line', { y1: padT, y2: H - padB, stroke: css('--ink-3'), 'stroke-width': 1, opacity: 0 }, svg);
      const dots = o.series.map(s => el('circle', { r: 4.5, fill: color(s.color), stroke: css('--paper'), 'stroke-width': 2, opacity: 0 }, svg));
      const tip = tooltip(host);
      let cur = -1;
      const show = i => {
        cur = Math.max(0, Math.min(n - 1, i));
        const x = X(cur);
        cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('opacity', 1);
        o.series.forEach((s, k) => { const v = s.values[cur]; if (v == null) { dots[k].setAttribute('opacity', 0); return; } dots[k].setAttribute('cx', x); dots[k].setAttribute('cy', Y(v)); dots[k].setAttribute('opacity', 1); });
        const ys = o.series.map(s => s.values[cur]).filter(v => v != null);
        fillTip(tip, o.fmtTipHead ? o.fmtTipHead(months[cur]) : months[cur], o.statusOf ? o.statusName(o.statusOf(months[cur])) : '',
          o.series.map(s => ({ label: s.label, color: s.color, value: s.values[cur] == null ? '—' : o.fmtTip(s.values[cur]) })).sort((a, b) => 0));
        tip.style.left = Math.min(Math.max(x / W * host.clientWidth, 100), host.clientWidth - 100) + 'px';
        tip.style.top = (Math.min(...ys.map(Y)) / H * svg.getBoundingClientRect().height) + 'px';
        tip.classList.add('on');
        if (o.onPick) o.onPick(months[cur]);
      };
      const hide = () => { cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); tip.classList.remove('on'); };
      svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W; show(Math.round((x - padL) / ((W - padL - padR) / Math.max(1, n - 1)))); });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('blur', hide);
      svg.addEventListener('focus', () => show(cur < 0 ? n - 1 : cur));
      svg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { show(cur + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { show(cur - 1); e.preventDefault(); } else if (e.key === 'Home') show(0); else if (e.key === 'End') show(n - 1); });
    };
    draw();
    observe(host, draw);
  }

  /* ---------------- diverging columns ---------------- */
  function columns(host, o) {
    host.classList.add('chart');
    const draw = () => {
      host.querySelectorAll('svg').forEach(s => s.remove());
      const W = Math.max(320, host.clientWidth), H = o.height || 300, narrow = W < 560;
      const padL = narrow ? 44 : 56, padR = 12, padT = 12, padB = o.statusOf ? 50 : 30;
      const months = o.months, n = months.length;
      const upT = months.map((_, i) => o.up.reduce((a, s) => a + (s.values[i] || 0), 0));
      const dnT = months.map((_, i) => (o.down || []).reduce((a, s) => a + (s.values[i] || 0), 0));
      const lv = o.line ? o.line.values.filter(v => v != null) : [];
      const ticks = niceTicks(Math.min(-Math.max(0, ...dnT), ...lv, 0), Math.max(0, ...upT, ...lv), narrow ? 4 : 6);
      const y0 = ticks[0], y1 = ticks[ticks.length - 1];
      const band = (W - padL - padR) / n, bw = Math.min(24, band * 0.62);
      const X = i => padL + band * i + band / 2;
      const Y = v => padT + (y1 - v) * (H - padT - padB) / (y1 - y0);
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', tabindex: 0, 'aria-label': o.label || 'Chart' });
      host.insertBefore(svg, host.firstChild);
      const ax = el('g', { class: 'ax' }, svg);
      if (o.statusOf) {
        const fi = months.findIndex(m => o.statusOf(m) !== 'actual');
        if (fi > 0) el('rect', { x: padL + band * fi, y: padT, width: W - padR - padL - band * fi, height: H - padT - padB, fill: css('--paper-2') }, ax);
      }
      ticks.forEach(t => {
        el('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), class: t === 0 ? 'zero' : 'g' }, ax);
        const tx = el('text', { x: padL - 8, y: Y(t) + 4, 'text-anchor': 'end' }, ax); tx.textContent = o.fmtAxis ? o.fmtAxis(Math.abs(t)) : t;
      });
      const every = Math.ceil(n / (narrow ? 6 : 14));
      months.forEach((m, i) => {
        if (!((i === n - 1) || (!(i % every) && n - 1 - i >= every * 0.75))) return;
        const tx = el('text', { x: X(i), y: H - padB + 18, 'text-anchor': 'middle' }, ax); tx.textContent = o.fmtMonth ? o.fmtMonth(m) : m;
        if (o.statusOf) stampGlyph(ax, X(i), H - padB + 35, o.statusOf(m));
      });
      const r = 4;
      const bar = (x, yTop, yBot, fill, roundTop) => {
        const h = Math.max(0, yBot - yTop); if (h < 0.5) return;
        const rr = Math.min(r, h, bw / 2);
        const d = roundTop
          ? `M${x - bw / 2},${yBot}V${yTop + rr}Q${x - bw / 2},${yTop} ${x - bw / 2 + rr},${yTop}H${x + bw / 2 - rr}Q${x + bw / 2},${yTop} ${x + bw / 2},${yTop + rr}V${yBot}Z`
          : `M${x - bw / 2},${yTop}V${yBot - rr}Q${x - bw / 2},${yBot} ${x - bw / 2 + rr},${yBot}H${x + bw / 2 - rr}Q${x + bw / 2},${yBot} ${x + bw / 2},${yBot - rr}V${yTop}Z`;
        el('path', { d, fill }, svg);
      };
      months.forEach((m, i) => {
        let acc = 0;
        const ups = o.up.map(s => ({ s, v: s.values[i] || 0 })).filter(x => x.v > 0);
        ups.forEach((u, k) => { const top = Y(acc + u.v), bot = Y(acc) - (k ? 1 : 0); bar(X(i), top + (k < ups.length - 1 ? 1 : 0), bot, color(u.s.color), k === ups.length - 1); acc += u.v; });
        acc = 0;
        const dns = (o.down || []).map(s => ({ s, v: s.values[i] || 0 })).filter(x => x.v > 0);
        dns.forEach((u, k) => { const top = Y(-acc) + (k ? 1 : 0), bot = Y(-(acc + u.v)); bar(X(i), top, bot - (k < dns.length - 1 ? 1 : 0), color(u.s.color), false); acc += u.v; });
      });
      if (o.line) {
        const pts = o.line.values.map((v, i) => [X(i), Y(v)]);
        el('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: color(o.line.color), 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
        pts.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 3.5, fill: color(o.line.color), stroke: css('--paper'), 'stroke-width': 2 }, svg));
      }
      const hl = el('rect', { y: padT, height: H - padT - padB, width: band, fill: css('--ink'), opacity: 0 }, svg);
      hl.style.pointerEvents = 'none';
      const tip = tooltip(host);
      let cur = -1;
      const show = i => {
        cur = Math.max(0, Math.min(n - 1, i));
        hl.setAttribute('x', padL + band * cur); hl.setAttribute('opacity', 0.05);
        const rows = o.up.map(s => ({ label: s.label, color: s.color, value: o.fmtTip(s.values[cur] || 0) }))
          .concat((o.down || []).map(s => ({ label: s.label, color: s.color, value: o.fmtTip(-(s.values[cur] || 0)) })));
        if (o.line) rows.push({ label: o.line.label, color: o.line.color, value: o.fmtTip(o.line.values[cur]) });
        fillTip(tip, o.fmtTipHead ? o.fmtTipHead(months[cur]) : months[cur], o.statusOf ? o.statusName(o.statusOf(months[cur])) : '', rows.filter(r => r.value !== o.fmtTip(0) || o.keepZero));
        tip.style.left = Math.min(Math.max(X(cur) / W * host.clientWidth, 100), host.clientWidth - 100) + 'px';
        tip.style.top = (Y(upT[cur]) / H * svg.getBoundingClientRect().height) + 'px';
        tip.classList.add('on');
      };
      const hide = () => { hl.setAttribute('opacity', 0); tip.classList.remove('on'); };
      svg.addEventListener('pointermove', e => { const rc = svg.getBoundingClientRect(); show(Math.floor(((e.clientX - rc.left) / rc.width * W - padL) / band)); });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('blur', hide);
      svg.addEventListener('focus', () => show(cur < 0 ? n - 1 : cur));
      svg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { show(cur + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { show(cur - 1); e.preventDefault(); } });
      if (o.onPick) svg.addEventListener('click', () => { if (cur >= 0) o.onPick(months[cur]); });
    };
    draw();
    observe(host, draw);
  }

  /* guilloché: overlapping hypotrochoid rosettes drawn at one device pixel in three ink values */
  function guilloche(host, opts) {
    const o = Object.assign({ w: 1400, h: 300, cx: 0.86, cy: 0.5, scale: 1.05 }, opts || {});
    const svg = el('svg', { viewBox: `0 0 ${o.w} ${o.h}`, preserveAspectRatio: 'xMaxYMid slice', class: o.cls || 'dp-guil', 'aria-hidden': 'true' });
    const inks = ['--guil-1', '--guil-2', '--guil-3'];
    [[118, 23, 58, 0], [96, 17, 44, 1], [150, 31, 70, 2]].map(a => [a[0] * o.scale, a[1] * o.scale, a[2] * o.scale, a[3]]).forEach(([R, r, d, k]) => {
      let p = '';
      const cx = o.w * o.cx, cy = o.h * o.cy, steps = 1400, turns = Math.round(r) / gcd(Math.round(R), Math.round(r));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * Math.PI * 2 * turns;
        const x = cx + (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t);
        const y = cy + ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t)) * 0.92;
        p += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      el('path', { d: p, fill: 'none', stroke: `var(${inks[k]})`, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, svg);
    });
    host.insertBefore(svg, host.firstChild);
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  const watchers = new WeakMap();
  function observe(host, fn) {
    if (watchers.has(host)) watchers.get(host).disconnect();
    let w = host.clientWidth, t;
    const ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - w) < 2) return; w = host.clientWidth; clearTimeout(t); t = setTimeout(fn, 60); });
    ro.observe(host); watchers.set(host, ro);
  }
  root.TMCCharts = { line, columns, guilloche, niceTicks };
})(window);
