/* =========================================================================
   Todo o cálculo. Funções puras: entram linhas, saem números. Nada toca o DOM.

   Mediana nunca é guardada — cada linha diária carrega um valor por ticket e
   a mediana da tela sai do conjunto real em escopo. Contagem soma; mediana e
   porcentagem são recalculadas sobre o conjunto reunido.
   ========================================================================= */
window.M = (function () {
  const median = (v) => { if (!v || !v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quantile = (v, q) => { if (!v || !v.length) return null; const s = [...v].sort((a, b) => a - b); const p = (s.length - 1) * q; const lo = Math.floor(p), hi = Math.ceil(p); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (p - lo); };
  const sum = (v) => v.reduce((t, x) => t + (x || 0), 0);
  const percent = (a, b) => (b ? (a / b) * 100 : null);
  const countUnder = (v, lim) => v.reduce((n, x) => n + (x < lim ? 1 : 0), 0);

  const addDays = (iso, n) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
  const inWin = (r, from, to, store) => r.date >= from && r.date <= to && (!store || r.store_id === store);

  /* Atalhos contados a partir do último dia com dado. */
  function presets(D) {
    const end = D.data_end;
    return [
      { id: 'today', label: 'Today', from: end, to: end },
      { id: 'yesterday', label: 'Yesterday', from: addDays(end, -1), to: addDays(end, -1) },
      { id: 'd7', label: '7 days', from: addDays(end, -6), to: end },
      { id: 'd30', label: '30 days', from: addDays(end, -29), to: end },
      { id: 'd60', label: '60 days', from: addDays(end, -59), to: end },
    ].filter((p) => p.from >= D.data_start);
  }

  /* O intervalo de mesmo tamanho imediatamente anterior; null se não couber nos dados. */
  function compareWindow(from, to, D) {
    const n = daysBetween(from, to);
    const cFrom = addDays(from, -n);
    return cFrom < D.data_start ? null : { from: cFrom, to: addDays(from, -1), days: n };
  }

  function clamp(from, to, D) {
    let f = from < D.data_start ? D.data_start : from;
    let t = to > D.data_end ? D.data_end : to;
    if (f > t) [f, t] = [t, f];
    return { from: f, to: t };
  }

  /* ---------------------------------------------------------- tickets --- */
  function tickets(D, w, store) {
    const o = { received: 0, answered: 0, closed: 0, reopened: 0, frt: [], res: [] };
    for (const r of D.tickets) {
      if (!inWin(r, w.from, w.to, store)) continue;
      o.received += r.received; o.answered += r.answered; o.closed += r.closed; o.reopened += r.reopened;
      o.frt.push(...r.frt_hours); o.res.push(...r.resolution_hours);
    }
    o.frtMedian = median(o.frt); o.frtP90 = quantile(o.frt, 0.9); o.resMedian = median(o.res);
    o.under24 = percent(countUnder(o.frt, 24), o.frt.length);
    o.over24 = o.frt.length - countUnder(o.frt, 24);
    o.reopenRate = percent(o.reopened, o.closed);
    return o;
  }

  function ticketsByDay(D, w, store) {
    const m = new Map();
    for (const r of D.tickets) {
      if (!inWin(r, w.from, w.to, store)) continue;
      if (!m.has(r.date)) m.set(r.date, { date: r.date, received: 0, closed: 0, answered: 0, frt: [] });
      const d = m.get(r.date);
      d.received += r.received; d.closed += r.closed; d.answered += r.answered; d.frt.push(...r.frt_hours);
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, frtMedian: median(d.frt) }));
  }

  /* Semanas de segunda a domingo; a mediana sai do conjunto reunido. */
  function byWeek(days, numKeys, arrKey) {
    const m = new Map();
    for (const d of days) {
      const [y, mo, dd] = d.date.split('-').map(Number);
      const mon = addDays(d.date, -((new Date(Date.UTC(y, mo - 1, dd)).getUTCDay() + 6) % 7));
      if (!m.has(mon)) { const o = { date: mon, days: 0 }; for (const k of numKeys) o[k] = 0; if (arrKey) o[arrKey] = []; m.set(mon, o); }
      const s = m.get(mon); s.days++;
      for (const k of numKeys) s[k] += d[k];
      if (arrKey) s[arrKey].push(...d[arrKey]);
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date)).map((s) => (arrKey ? { ...s, frtMedian: median(s[arrKey]) } : s));
  }

  function queueAt(D, date, store) {
    let backlog = 0, over24 = 0;
    for (const q of D.queue) if (q.date === date && (!store || q.store_id === store)) { backlog += q.backlog; over24 += q.over_24h_unanswered; }
    return { backlog, over24 };
  }

  function revenue(D, w, store) {
    let orders = 0, rev = 0;
    for (const r of D.revenue) if (inWin(r, w.from, w.to, store)) { orders += r.orders; rev += r.revenue_usd; }
    return { orders, revenue: rev };
  }

  /* ------------------------------------------------------ chargebacks --- */
  const PENDING = new Set(['open', 'under_review']);
  function chargebacks(D, w, store) {
    const rows = D.chargebacks.filter((c) => c.opened_at >= w.from && c.opened_at <= w.to && (!store || c.store_id === store));
    const decided = rows.filter((c) => !PENDING.has(c.status));
    const won = rows.filter((c) => c.status === 'won');
    const pending = rows.filter((c) => PENDING.has(c.status));
    const lost = rows.filter((c) => c.status === 'lost' || c.status === 'accepted');
    const { orders } = revenue(D, w, store);
    return {
      rows, count: rows.length, amount: sum(rows.map((c) => c.amount_usd)), orders,
      rate: percent(rows.length, orders),
      pending, pendingAmount: sum(pending.map((c) => c.amount_usd)),
      won, wonAmount: sum(won.map((c) => c.amount_usd)),
      lost, lostAmount: sum(lost.map((c) => c.amount_usd)),
      fees: sum(rows.map((c) => c.fee_usd)),
      winRate: percent(won.length, decided.length),
      byReason: group(rows, 'reason', 'amount_usd'),
      byStatus: group(rows, 'status', 'amount_usd'),
    };
  }

  function chargebacksByDay(D, w, store) {
    const m = new Map();
    for (let d = w.from; d <= w.to; d = addDays(d, 1)) m.set(d, { date: d, count: 0, amount: 0 });
    for (const c of D.chargebacks) {
      if (c.opened_at < w.from || c.opened_at > w.to || (store && c.store_id !== store)) continue;
      const x = m.get(c.opened_at); x.count++; x.amount += c.amount_usd;
    }
    return [...m.values()];
  }

  /* ---------------------------------------------------------- reviews --- */
  function reviews(D, w, store) {
    const rows = D.reviews.filter((r) => inWin(r, w.from, w.to, store));
    const dist = [0, 0, 0, 0, 0];
    for (const r of rows) dist[r.rating - 1]++;
    const low = rows.filter((r) => r.rating <= 3);
    const lowReplied48 = low.filter((r) => r.replied && r.reply_hours <= 48).length;
    return {
      rows, count: rows.length, dist,
      avg: rows.length ? sum(rows.map((r) => r.rating)) / rows.length : null,
      low, lowCount: low.length, lowShare: percent(low.length, rows.length),
      lowReplied48: percent(lowReplied48, low.length),
      lowOpen: low.filter((r) => r.status === 'open').length,
      replyMedian: median(low.filter((r) => r.replied).map((r) => r.reply_hours)),
      fiveShare: percent(dist[4], rows.length),
    };
  }

  function reviewsByDay(D, w, store) {
    const m = new Map();
    for (let d = w.from; d <= w.to; d = addDays(d, 1)) m.set(d, { date: d, count: 0, low: 0, stars: 0 });
    for (const r of D.reviews) {
      if (!inWin(r, w.from, w.to, store)) continue;
      const x = m.get(r.date); x.count++; x.stars += r.rating; if (r.rating <= 3) x.low++;
    }
    return [...m.values()].map((x) => ({ ...x, avg: x.count ? x.stars / x.count : null }));
  }

  /* ------------------------------------------------------------ comum --- */
  function group(rows, key, moneyKey) {
    const m = new Map();
    for (const r of rows) {
      const k = r[key];
      if (!m.has(k)) m.set(k, { key: k, count: 0, amount: 0 });
      const g = m.get(k); g.count++; if (moneyKey) g.amount += r[moneyKey] || 0;
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }

  function goal(value, t) {
    if (value == null || !t) return 'none';
    if (t.direction === 'higher') return value >= t.goal ? 'good' : value >= t.warning ? 'warn' : 'crit';
    return value <= t.goal ? 'good' : value <= t.warning ? 'warn' : 'crit';
  }

  function change(cur, prev, direction = 'lower') {
    if (cur == null || prev == null) return { delta: null, pct: null, tone: 'flat' };
    const delta = cur - prev;
    const pct = prev ? (delta / Math.abs(prev)) * 100 : null;
    const better = direction === 'higher' ? delta > 0 : delta < 0;
    return { delta, pct, tone: Math.abs(delta) < 1e-9 ? 'flat' : better ? 'good' : 'bad' };
  }

  return { median, sum, percent, countUnder, addDays, daysBetween, presets, compareWindow, clamp,
    tickets, ticketsByDay, byWeek, queueAt, revenue, chargebacks, chargebacksByDay, reviews, reviewsByDay, goal, change };
})();
