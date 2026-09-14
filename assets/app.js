/* Partida: liga filtros, decide o que mostrar, chama os renderizadores. */
(function () {
  const D = window.DATA, M = window.M, C = window.C;
  const $ = (s) => document.querySelector(s);
  const { fmtInt, fmtPct, fmtPp, fmtMoney, fmtHours, fmtStars, fmtDay, fmtDayFull, fmtRange, esc } = C;

  const STORE_COLOR = { store1: 'var(--store-1)', store2: 'var(--store-2)', store3: 'var(--store-3)', store4: 'var(--store-4)' };
  const storeName = (id) => (id ? D.stores.find((s) => s.id === id)?.name : 'All stores');
  const PRESETS = M.presets(D);
  const state = { view: 'overview', store: null, presetId: 'd7', window: null, compare: null };

  /* ------------------------------------------------------------- boot --- */
  function boot() {
    $('#brand-stores').innerHTML = D.stores.map((s) => `<span><i style="background:${STORE_COLOR[s.id]}"></i>${esc(s.name)}</span>`).join('');
    $('#meta-range').textContent = fmtRange(D.data_start, D.data_end);
    $('#meta-generated').textContent = `${fmtDayFull(D.generated_at.slice(0, 10))}, ${D.generated_at.slice(11, 16)}`;

    $('#presets').innerHTML = PRESETS.map((p) => `<button type="button" data-preset="${p.id}">${esc(p.label)}</button>`).join('');
    $('#stores').innerHTML = `<button type="button" data-store="">All</button>` +
      D.stores.map((s) => `<button type="button" data-store="${s.id}"><i style="background:${STORE_COLOR[s.id]}"></i>${esc(s.name)}</button>`).join('');

    $('#presets').addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      setRange(p.from, p.to); render();
    });
    $('#stores').addEventListener('click', (e) => {
      const b = e.target.closest('[data-store]'); if (!b) return;
      state.store = b.dataset.store || null; render();
    });
    $('#content').addEventListener('click', (e) => {
      const link = e.target.closest('[data-goto]');
      if (link) { go(link.dataset.goto); return; }
      const card = e.target.closest('[data-store-card]'); if (!card) return;
      state.store = state.store === card.dataset.storeCard ? null : card.dataset.storeCard; render();
    });
    $('#content').addEventListener('keydown', (e) => {
      const link = e.target.closest('[data-goto]');
      if (link && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(link.dataset.goto); }
    });
    for (const id of ['#from', '#to']) { $(id).min = D.data_start; $(id).max = D.data_end; $(id).addEventListener('input', () => { $('#apply').disabled = !hint(); }); }
    $('#range').addEventListener('submit', (e) => { e.preventDefault(); if (!hint()) return; setRange($('#from').value, $('#to').value); render(); });
    $('#reset').addEventListener('click', () => { const p = PRESETS.find((x) => x.id === 'd7'); state.store = null; setRange(p.from, p.to); render(); });

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.view)));
    const h = location.hash.slice(1); if (['overview', 'refunds', 'chargebacks', 'reviews'].includes(h)) state.view = h;

    let theme = 'dark'; try { theme = localStorage.getItem('cs-theme') || 'dark'; } catch {}
    applyTheme(theme);
    $('#theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

    const p = PRESETS.find((x) => x.id === state.presetId);
    setRange(p.from, p.to); render();
  }

  function go(view) {
    if (!VIEWS[view]) return;
    state.view = view; location.hash = view; render(); scrollTo({ top: 0 });
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $('#theme').textContent = `Theme: ${t}`;
    try { localStorage.setItem('cs-theme', t); } catch {}
  }

  function setRange(from, to) {
    const r = M.clamp(from, to, D);
    state.window = r; state.compare = M.compareWindow(r.from, r.to, D);
    state.presetId = PRESETS.find((p) => p.from === r.from && p.to === r.to)?.id ?? null;
    $('#from').value = r.from; $('#to').value = r.to; hint();
  }

  function hint() {
    const f = $('#from').value, t = $('#to').value, el = $('#hint'); el.classList.remove('is-error');
    if (!f || !t) { el.textContent = 'Pick both dates.'; return false; }
    if (f > t) { el.textContent = 'Start is after end.'; el.classList.add('is-error'); return false; }
    if (f < D.data_start || t > D.data_end) { el.textContent = `Data exists from ${fmtDay(D.data_start)} to ${fmtDay(D.data_end)}.`; el.classList.add('is-error'); return false; }
    const n = M.daysBetween(f, t);
    el.textContent = `${n} day${n === 1 ? '' : 's'}${M.compareWindow(f, t, D) ? ` · vs the ${n} before` : ' · no earlier data to compare'}`;
    return true;
  }

  /* ----------------------------------------------------------- render --- */
  function render() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.view === state.view));
    document.querySelectorAll('#presets button').forEach((b) => b.classList.toggle('is-on', b.dataset.preset === state.presetId));
    document.querySelectorAll('#stores button').forEach((b) => b.classList.toggle('is-on', (b.dataset.store || null) === state.store));
    document.title = `CS Reporting · ${storeName(state.store)}`;
    const host = $('#content');
    host.innerHTML = VIEWS[state.view]();
    C.wire(host);
  }

  const w = () => state.window, cmp = () => state.compare;
  const n = () => M.daysBetween(w().from, w().to);
  const scope = () => `${fmtRange(w().from, w().to)} (${n()} day${n() === 1 ? '' : 's'})${cmp() ? `, compared with ${fmtRange(cmp().from, cmp().to)}` : ''} · ${storeName(state.store)}`;
  const deltaText = (d, fmt, pp) => (d.delta == null ? '' : d.tone === 'flat' ? 'no change' : (pp ? fmtPp(Math.abs(d.delta), pp === 2 ? 2 : 1) : fmt(Math.abs(d.delta))));
  const prevText = (v, fmt) => (v == null ? '' : `vs ${fmt(v)} previous period`);
  const pctText = (d) => (d.pct == null || d.tone === 'flat' ? deltaText(d, fmtInt) : `${fmtPct(Math.abs(d.pct))}`);

  /* Um dia não tem tendência; acima de um mês, uma semana por ponto. */
  function pooled(days, numKeys, arrKey) {
    const weekly = days.length > 31;
    // Semana cortada na borda do período tem volume menor porque é menor — no
    // gráfico ela leria como queda. Fica de fora; os cartões continuam contando tudo.
    const pts = weekly ? M.byWeek(days, numKeys, arrKey).filter((p) => p.days === 7) : days;
    return { weekly, pts, unit: weekly ? 'week' : 'day', titles: weekly ? pts.map((p) => `Week of ${fmtDay(p.date)}`) : undefined, xLabel: weekly ? fmtDay : undefined,
      note: weekly ? '<p class="note">One point per full Monday-to-Sunday week; partial weeks at the edges of the period are left out of the chart.</p>' : '' };
  }

  const VIEWS = {
    /* ================================================================ */
    overview() {
      const cur = M.tickets(D, w(), state.store), prev = cmp() ? M.tickets(D, cmp(), state.store) : null;
      const q = M.queueAt(D, w().to, state.store), qPrev = cmp() ? M.queueAt(D, cmp().to, state.store) : null;
      const t = D.targets;

      const dRec = M.change(cur.received, prev?.received, 'lower'), dClo = M.change(cur.closed, prev?.closed, 'higher');
      const dFrt = M.change(cur.frtMedian, prev?.frtMedian, 'lower'), dRes = M.change(cur.resMedian, prev?.resMedian, 'lower');
      const dU24 = M.change(cur.under24, prev?.under24, 'higher'), dQ = M.change(q.backlog, qPrev?.backlog, 'lower');

      const kpis = [
        C.tile({ label: 'Emails received', value: fmtInt(cur.received), foot: `${fmtInt(cur.answered)} got a first reply`, delta: dRec, deltaText: pctText(dRec), prevText: prevText(prev?.received, fmtInt) }),
        C.tile({ label: 'Emails closed', value: fmtInt(cur.closed), foot: `${fmtInt(cur.reopened)} reopened · ${fmtPct(cur.reopenRate)} reopen rate`, delta: dClo, deltaText: pctText(dClo), prevText: prevText(prev?.closed, fmtInt) }),
        C.tile({ label: 'First response', value: fmtHours(cur.frtMedian), unit: 'median', status: M.goal(cur.frtMedian, t.frt), foot: `9 in 10 within ${fmtHours(cur.frtP90)}`, delta: dFrt, deltaText: deltaText(dFrt, fmtHours), prevText: prevText(prev?.frtMedian, fmtHours) }),
        C.tile({ label: 'Resolution time', value: fmtHours(cur.resMedian), unit: 'median', status: M.goal(cur.resMedian, t.res), foot: `over ${fmtInt(cur.closed)} closed conversations`, delta: dRes, deltaText: deltaText(dRes, fmtHours), prevText: prevText(prev?.resMedian, fmtHours) }),
        C.tile({ label: 'Answered under 24h', value: fmtPct(cur.under24), status: M.goal(cur.under24, t.under24), foot: `${fmtInt(cur.over24)} waited more than a day`, delta: dU24, deltaText: deltaText(dU24, null, 1), prevText: prevText(prev?.under24, fmtPct) }),
        C.tile({ label: 'Queue at period end', value: fmtInt(q.backlog), foot: `${fmtInt(q.over24)} with no reply for 24h+ · snapshot of ${fmtDay(w().to)}`, delta: dQ, deltaText: pctText(dQ), prevText: prevText(qPrev?.backlog, fmtInt) }),
      ].join('');

      const days = M.ticketsByDay(D, w(), state.store);
      const P = pooled(days, ['received', 'closed', 'answered'], 'frt');
      const one = P.pts.length === 1;
      const volume = one ? `<dl class="stat-inline">
          <div><dt>Received</dt><dd>${fmtInt(P.pts[0].received)}</dd></div><div><dt>Answered</dt><dd>${fmtInt(P.pts[0].answered)}</dd></div>
          <div><dt>Closed</dt><dd>${fmtInt(P.pts[0].closed)}</dd></div><div><dt>Net queue change</dt><dd>${P.pts[0].received - P.pts[0].closed > 0 ? '+' : ''}${fmtInt(P.pts[0].received - P.pts[0].closed)}</dd></div></dl>
          <p class="note">A single day has no trend to draw — pick two days or more to see the line.</p>`
        : C.lineChart({ days: P.pts.map((p) => p.date), titles: P.titles, xLabel: P.xLabel, ariaLabel: 'Emails received and closed', series: [
            { label: 'Received', color: 'var(--series-1)', values: P.pts.map((p) => p.received) },
            { label: 'Closed', color: 'var(--series-2)', values: P.pts.map((p) => p.closed) } ] }) +
          C.legend([{ label: 'Received', color: 'var(--series-1)' }, { label: 'Closed', color: 'var(--series-2)' }]);
      const frt = one ? `<dl class="stat-inline"><div><dt>Median</dt><dd>${fmtHours(P.pts[0].frtMedian)}</dd></div><div><dt>Replies measured</dt><dd>${fmtInt(P.pts[0].frt.length)}</dd></div></dl>`
        : C.columnChart({ days: P.pts.map((p) => p.date), titles: P.titles, xLabel: P.xLabel, values: P.pts.map((p) => (p.frtMedian == null ? null : Math.round(p.frtMedian * 10) / 10)), label: 'First response (median)', fmt: 'hours', formatValue: (v) => `${v}h` });

      /* Cartões por loja: mesmo período, sempre as quatro, a filtrada em destaque. */
      const perStore = D.stores.map((s) => ({ s, k: M.tickets(D, w(), s.id), q: M.queueAt(D, w().to, s.id) }));
      const totalClosed = M.sum(perStore.map((x) => x.k.closed));
      const cards = perStore.map(({ s, k, q }) => `
        <button class="store${state.store === s.id ? ' is-on' : ''}" type="button" data-store-card="${s.id}" style="--c:${STORE_COLOR[s.id]}" aria-pressed="${state.store === s.id}">
          <div class="store__head"><span class="store__avatar">${esc(s.short)}</span><div><div class="store__name">${esc(s.name)}</div><div class="store__sub">${esc(s.helpdesk)}</div></div></div>
          <p class="store__big">${fmtInt(k.closed)}<small>closed</small></p>
          <dl class="store__row"><div><dt>1st reply</dt><dd>${fmtHours(k.frtMedian)}</dd></div><div><dt>Resolution</dt><dd>${fmtHours(k.resMedian)}</dd></div><div><dt>Queue</dt><dd>${fmtInt(q.backlog)}</dd></div></dl>
          <div class="store__share">Share <span class="track"><span class="fill" style="width:${(M.percent(k.closed, totalClosed) || 0).toFixed(1)}%"></span></span>${fmtPct(M.percent(k.closed, totalClosed), 0)}</div>
        </button>`).join('');

      const all = M.tickets(D, w(), null);
      const table = `<div class="tablewrap"><table>
        <thead><tr><th>Store</th><th class="num">Received</th><th class="num">Closed</th><th class="num">1st reply</th><th class="num">Under 24h</th><th class="num">Resolution</th><th class="num">Reopened</th><th class="num">Queue</th></tr></thead>
        <tbody>${perStore.map(({ s, k, q }) => `<tr><td><i class="dot" style="background:${STORE_COLOR[s.id]}"></i>${esc(s.name)}</td>
          <td class="num">${fmtInt(k.received)}</td><td class="num">${fmtInt(k.closed)}</td><td class="num">${fmtHours(k.frtMedian)}</td><td class="num">${fmtPct(k.under24)}</td>
          <td class="num">${fmtHours(k.resMedian)}</td><td class="num">${fmtPct(k.reopenRate)}</td><td class="num">${fmtInt(q.backlog)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>All stores</td><td class="num">${fmtInt(all.received)}</td><td class="num">${fmtInt(all.closed)}</td><td class="num">${fmtHours(all.frtMedian)}</td><td class="num">${fmtPct(all.under24)}</td><td class="num">${fmtHours(all.resMedian)}</td><td class="num">${fmtPct(all.reopenRate)}</td><td class="num">${fmtInt(M.queueAt(D, w().to, null).backlog)}</td></tr></tfoot>
      </table></div><p class="note">The total row is recomputed over every conversation pooled together. Counts add up; medians and percentages do not.</p>`;

      /* Resumo das outras abas: um número por assunto, clicável, para saber
         onde olhar antes de abrir cada aba. */
      const rf = M.refunds(D, w(), state.store), rfPrev = cmp() ? M.refunds(D, cmp(), state.store) : null;
      const rp = M.replacements(D, w(), state.store);
      const cb = M.chargebacks(D, w(), state.store), cbPrev = cmp() ? M.chargebacks(D, cmp(), state.store) : null;
      const rv = M.reviews(D, w(), state.store), rvPrev = cmp() ? M.reviews(D, cmp(), state.store) : null;
      const dRefund = M.change(rf.rate, rfPrev?.rate, 'lower'), dCb = M.change(cb.rate, cbPrev?.rate, 'lower'), dRating = M.change(rv.avg, rvPrev?.avg, 'higher');
      const go = (view, html) => `<div class="goto" data-goto="${view}" role="link" tabindex="0" title="Open the ${view} tab">${html}</div>`;
      const across = [
        go('refunds', C.tile({ label: 'Refund rate', value: fmtPct(rf.rate, 2), status: M.goal(rf.rate, D.targets.refundRate), foot: `${fmtInt(rf.count)} refunds · ${fmtMoney(rf.total)}`, delta: dRefund, deltaText: deltaText(dRefund, null, 2), prevText: prevText(rfPrev?.rate, (v) => fmtPct(v, 2)) })),
        go('refunds', C.tile({ label: 'Cost of going wrong', value: fmtMoney(rf.total + rp.total), foot: `refunds + ${fmtInt(rp.count)} replacements · ${fmtPct(M.percent(rf.total + rp.total, M.revenue(D, w(), state.store).revenue), 2)} of revenue` })),
        go('chargebacks', C.tile({ label: 'Chargeback rate', value: fmtPct(cb.rate, 2), status: M.goal(cb.rate, D.targets.cbRate), foot: `${fmtInt(cb.count)} disputes · ${fmtInt(cb.pending.length)} pending`, delta: dCb, deltaText: deltaText(dCb, null, 2), prevText: prevText(cbPrev?.rate, (v) => fmtPct(v, 2)) })),
        go('reviews', C.tile({ label: 'Trustpilot', value: fmtStars(rv.avg), unit: '★', status: M.goal(rv.avg, D.targets.rating), foot: `${fmtInt(rv.count)} reviews · ${fmtInt(rv.lowOpen)} low-star still open`, delta: dRating, deltaText: deltaText(dRating, fmtStars), prevText: prevText(rvPrev?.avg, fmtStars) })),
      ].join('');

      return `
        <section class="section"><div class="section__head"><h2 class="section__title">Headline</h2><span class="section__sub">${esc(scope())}</span></div><div class="grid grid--kpi">${kpis}</div></section>
        <section class="section"><div class="section__head"><h2 class="section__title">Across the board</h2><span class="section__sub">One number from each of the other tabs. Click to open it.</span></div><div class="grid grid--kpi grid--across">${across}</div></section>
        <section class="section"><div class="section__head"><h2 class="section__title">Stores</h2><span class="section__sub">Same period. Click a store to see only it.</span></div><div class="grid grid--stores">${cards}</div></section>
        <section class="section"><div class="grid grid--2">
          <div class="card"><div class="card__head"><div><h3 class="card__title">Emails received vs closed per ${P.unit}</h3><p class="card__note">The ${P.unit}s where received sits above closed are the ${P.unit}s the queue grew.</p></div></div><div class="card__body">${volume}${P.note}</div></div>
          <div class="card"><div class="card__head"><div><h3 class="card__title">First response per ${P.unit}</h3><p class="card__note">Median hours to the first human reply${P.weekly ? ', pooled over the week' : ''}.</p></div></div><div class="card__body">${frt}${P.note}</div></div>
        </div></section>
        <section class="section"><div class="card"><div class="card__head"><div><h3 class="card__title">Store comparison</h3><p class="card__note">Every store, regardless of the store filter.</p></div></div><div class="card__body">${table}</div></div></section>`;
    },

    /* ================================================================ */
    refunds() {
      const L = (k) => D.reason_labels[k] || k;
      const rf = M.refunds(D, w(), state.store), rfPrev = cmp() ? M.refunds(D, cmp(), state.store) : null;
      const rt = M.returns(D, w(), state.store), rtPrev = cmp() ? M.returns(D, cmp(), state.store) : null;
      const rp = M.replacements(D, w(), state.store), rpPrev = cmp() ? M.replacements(D, cmp(), state.store) : null;
      const money = M.revenue(D, w(), state.store);
      const cost = rf.total + rp.total;
      const costPrev = rfPrev ? rfPrev.total + rpPrev.total : null;
      const dRate = M.change(rf.rate, rfPrev?.rate, 'lower'), dRf = M.change(rf.count, rfPrev?.count, 'lower');
      const dRt = M.change(rt.count, rtPrev?.count, 'lower'), dRp = M.change(rp.count, rpPrev?.count, 'lower'), dCost = M.change(cost, costPrev, 'lower');

      const kpis = [
        C.tile({ label: 'Refund rate', value: fmtPct(rf.rate, 2), status: M.goal(rf.rate, D.targets.refundRate), foot: `${fmtMoney(rf.total)} refunded against ${fmtMoney(money.revenue)} in revenue`, delta: dRate, deltaText: deltaText(dRate, null, 2), prevText: prevText(rfPrev?.rate, (v) => fmtPct(v, 2)) }),
        C.tile({ label: 'Refunds', value: fmtInt(rf.count), foot: `${fmtMoney(rf.average, true)} average · ${fmtPct(rf.partialShare, 0)} partial`, delta: dRf, deltaText: pctText(dRf), prevText: prevText(rfPrev?.count, fmtInt) }),
        C.tile({ label: 'Returns', value: fmtInt(rt.count), foot: `${fmtMoney(rt.amount)} in goods · ${fmtInt(rt.open)} still in progress`, delta: dRt, deltaText: pctText(dRt), prevText: prevText(rtPrev?.count, fmtInt) }),
        C.tile({ label: 'Replacements', value: fmtInt(rp.count), foot: `${fmtMoney(rp.total)} in product + shipping · ${fmtInt(rp.repeats)} sent twice`, delta: dRp, deltaText: pctText(dRp), prevText: prevText(rpPrev?.count, fmtInt) }),
        C.tile({ label: 'Cost of going wrong', value: fmtMoney(cost), foot: `refunds + replacements · ${fmtPct(M.percent(cost, money.revenue), 2)} of revenue`, delta: dCost, deltaText: pctText(dCost), prevText: prevText(costPrev, fmtMoney) }),
      ].join('');

      const days = M.refundsByDay(D, w(), state.store);
      const P = pooled(days, ['refunds', 'returns', 'replacements', 'amount']);
      const one = P.pts.length === 1;
      const line = one ? `<dl class="stat-inline"><div><dt>Refunds</dt><dd>${fmtInt(P.pts[0].refunds)}</dd></div><div><dt>Returns</dt><dd>${fmtInt(P.pts[0].returns)}</dd></div><div><dt>Replacements</dt><dd>${fmtInt(P.pts[0].replacements)}</dd></div></dl><p class="note">A single day has no trend to draw.</p>`
        : C.lineChart({ days: P.pts.map((p) => p.date), titles: P.titles, xLabel: P.xLabel, ariaLabel: 'Refunds, returns and replacements per period', series: [
            { label: 'Refunds', color: 'var(--series-1)', values: P.pts.map((p) => p.refunds) },
            { label: 'Returns', color: 'var(--store-2)', values: P.pts.map((p) => p.returns) },
            { label: 'Replacements', color: 'var(--series-2)', values: P.pts.map((p) => p.replacements) } ] }) +
          C.legend([{ label: 'Refunds', color: 'var(--series-1)' }, { label: 'Returns', color: 'var(--store-2)' }, { label: 'Replacements', color: 'var(--series-2)' }]);

      const reasonCard = (title, note, groups, color, sub) => `
        <div class="card"><div class="card__head"><div><h3 class="card__title">${title}</h3><p class="card__note">${note}</p></div></div>
        <div class="card__body">${groups.length ? C.barList(groups.map((g) => ({ label: L(g.key), value: g.count, sub: sub(g) })), { color }) : '<p class="note">Nothing recorded in this period.</p>'}</div></div>`;

      const perStore = D.stores.map((s) => ({ s, rf: M.refunds(D, w(), s.id), rt: M.returns(D, w(), s.id), rp: M.replacements(D, w(), s.id), rev: M.revenue(D, w(), s.id) }));
      const table = `<div class="tablewrap"><table>
        <thead><tr><th>Store</th><th class="num">Revenue</th><th class="num">Refunds</th><th class="num">Refunded</th><th class="num">Refund rate</th><th class="num">Returns</th><th class="num">Replacements</th><th class="num">Repl. cost</th><th class="num">Total cost</th></tr></thead>
        <tbody>${perStore.map(({ s, rf, rt, rp, rev }) => `<tr><td><i class="dot" style="background:${STORE_COLOR[s.id]}"></i>${esc(s.name)}</td>
          <td class="num">${fmtMoney(rev.revenue)}</td><td class="num">${fmtInt(rf.count)}</td><td class="num">${fmtMoney(rf.total)}</td>
          <td class="num">${fmtPct(rf.rate, 2)} ${C.chip(M.goal(rf.rate, D.targets.refundRate))}</td><td class="num">${fmtInt(rt.count)}</td>
          <td class="num">${fmtInt(rp.count)}</td><td class="num">${fmtMoney(rp.total)}</td><td class="num">${fmtMoney(rf.total + rp.total)}</td></tr>`).join('')}</tbody></table></div>`;

      const TYPE = { full: 'Full', partial: 'Partial' };
      const recent = [...rf.rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
      const list = `<div class="tablewrap"><table>
        <thead><tr><th>Date</th><th>Store</th><th>Order</th><th>Reason</th><th>Type</th><th class="num">Amount</th><th>Logged by</th></tr></thead>
        <tbody>${recent.map((r) => `<tr><td>${fmtDay(r.date)}</td><td>${esc(storeName(r.store_id))}</td><td>${esc(r.order_id)}</td><td>${esc(L(r.reason))}</td><td>${TYPE[r.type]}</td><td class="num">${fmtMoney(r.amount_usd, true)}</td><td>${esc(r.agent.replace('_', ' '))}</td></tr>`).join('') || '<tr><td colspan="7">No refunds in this period.</td></tr>'}</tbody></table></div>`;

      return `
        <section class="section"><div class="section__head"><h2 class="section__title">Refunds, returns and replacements</h2><span class="section__sub">${esc(scope())}</span></div><div class="grid grid--kpi">${kpis}</div></section>
        <section class="section"><div class="card"><div class="card__head"><div><h3 class="card__title">Cases per ${P.unit}</h3><p class="card__note">Each line counts cases logged that ${P.unit}. Refund rate is money over money — the amount given back divided by revenue for the same window.</p></div></div><div class="card__body">${line}${P.note}</div></div></section>
        <section class="section"><div class="grid grid--3">
          ${reasonCard('Why we refunded', 'The reason picked when the refund was logged, out of a fixed list of ten.', rf.byReason, 'var(--series-1)', (g) => fmtMoney(g.amount))}
          ${reasonCard('Why items came back', 'Reason given on the return request.', rt.byReason, 'var(--store-2)', (g) => fmtMoney(g.amount))}
          ${reasonCard('Why we sent a replacement', 'Reason logged with the replacement order.', rp.byReason, 'var(--series-2)', (g) => `${fmtMoney(g.amount)} product`)}
        </div></section>
        <section class="section"><div class="grid grid--2">
          <div class="card"><div class="card__head"><div><h3 class="card__title">By store</h3><p class="card__note">Every store, regardless of the store filter. Total cost is refunds plus replacement product and shipping.</p></div></div><div class="card__body">${table}</div></div>
          <div class="card"><div class="card__head"><div><h3 class="card__title">Latest refunds</h3><p class="card__note">The 12 most recent entries, as logged in the sheet.</p></div></div><div class="card__body">${list}</div></div>
        </div></section>`;
    },

    /* ================================================================ */
    chargebacks() {
      const cur = M.chargebacks(D, w(), state.store), prev = cmp() ? M.chargebacks(D, cmp(), state.store) : null;
      const dCount = M.change(cur.count, prev?.count, 'lower'), dRate = M.change(cur.rate, prev?.rate, 'lower'), dWin = M.change(cur.winRate, prev?.winRate, 'higher');
      const kpis = [
        C.tile({ label: 'Disputes opened', value: fmtInt(cur.count), foot: `${fmtMoney(cur.amount)} disputed in ${fmtInt(cur.orders)} orders`, delta: dCount, deltaText: pctText(dCount), prevText: prevText(prev?.count, fmtInt) }),
        C.tile({ label: 'Chargeback rate', value: fmtPct(cur.rate, 2), status: M.goal(cur.rate, D.targets.cbRate), foot: 'disputes ÷ orders, the ratio card networks watch', delta: dRate, deltaText: deltaText(dRate, null, 2), prevText: prevText(prev?.rate, (v) => fmtPct(v, 2)) }),
        C.tile({ label: 'Still pending', value: fmtInt(cur.pending.length), foot: `${fmtMoney(cur.pendingAmount)} waiting on the bank` }),
        C.tile({ label: 'Win rate', value: fmtPct(cur.winRate), foot: `${fmtInt(cur.won.length)} won · ${fmtInt(cur.lost.length)} lost or accepted`, delta: dWin, deltaText: deltaText(dWin, null, 1), prevText: prevText(prev?.winRate, fmtPct) }),
        C.tile({ label: 'Money lost', value: fmtMoney(cur.lostAmount + cur.fees), foot: `${fmtMoney(cur.lostAmount)} lost + ${fmtMoney(cur.fees)} in fees` }),
      ].join('');

      const days = M.chargebacksByDay(D, w(), state.store);
      const P = pooled(days, ['count', 'amount']);
      const col = C.columnChart({ days: P.pts.map((p) => p.date), titles: P.titles, xLabel: P.xLabel, values: P.pts.map((p) => p.count), label: 'Disputes opened', color: 'var(--series-1)' });

      const RL = { fraud_unauthorised: 'Fraud / unauthorised', product_not_received: 'Product not received', product_not_as_described: 'Not as described', duplicate_charge: 'Duplicate charge', subscription_cancelled: 'Subscription cancelled' };
      const SL = { open: 'Open', under_review: 'Under review', won: 'Won', lost: 'Lost', accepted: 'Accepted' };
      const SC = { open: 'var(--warn)', under_review: 'var(--muted)', won: 'var(--good)', lost: 'var(--crit)', accepted: '#b04a4a' };
      const order = ['open', 'under_review', 'won', 'lost', 'accepted'];
      const segs = order.map((k) => ({ label: SL[k], color: SC[k], value: cur.byStatus.find((g) => g.key === k)?.count || 0 }));
      const reasons = C.barList(cur.byReason.map((g) => ({ label: RL[g.key] || g.key, value: g.count, sub: fmtMoney(g.amount) })));

      const perStore = D.stores.map((s) => ({ s, c: M.chargebacks(D, w(), s.id) }));
      const table = `<div class="tablewrap"><table>
        <thead><tr><th>Store</th><th class="num">Orders</th><th class="num">Disputes</th><th class="num">Rate</th><th class="num">Pending</th><th class="num">Win rate</th><th class="num">Lost + fees</th></tr></thead>
        <tbody>${perStore.map(({ s, c }) => `<tr><td><i class="dot" style="background:${STORE_COLOR[s.id]}"></i>${esc(s.name)}</td><td class="num">${fmtInt(c.orders)}</td><td class="num">${fmtInt(c.count)}</td>
          <td class="num">${fmtPct(c.rate, 2)} ${C.chip(M.goal(c.rate, D.targets.cbRate))}</td><td class="num">${fmtInt(c.pending.length)}</td><td class="num">${fmtPct(c.winRate)}</td><td class="num">${fmtMoney(c.lostAmount + c.fees)}</td></tr>`).join('')}</tbody></table></div>`;

      const recent = [...cur.rows].sort((a, b) => b.opened_at.localeCompare(a.opened_at)).slice(0, 12);
      const list = `<div class="tablewrap"><table>
        <thead><tr><th>Opened</th><th>Store</th><th>Reason</th><th>Network</th><th class="num">Amount</th><th>Status</th></tr></thead>
        <tbody>${recent.map((c) => `<tr><td>${fmtDay(c.opened_at)}</td><td>${esc(storeName(c.store_id))}</td><td>${esc(RL[c.reason])}</td><td>${esc(c.network)}</td><td class="num">${fmtMoney(c.amount_usd, true)}</td><td><span class="chip chip--${c.status}">${esc(SL[c.status])}</span></td></tr>`).join('') || '<tr><td colspan="6">No disputes opened in this period.</td></tr>'}</tbody></table></div>`;

      return `
        <section class="section"><div class="section__head"><h2 class="section__title">Chargebacks</h2><span class="section__sub">${esc(scope())}</span></div><div class="grid grid--kpi">${kpis}</div></section>
        <section class="section"><div class="grid grid--2">
          <div class="card"><div class="card__head"><div><h3 class="card__title">Disputes opened per ${P.unit}</h3><p class="card__note">Counted by the day the bank opened the case.</p></div></div><div class="card__body">${col}${P.note}</div></div>
          <div class="card"><div class="card__head"><div><h3 class="card__title">Where the cases stand today</h3><p class="card__note">Status of every dispute opened in this period.</p></div></div><div class="card__body">
            ${C.stackedRow(segs)}${C.legend(segs.filter((s) => s.value > 0).map((s) => ({ label: `${s.label} · ${s.value}`, color: s.color })))}
            <h4 class="kpi__label" style="margin:22px 0 10px">Reason given by the cardholder</h4>${reasons}</div></div>
        </div></section>
        <section class="section"><div class="grid grid--2">
          <div class="card"><div class="card__head"><div><h3 class="card__title">By store</h3><p class="card__note">Every store, regardless of the store filter.</p></div></div><div class="card__body">${table}</div></div>
          <div class="card"><div class="card__head"><div><h3 class="card__title">Latest disputes</h3><p class="card__note">The 12 most recent in the period.</p></div></div><div class="card__body">${list}</div></div>
        </div></section>`;
    },

    /* ================================================================ */
    reviews() {
      const cur = M.reviews(D, w(), state.store), prev = cmp() ? M.reviews(D, cmp(), state.store) : null;
      const dCount = M.change(cur.count, prev?.count, 'higher'), dAvg = M.change(cur.avg, prev?.avg, 'higher'), dLow = M.change(cur.lowShare, prev?.lowShare, 'lower'), dRep = M.change(cur.lowReplied48, prev?.lowReplied48, 'higher');
      const kpis = [
        C.tile({ label: 'Reviews received', value: fmtInt(cur.count), foot: `${fmtPct(cur.fiveShare)} five stars`, delta: dCount, deltaText: pctText(dCount), prevText: prevText(prev?.count, fmtInt) }),
        C.tile({ label: 'Average rating', value: fmtStars(cur.avg), unit: '★', status: M.goal(cur.avg, D.targets.rating), foot: 'Trustpilot, all ratings in the period', delta: dAvg, deltaText: deltaText(dAvg, fmtStars), prevText: prevText(prev?.avg, fmtStars) }),
        C.tile({ label: '1–3★ reviews', value: fmtInt(cur.lowCount), foot: `${fmtPct(cur.lowShare)} of all reviews`, delta: dLow, deltaText: deltaText(dLow, null, 1), prevText: prevText(prev?.lowShare, fmtPct) }),
        C.tile({ label: '1–3★ replied within 48h', value: fmtPct(cur.lowReplied48), status: M.goal(cur.lowReplied48, D.targets.lowReply), foot: `median reply in ${fmtHours(cur.replyMedian)}`, delta: dRep, deltaText: deltaText(dRep, null, 1), prevText: prevText(prev?.lowReplied48, fmtPct) }),
        C.tile({ label: '1–3★ still open', value: fmtInt(cur.lowOpen), foot: 'not yet resolved with the customer' }),
      ].join('');

      const days = M.reviewsByDay(D, w(), state.store);
      const P = pooled(days, ['count', 'low', 'stars']);
      const one = P.pts.length === 1;
      const line = one ? `<dl class="stat-inline"><div><dt>Reviews</dt><dd>${fmtInt(P.pts[0].count)}</dd></div><div><dt>1–3★</dt><dd>${fmtInt(P.pts[0].low)}</dd></div><div><dt>Average</dt><dd>${fmtStars(P.pts[0].count ? P.pts[0].stars / P.pts[0].count : null)}</dd></div></dl><p class="note">A single day has no trend to draw.</p>`
        : C.lineChart({ days: P.pts.map((p) => p.date), titles: P.titles, xLabel: P.xLabel, ariaLabel: 'Reviews per period', series: [
            { label: 'All reviews', color: 'var(--series-1)', values: P.pts.map((p) => p.count) },
            { label: '1–3★', color: 'var(--crit)', values: P.pts.map((p) => p.low) } ] }) +
          C.legend([{ label: 'All reviews', color: 'var(--series-1)' }, { label: '1–3★', color: 'var(--crit)' }]);

      const ramp = ['#0d366b', '#1c5cab', '#3987e5', '#86b6ef', '#cde2fb'];
      const dist = C.barList([5, 4, 3, 2, 1].map((r, i) => ({ label: `${r} ★`, value: cur.dist[r - 1], sub: fmtPct(M.percent(cur.dist[r - 1], cur.count)), color: ramp[4 - i] })));

      const perStore = D.stores.map((s) => ({ s, r: M.reviews(D, w(), s.id) }));
      const table = `<div class="tablewrap"><table>
        <thead><tr><th>Store</th><th class="num">Reviews</th><th class="num">Average</th><th class="num">1–3★</th><th class="num">Share</th><th class="num">Replied &lt;48h</th><th class="num">Still open</th></tr></thead>
        <tbody>${perStore.map(({ s, r }) => `<tr><td><i class="dot" style="background:${STORE_COLOR[s.id]}"></i>${esc(s.name)}</td><td class="num">${fmtInt(r.count)}</td>
          <td class="num">${fmtStars(r.avg)} ${C.chip(M.goal(r.avg, D.targets.rating))}</td><td class="num">${fmtInt(r.lowCount)}</td><td class="num">${fmtPct(r.lowShare)}</td><td class="num">${fmtPct(r.lowReplied48)}</td><td class="num">${fmtInt(r.lowOpen)}</td></tr>`).join('')}</tbody></table></div>`;

      return `
        <section class="section"><div class="section__head"><h2 class="section__title">Trustpilot</h2><span class="section__sub">${esc(scope())}</span></div><div class="grid grid--kpi">${kpis}</div></section>
        <section class="section"><div class="grid grid--2">
          <div class="card"><div class="card__head"><div><h3 class="card__title">Reviews per ${P.unit}</h3><p class="card__note">All reviews against the 1–3★ ones that need a reply.</p></div></div><div class="card__body">${line}${P.note}</div></div>
          <div class="card"><div class="card__head"><div><h3 class="card__title">Rating distribution</h3><p class="card__note">How the ${fmtInt(cur.count)} reviews in the period split by stars.</p></div></div><div class="card__body">${dist}</div></div>
        </div></section>
        <section class="section"><div class="card"><div class="card__head"><div><h3 class="card__title">By store</h3><p class="card__note">Every store, regardless of the store filter.</p></div></div><div class="card__body">${table}</div></div></section>`;
    },
  };

  boot();
})();
