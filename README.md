# CS Reporting — demo

Customer-support reporting dashboard for four generic stores (**Store 1–4**): emails received
and closed, first-response and resolution times, queue, chargebacks and Trustpilot reviews.

> **Every number here is fake.** `assets/data.js` generates the whole data set from a fixed
> seed, so each load shows exactly the same figures. No real store, customer or order data.

Static site: plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.
GitHub Pages serves the repository as it is.

## Run it locally

Open `index.html` directly in the browser — it works from a double-click, no server needed.

If you prefer a local server (Node installed):

```bash
node serve.mjs
```

Then open <http://localhost:8125/>.

## What is on the page

| Tab | Contents |
|---|---|
| **Overview** | Emails received / closed, first response, resolution, answered under 24h, queue at period end; one card per store; volume and first-response charts; store comparison table |
| **Chargebacks** | Disputes opened, chargeback rate (disputes ÷ orders), pending, win rate, money lost; disputes per day, status and reasons; per-store table; latest cases |
| **Trustpilot** | Reviews received, average rating, 1–3★ share, low-star reviews replied within 48h, still open; reviews per day, rating distribution; per-store table |

**Period** — `Today`, `Yesterday`, `7 days`, `30 days`, `60 days`, or any custom range
(From / To + Apply). Every card shows the change against the period of the same length
immediately before. Ranges longer than a month are drawn one point per full week.

**Store** — `All` or one store; clicking a store card does the same. The per-store tables
always show all four stores.

**Theme** — dark by default, light on the button at the top right.

## Files

```
index.html          page shell
assets/styles.css   theme tokens (dark / light) and layout
assets/data.js      seeded fake-data generator  ← swap this for real data
assets/metrics.js   all calculations (pure functions)
assets/charts.js    SVG charts, tooltips, number formatting
assets/app.js       filters, tabs, the three views
serve.mjs           optional local server
.github/workflows   GitHub Pages deploy
```

## Publishing on GitHub Pages

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push
to `main` redeploys automatically.
