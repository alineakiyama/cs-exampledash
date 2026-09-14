/* =========================================================================
   Gráficos em SVG inline e formatadores. Sem biblioteca.
   Um eixo só por gráfico; marca fina; grade discreta; hover em todos.
   ========================================================================= */
window.C = (function () {
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtInt = (n) => (n == null ? '—' : nf0.format(n));
  const fmtPct = (n, d = 1) => (n == null ? '—' : (d === 2 ? nf2 : nf1).format(n) + '%');
  const fmtPp = (n, d = 1) => (n == null ? '—' : (d === 2 ? nf2 : nf1).format(n) + ' pp');
  const fmtMoney = (n, cents = false) => (n == null ? '—' : '$' + (cents ? nf2 : nf0).format(n));
  const fmtStars = (n) => (n == null ? '—' : nf2.format(n));
  function fmtHours(h) {
    if (h == null) return '—';
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) { const H = Math.floor(h); return `${H}h ${String(Math.round((h - H) * 60)).padStart(2, '0')}m`; }
    const d = Math.floor(h / 24); const H = Math.round(h - d * 24);
    return `${d}d ${H}h`;
  }

  const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parseDay = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDay = (iso) => { const d = parseDay(iso); return `${MONTH[d.getMonth()]} ${d.getDate()}`; };
  const fmtDayShort = (iso) => { const d = parseDay(iso); return `${WEEKDAY[d.getDay()]} ${d.getDate()}`; };
  const fmtDayFull = (iso) => { const d = parseDay(iso); return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
  const fmtRange = (a, b) => (a === b ? fmtDayFull(a) : `${fmtDay(a)} – ${fmtDayFull(b)}`);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ------------------------------------------------------------ peças --- */
  const CHIP = { good: 'on target', warn: 'watch', crit: 'off target' };
  const chip = (st, label) => (st === 'none' || !st ? '' : `<span class="chip chip--${st}">${esc(label ?? CHIP[st])}</span>`);

  /* Cartão de KPI. delta vem de M.change(). */
  function tile({ label, value, unit, delta, deltaText, prevText, status, foot, hero }) {
    let d = '';
    if (delta && delta.delta != null) {
      const cls = delta.tone === 'flat' ? 'delta--flat' : delta.tone === 'good' ? 'delta--good' : 'delta--bad';
      const arrow = delta.tone === 'flat' ? '•' : delta.delta > 0 ? '↑' : '↓';
      d = `<p class="kpi__delta"><span class="delta ${cls}">${arrow} ${esc(deltaText)}</span><span class="kpi__prev">${esc(prevText ?? '')}</span></p>`;
    }
    return `<article class="kpi${hero ? ' kpi--hero' : ''}">
      <div class="kpi__head"><p class="kpi__label">${esc(label)}</p>${chip(status)}</div>
      <p class="kpi__value">${esc(value)}${unit ? `<span class="kpi__unit">${esc(unit)}</span>` : ''}</p>
      ${foot ? `<p class="kpi__foot">${esc(foot)}</p>` : ''}
      ${d}
    </article>`;
  }

  const legend = (items) => `<div class="legend">${items.map((i) =>
    `<span class="legend__item"><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join('')}</div>`;

  /* Barras deitadas: comparar magnitude entre categorias. Uma cor só. */
  function barList(items, { format = fmtInt, color = 'var(--series-1)' } = {}) {
    const top = Math.max(1, ...items.map((i) => i.value || 0));
    return `<div class="bars">${items.map((i) => `
      <div class="bar" title="${esc(i.label)}: ${esc(format(i.value))}">
        <span class="bar__label">${esc(i.label)}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${(((i.value || 0) / top) * 100).toFixed(2)}%;background:${i.color || color}"></span></span>
        <span class="bar__value">${esc(format(i.value))}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span>
      </div>`).join('')}</div>`;
  }

  function stackedRow(segs, { format = fmtInt } = {}) {
    const total = segs.reduce((t, s) => t + s.value, 0) || 1;
    return `<div class="stack">${segs.filter((s) => s.value > 0).map((s) =>
      `<span style="flex:0 0 ${((s.value / total) * 100).toFixed(3)}%;background:${s.color}" title="${esc(s.label)}: ${esc(format(s.value))} (${nf1.format((s.value / total) * 100)}%)"></span>`).join('')}</div>`;
  }

  /* --------------------------------------------------------- gráficos --- */
  const W = 800, PAD = { t: 14, r: 16, b: 28, l: 42 };
  function nice(max) {
    if (!(max > 0)) return { top: 10, ticks: [0, 5, 10] };
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const top = Math.ceil(max / step) * step;
    const ticks = []; for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { top, ticks };
  }

  function lineChart({ days, series, height = 240, formatValue = fmtInt, xLabel = fmtDayShort, titles, ariaLabel, top: forcedTop }) {
    const H = height, padR = 90;
    const iw = W - PAD.l - padR, ih = H - PAD.t - PAD.b;
    const { top, ticks } = forcedTop ? { top: forcedTop, ticks: nice(forcedTop).ticks.filter((t) => t <= forcedTop) } : nice(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null))));
    const x = (i) => PAD.l + (days.length === 1 ? iw / 2 : (i / (days.length - 1)) * iw);
    const y = (v) => PAD.t + ih - (v / top) * ih;

    const grid = ticks.map((t) => `<line class="grid" x1="${PAD.l}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
      <text class="tick" x="${PAD.l - 8}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${formatValue(t)}</text>`).join('');
    const every = Math.max(1, Math.ceil(days.length / 9));
    const xl = days.map((d, i) => (i % every === 0 ? `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(xLabel(d))}</text>` : '')).join('');

    const paths = series.map((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
      return pts.length ? `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/>` : '';
    }).join('');

    // Rótulo direto na ponta, afastado se duas séries convergem.
    const last = days.length - 1;
    const marks = series.map((s) => ({ label: s.label, color: s.color, v: s.values[last] })).filter((m) => m.v != null).map((m) => ({ ...m, yv: y(m.v) })).sort((a, b) => a.yv - b.yv);
    for (let i = 1; i < marks.length; i++) if (marks[i].yv - marks[i - 1].yv < 13) marks[i].yv = marks[i - 1].yv + 13;
    const labels = marks.map((m) => `<text x="${(x(last) + 10).toFixed(1)}" y="${(m.yv + 3.5).toFixed(1)}" class="direct" fill="${m.color}">${esc(m.label)}</text>`).join('');

    const band = iw / Math.max(1, days.length - 1);
    const hits = days.map((d, i) => {
      const data = esc(JSON.stringify({ title: titles?.[i] ?? fmtDayFull(d), rows: series.map((s) => ({ label: s.label, color: s.color, value: s.values[i], fmt: s.fmt })) }));
      return `<rect class="hit" data-tt="${data}" data-x="${x(i).toFixed(1)}" x="${(x(i) - band / 2).toFixed(1)}" y="${PAD.t}" width="${band.toFixed(1)}" height="${ih}"/>`;
    }).join('');
    const dots = series.map((s) => s.values.map((v, i) => (v == null ? '' : `<circle class="dot" data-dot="${i}" r="4" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" fill="${s.color}" opacity="0"/>`)).join('')).join('');

    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel ?? '')}" data-chart>
      ${grid}<line class="base" x1="${PAD.l}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${xl}
      <line class="cross" x1="0" x2="0" y1="${PAD.t}" y2="${PAD.t + ih}" opacity="0"/>${paths}${labels}${dots}${hits}</svg>`;
  }

  function columnChart({ days, values, height = 200, color = 'var(--series-1)', formatValue = fmtInt, label, xLabel = fmtDayShort, titles, fmt }) {
    const H = height, iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const { top, ticks } = nice(Math.max(1, ...values.filter((v) => v != null)));
    const y = (v) => PAD.t + ih - (v / top) * ih;
    const slot = iw / days.length, bw = Math.min(34, slot * 0.62);
    const grid = ticks.map((t) => `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
      <text class="tick" x="${PAD.l - 8}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${formatValue(t)}</text>`).join('');
    const bars = values.map((v, i) => {
      const cx = PAD.l + slot * i + slot / 2, h = Math.max(0, PAD.t + ih - y(v ?? 0));
      const data = esc(JSON.stringify({ title: titles?.[i] ?? fmtDayFull(days[i]), rows: [{ label, color, value: v, fmt }] }));
      return `<rect class="hit" data-tt="${data}" x="${(cx - slot / 2).toFixed(1)}" y="${PAD.t}" width="${slot.toFixed(1)}" height="${ih}"/>
        <rect x="${(cx - bw / 2).toFixed(1)}" y="${y(v ?? 0).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" pointer-events="none"/>`;
    }).join('');
    const every = Math.max(1, Math.ceil(days.length / 9));
    const xl = days.map((d, i) => (i % every === 0 ? `<text class="tick" x="${(PAD.l + slot * i + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(xLabel(d))}</text>` : '')).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label ?? '')}" data-chart>
      ${grid}${bars}<line class="base" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${xl}</svg>`;
  }

  /* ------------------------------------------------------------ hover --- */
  const FMT = { int: fmtInt, hours: fmtHours, money: (v) => fmtMoney(v, true), pct: fmtPct, stars: fmtStars };
  let tip = null;
  function showTip(html, ev) {
    tip = tip || document.getElementById('tooltip');
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = ev.clientX + 14, top = ev.clientY - r.height - 12;
    if (left + r.width > innerWidth - 8) left = ev.clientX - r.width - 14;
    if (top < 8) top = ev.clientY + 18;
    tip.style.left = `${Math.max(8, left)}px`; tip.style.top = `${top}px`;
  }
  const hideTip = () => { if (tip) tip.hidden = true; };

  function wire(root) {
    root.querySelectorAll('svg[data-chart]').forEach((svg) => {
      const cross = svg.querySelector('.cross'), dots = svg.querySelectorAll('.dot');
      svg.querySelectorAll('.hit').forEach((hit, idx) => {
        hit.addEventListener('mousemove', (ev) => {
          let p; try { p = JSON.parse(hit.dataset.tt); } catch { return; }
          const rows = p.rows.filter((r) => r.value != null).map((r) =>
            `<span class="tt-row"><span><i style="background:${r.color}"></i>${esc(r.label)}</span><b>${esc((FMT[r.fmt] || fmtInt)(r.value))}</b></span>`).join('');
          showTip(`<b class="tt-title">${esc(p.title)}</b>${rows}`, ev);
          if (cross && hit.dataset.x) { cross.setAttribute('x1', hit.dataset.x); cross.setAttribute('x2', hit.dataset.x); cross.setAttribute('opacity', '1'); }
          dots.forEach((d) => d.setAttribute('opacity', d.dataset.dot === String(idx) ? '1' : '0'));
        });
        hit.addEventListener('mouseleave', () => { hideTip(); if (cross) cross.setAttribute('opacity', '0'); dots.forEach((d) => d.setAttribute('opacity', '0')); });
      });
    });
  }

  return { fmtInt, fmtPct, fmtPp, fmtMoney, fmtHours, fmtStars, fmtDay, fmtDayShort, fmtDayFull, fmtRange, esc,
    chip, tile, legend, barList, stackedRow, lineChart, columnChart, wire };
})();
