# ❄️ OuluSää — Historiallinen säädata 1940–2024

Interaktiivinen dashboard Oulun historiallisista säätiedoista.

🌐 **Live:** [https://tiparkka.github.io/oulusaa](https://tiparkka.github.io/oulusaa)

## Ominaisuudet

- 📊 **Vuosikeskilämpötila** 1940–2024 — lämpenemistrendi
- 🌧️ **Sademäärät** vuosittain ja kuukausittain
- ❄️ **Lumisade** vuosittain
- 🌡️ **Ilmastonormaalit** — kuukausikeskiarvot + taulukko
- 📅 **Vuosikymmenten vertailu** — lämpeneminen dekadeittain
- 🔄 Valittava aikajakso: 1940–2024, 1990–2024, 2000–2024, 2015–2024

## Teknologia

- Vanilla JavaScript (ei buildausta)
- [Chart.js](https://www.chartjs.org/) kaaviot (CDN)
- Responsiivinen CSS
- GitHub Pages hosting

## Data

Perustuu ECMWF ERA5 -reanalyysidataan ja Ilmatieteen laitoksen havaintoihin.
Lähde: [Open-Meteo.com](https://open-meteo.com) — CC BY 4.0

## Deploy

Sivusto on yksi `index.html`-tiedosto. Toimii suoraan GitHub Pagesilla:

1. Forkkaa tai kloonaa tämä repo
2. Settings → Pages → Source: `main` branch
3. Valmis!

## Lisenssi

MIT
