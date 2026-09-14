/* =========================================================================
   DADOS FICTÍCIOS. Tudo aqui é gerado com semente fixa: cada carregamento
   produz exatamente os mesmos números. Nenhuma loja, cliente ou pedido real.

   É o único arquivo que "produz" dado. Quando houver dado real, este arquivo
   é substituído por um fetch dos mesmos campos — a interface não muda.
   ========================================================================= */
window.DATA = (function () {
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const R = rng(20260914);
  const rand = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const hours = (median, spread) => Math.round(median * Math.exp(spread * (R() + R() + R() - 1.5)) * 100) / 100;
  const weighted = (weights) => { let x = R(); for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; } return weights.length - 1; };

  const END = '2026-09-14';
  const DAYS = 120;
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const dow = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const START = addDays(END, -(DAYS - 1));

  const STORES = [
    { id: 'store1', name: 'Store 1', short: 'S1', helpdesk: 'Richpanel',  base: 150, frt: 3.2, res: 22, orders: 480, stars: [0.04, 0.04, 0.07, 0.17, 0.68] },
    { id: 'store2', name: 'Store 2', short: 'S2', helpdesk: 'Commslayer', base: 105, frt: 5.5, res: 30, orders: 340, stars: [0.05, 0.05, 0.08, 0.18, 0.64] },
    { id: 'store3', name: 'Store 3', short: 'S3', helpdesk: 'Commslayer', base: 70,  frt: 9.0, res: 40, orders: 210, stars: [0.09, 0.07, 0.10, 0.20, 0.54] },
    { id: 'store4', name: 'Store 4', short: 'S4', helpdesk: 'Richpanel',  base: 45,  frt: 2.4, res: 18, orders: 150, stars: [0.03, 0.03, 0.06, 0.16, 0.72] },
  ];
  const WEEK = [0.72, 1.10, 1.08, 1.04, 1.00, 0.95, 0.78]; // dom..sáb

  const CB_REASONS = ['fraud_unauthorised', 'product_not_received', 'product_not_as_described', 'duplicate_charge', 'subscription_cancelled'];
  const NETWORKS = ['visa', 'visa', 'mastercard', 'mastercard', 'amex', 'discover'];

  const tickets = [], queue = [], revenue = [], chargebacks = [], reviews = [];
  let cbN = 0, rvN = 0;

  for (const s of STORES) {
    let backlog = Math.round(s.base * 0.9);
    for (let i = 0; i < DAYS; i++) {
      const date = addDays(START, i);
      const trend = 1 + (i / DAYS) * 0.12;
      // Um incidente na Store 2 três semanas atrás: volume sobe e a resposta atrasa.
      const bump = (s.id === 'store2' && i >= DAYS - 22 && i < DAYS - 15) ? 1.6 : 1;
      const w = WEEK[dow(date)];

      const received = Math.round(s.base * w * trend * bump * rand(0.85, 1.15));
      const answered = Math.round(received * rand(0.90, 1.02));
      const closed = Math.min(Math.round(received * rand(0.86, 1.10) * (backlog > s.base * 1.4 ? 1.12 : 1)), backlog + received);
      backlog = Math.max(0, backlog + received - closed);
      const frtMed = s.frt * (bump > 1 ? 2.2 : 1) * rand(0.8, 1.25);
      tickets.push({
        store_id: s.id, date, received, answered, closed,
        reopened: Math.round(closed * rand(0.02, 0.06)),
        frt_hours: Array.from({ length: answered }, () => (R() < 0.07 ? hours(frtMed * 9, 0.6) : hours(frtMed, 1.0))),
        resolution_hours: Array.from({ length: closed }, () => hours(s.res * rand(0.85, 1.2), 0.8)),
      });
      queue.push({ store_id: s.id, date, backlog, over_24h_unanswered: Math.round(backlog * rand(0.08, 0.2)) });

      const orders = Math.round(s.orders * w * trend * rand(0.85, 1.15));
      revenue.push({ store_id: s.id, date, orders, revenue_usd: Math.round(orders * rand(52, 68) * 100) / 100 });

      const nCb = Math.floor(orders * rand(0.003, 0.010) + R());
      for (let k = 0; k < nCb; k++) {
        const age = DAYS - 1 - i;
        let status, resolved_at = null;
        if (age > 40 || (age > 10 && R() < 0.5) || (age > 2 && R() < 0.12)) {
          status = pick(['won', 'won', 'won', 'lost', 'lost', 'accepted']);
          resolved_at = addDays(date, Math.min(age, Math.round(rand(12, 40))));
        } else status = age > 5 && R() < 0.6 ? 'under_review' : 'open';
        chargebacks.push({
          id: `cb_${String(++cbN).padStart(4, '0')}`, store_id: s.id, opened_at: date, resolved_at,
          amount_usd: Math.round(rand(29, 189) * 100) / 100, fee_usd: 15,
          reason: pick(CB_REASONS), network: pick(NETWORKS), status,
        });
      }

      const nRv = Math.floor((s.base / 28) * w * rand(0.6, 1.4) + R());
      for (let k = 0; k < nRv; k++) {
        const rating = weighted(s.stars) + 1;
        const low = rating <= 3;
        const age = DAYS - 1 - i;
        const replied = low ? R() < 0.86 : R() < 0.45;
        reviews.push({
          id: `rv_${String(++rvN).padStart(4, '0')}`, store_id: s.id, date, rating,
          replied, reply_hours: replied ? hours(low ? 18 : 30, 0.8) : null,
          status: low ? ((age > 7 ? R() < 0.9 : R() < 0.4) ? 'resolved' : 'open') : null,
        });
      }
    }
  }

  return {
    stores: STORES,
    data_start: START, data_end: END,
    generated_at: '2026-09-14T16:00:00-03:00',
    timezone: 'America/Sao_Paulo',
    tickets, queue, revenue, chargebacks, reviews,
    targets: {
      frt:    { label: 'First response (median)', unit: 'hours',   goal: 4,   warning: 8,   direction: 'lower' },
      under24:{ label: 'Answered within 24h',     unit: 'percent', goal: 90,  warning: 80,  direction: 'higher' },
      res:    { label: 'Resolution (median)',     unit: 'hours',   goal: 24,  warning: 36,  direction: 'lower' },
      cbRate: { label: 'Chargeback rate',         unit: 'percent', goal: 0.6, warning: 0.9, direction: 'lower' },
      rating: { label: 'Trustpilot average',      unit: 'stars',   goal: 4.5, warning: 4.2, direction: 'higher' },
      lowReply:{ label: 'Low-star reviews replied within 48h', unit: 'percent', goal: 90, warning: 75, direction: 'higher' },
    },
  };
})();
