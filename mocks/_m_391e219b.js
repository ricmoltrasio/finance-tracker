/* Finance Tracker — deterministic Italian (Intesa-style) dataset.
   Exposes window.FINANCE = { categories, transactions, settings, helpers } */
(function () {
  "use strict";

  // --- seeded PRNG (mulberry32) so data is stable across reloads ---
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260610);
  const rand = (min, max) => min + rnd() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const round2 = (n) => Math.round(n * 100) / 100;

  // --- categories ---
  const categories = [
    { id: "spesa",     name: "Spesa",            icon: "cart",     color: "#5FD0A0", budget: 650 },
    { id: "ristoranti",name: "Ristoranti",       icon: "cup",      color: "#F2A65A", budget: 320 },
    { id: "trasporti", name: "Trasporti",        icon: "car",      color: "#6AA6FF", budget: 160 },
    { id: "casa",      name: "Casa & affitto",   icon: "home",     color: "#C792EA", budget: 950 },
    { id: "bollette",  name: "Bollette",         icon: "bolt",     color: "#F2C14E", budget: 240 },
    { id: "shopping",  name: "Shopping",         icon: "bag",      color: "#FF8DAA", budget: 280 },
    { id: "salute",    name: "Salute",           icon: "heart",    color: "#5BD1D7", budget: 120 },
    { id: "svago",     name: "Abbonamenti",      icon: "play",     color: "#B388FF", budget: 90 },
    { id: "viaggi",    name: "Viaggi",           icon: "plane",    color: "#7EE081", budget: 250 },
    { id: "stipendio", name: "Stipendio",        icon: "wallet",   color: "#4ECB71", budget: null, income: true },
    { id: "altro",     name: "Altro",            icon: "dots",     color: "#8A93A0", budget: null },
  ];
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));

  // --- merchant pools per category: [name, min, max, weight] ---
  const pools = {
    spesa: [["Esselunga", 18, 110], ["Coop", 14, 95], ["Conad", 12, 88], ["Lidl", 9, 60], ["Carrefour Express", 7, 45], ["Pam Panorama", 16, 80], ["Eurospin", 11, 70]],
    ristoranti: [["Bar Centrale", 1.2, 9], ["Pizzeria Da Michele", 18, 64], ["Trattoria Del Borgo", 24, 78], ["Sushi Zen", 28, 92], ["McDonald's", 6, 22], ["Caffè Vergnano", 1.1, 6], ["Old Wild West", 22, 70], ["Poke House", 11, 19]],
    trasporti: [["ATM Milano", 2, 39], ["Trenitalia", 9, 58], ["Italo Treno", 19, 89], ["ENI Station", 35, 78], ["Q8 Easy", 30, 72], ["FreeNow", 7, 24], ["Telepass", 4, 31], ["BikeMi", 4.5, 4.5]],
    casa: [["Affitto Appartamento", 850, 850], ["IKEA", 24, 240], ["Leroy Merlin", 12, 150], ["Bricoman", 9, 95]],
    bollette: [["Enel Energia", 38, 142], ["A2A", 28, 96], ["Iren", 22, 88], ["TIM", 19.9, 39.9], ["Vodafone", 9.9, 29.9], ["Fastweb", 27.95, 35.95]],
    shopping: [["Amazon", 8, 180], ["Zara", 19, 130], ["Decathlon", 12, 95], ["Zalando", 24, 160], ["Apple Store", 29, 329], ["Unieuro", 18, 240], ["Uniqlo", 14, 89]],
    salute: [["Farmacia Comunale", 6, 64], ["Centro Medico Sant'Anna", 40, 120], ["Dr. Rossi", 80, 80], ["Parafarmacia", 8, 38], ["Ottica Avanzi", 35, 190]],
    svago: [["Netflix", 12.99, 12.99], ["Spotify", 10.99, 10.99], ["Disney+", 8.99, 8.99], ["Sky", 24.9, 24.9], ["Virgin Active", 65, 65], ["The Space Cinema", 8.5, 19], ["Audible", 9.99, 9.99]],
    viaggi: [["Ryanair", 19, 180], ["Booking.com", 64, 320], ["Airbnb", 78, 290], ["Frecciarossa", 39, 120], ["Hotel Continental", 95, 240]],
    altro: [["Prelievo Bancomat", 50, 250], ["Commissioni bancarie", 1, 4], ["Bonifico a Mario R.", 20, 200], ["PayPal", 5, 60], ["Edicola", 1.5, 8]],
  };

  // subscriptions recur monthly on a fixed day
  const subscriptions = [
    { cat: "svago", name: "Netflix", amount: 12.99, day: 4 },
    { cat: "svago", name: "Spotify", amount: 10.99, day: 8 },
    { cat: "svago", name: "Disney+", amount: 8.99, day: 14 },
    { cat: "svago", name: "Virgin Active", amount: 65, day: 1 },
    { cat: "bollette", name: "TIM", amount: 29.9, day: 6 },
    { cat: "bollette", name: "Fastweb", amount: 27.95, day: 11 },
    { cat: "casa", name: "Affitto Appartamento", amount: 850, day: 5 },
  ];

  function fmtDesc(name) { return name; }

  // --- generate ~7 months back from a fixed "today" ---
  const TODAY = new Date("2026-06-10T12:00:00");
  const START = new Date("2025-11-01T12:00:00");
  const transactions = [];
  let uid = 1;
  const mkId = () => "tx_" + String(uid++).padStart(4, "0");

  function addTx(date, catId, name, amount, opts = {}) {
    transactions.push({
      id: mkId(),
      date: date.toISOString().slice(0, 10),
      description: fmtDesc(name),
      categoryId: catId,
      amount: round2(amount),
      source: opts.source || (chance(0.82) ? "import" : "manuale"),
      note: opts.note || null,
      tags: opts.tags || [],
    });
  }

  // iterate days
  const everyday = ["spesa", "ristoranti", "trasporti"];
  for (let d = new Date(START); d <= TODAY; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const dom = day.getDate();
    const dow = day.getDay(); // 0 Sun..6 Sat
    const weekend = dow === 0 || dow === 6;

    // monthly salary on the 27th
    if (dom === 27) {
      addTx(day, "stipendio", "Stipendio Azienda SpA", rand(2380, 2520), { source: "import" });
      if (chance(0.18)) addTx(day, "altro", "Rimborso spese", rand(40, 160), { source: "import" });
    }

    // subscriptions
    for (const s of subscriptions) {
      if (dom === s.day) addTx(day, s.cat, s.name, -s.amount, { source: "import" });
    }

    // utility bills mid-month (not the subscription ones)
    if (dom === randInt(13, 18) && chance(0.5)) {
      const [name, lo, hi] = pick(pools.bollette.filter((p) => !["TIM", "Fastweb"].includes(p[0])));
      addTx(day, "bollette", name, -rand(lo, hi));
    }

    // everyday spending
    let n = randInt(0, weekend ? 4 : 3);
    for (let i = 0; i < n; i++) {
      const catId = weekend && chance(0.4) ? pick(["ristoranti", "shopping", "svago", "spesa"]) : pick(everyday.concat(chance(0.3) ? ["shopping"] : []));
      const [name, lo, hi] = pick(pools[catId]);
      addTx(day, catId, name, -rand(lo, hi));
    }

    // occasional larger one-offs
    if (chance(0.06)) {
      const catId = pick(["shopping", "salute", "casa", "viaggi"]);
      const [name, lo, hi] = pick(pools[catId]);
      addTx(day, catId, name, -rand(lo, hi));
    }
    // occasional cash / misc
    if (chance(0.04)) {
      const [name, lo, hi] = pick(pools.altro);
      addTx(day, "altro", name, -rand(lo, hi));
    }
    // occasional travel cluster
    if (chance(0.015)) {
      const [name, lo, hi] = pick(pools.viaggi);
      addTx(day, "viaggi", name, -rand(lo, hi));
    }
  }

  // sort newest first
  transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));

  const settings = {
    currency: "EUR",
    locale: "it-IT",
    saldoAttuale: 8420.55,   // current account balance (user-set in Impostazioni)
    user: { name: "Marco Bianchi", email: "marco.bianchi@gmail.com" },
    bankDefault: "Intesa Sanpaolo",
    today: TODAY.toISOString().slice(0, 10),
  };

  // --- helpers ---
  const fmtEUR = (n, opts = {}) => {
    const s = new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Math.abs(n));
    const sign = n < 0 ? "−" : opts.plus ? "+" : "";
    return `${sign}${s}${opts.noSymbol ? "" : " €"}`;
  };

  window.FINANCE = { categories, catById, transactions, settings, fmtEUR };
})();
