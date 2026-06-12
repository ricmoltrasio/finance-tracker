/* Overview screen + period/aggregation helpers. Globals: FINANCE, Icon, SaldoChart */
(function () {
  const { useMemo, useState, useEffect, useRef } = React;
  const { categories, catById, transactions, settings, fmtEUR } = window.FINANCE;
  const TODAY = new Date(settings.today + "T12:00:00");

  // ---------- running balance timeline ----------
  function buildBalanceTimeline() {
    const asc = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const sumAll = asc.reduce((s, t) => s + t.amount, 0);
    let bal = settings.saldoAttuale - sumAll;
    const byDate = {}; // date -> end-of-day balance
    for (const t of asc) { bal += t.amount; byDate[t.date] = bal; }
    return { byDate, startBal: settings.saldoAttuale - sumAll };
  }
  const TIMELINE = buildBalanceTimeline();

  function dstr(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

  function getRange(key, custom) {
    const end = new Date(TODAY);
    let start, label;
    if (key === "mese") { start = new Date(end.getFullYear(), end.getMonth(), 1, 12); label = end.toLocaleDateString("it-IT", { month: "long", year: "numeric" }); }
    else if (key === "3m") { start = addDays(addMonths(end, -3), 1); label = "Ultimi 3 mesi"; }
    else if (key === "6m") { start = addDays(addMonths(end, -6), 1); label = "Ultimi 6 mesi"; }
    else if (key === "anno") { start = new Date(end.getFullYear(), 0, 1, 12); label = end.getFullYear() + ""; }
    else if (key === "custom" && custom) { start = new Date(custom.start + "T12:00:00"); return { start, end: new Date(custom.end + "T12:00:00"), label: "Personalizzato" }; }
    else { start = new Date(end.getFullYear(), end.getMonth(), 1, 12); label = "Questo mese"; }
    return { start, end, label };
  }

  function inRange(t, start, end) { const d = new Date(t.date + "T12:00:00"); return d >= start && d <= end; }

  function aggregate(start, end) {
    const list = transactions.filter((t) => inRange(t, start, end));
    let spese = 0, entrate = 0;
    const byCat = {};
    for (const t of list) {
      if (t.amount < 0) { spese += -t.amount; byCat[t.categoryId] = (byCat[t.categoryId] || 0) + -t.amount; }
      else entrate += t.amount;
    }
    const cats = Object.entries(byCat).map(([id, val]) => ({ cat: catById[id], val }))
      .sort((a, b) => b.val - a.val);
    return { list, spese, entrate, netto: entrate - spese, cats };
  }

  function saldoSeries(start, end) {
    const pts = [];
    let last = TIMELINE.startBal;
    // seed last with balance just before start
    for (const [date, bal] of Object.entries(TIMELINE.byDate)) {
      if (new Date(date + "T12:00:00") < start) last = bal; else break;
    }
    const days = Math.round((end - start) / 86400000);
    const step = days > 120 ? 2 : 1;
    for (let i = 0; i <= days; i += step) {
      const d = addDays(start, i);
      const key = dstr(d);
      if (TIMELINE.byDate[key] != null) last = TIMELINE.byDate[key];
      pts.push({ date: key, value: Math.round(last * 100) / 100 });
    }
    return pts;
  }

  // ---------- count-up hook ----------
  function useCountUp(target, deps) {
    const [val, setVal] = useState(target);
    const from = useRef(target);
    useEffect(() => {
      const start = performance.now(), dur = 520, a = from.current, b = target;
      if (a === b) return;
      let raf, done = false;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(a + (b - a) * e);
        if (p < 1) raf = requestAnimationFrame(tick); else { from.current = b; done = true; }
      };
      raf = requestAnimationFrame(tick);
      // safety: guarantee final value even if rAF is throttled (background tab/capture)
      const safety = setTimeout(() => { if (!done) { setVal(b); from.current = b; } }, dur + 140);
      return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
    }, deps); // eslint-disable-line
    return val;
  }

  // ---------- small bits ----------
  function CatGlyph({ cat, size = 30 }) {
    return (
      <div style={{ width: size, height: size, borderRadius: 9, flex: "0 0 auto",
        display: "grid", placeItems: "center", color: cat.color,
        background: cat.color + "1f", border: "1px solid " + cat.color + "33" }}>
        <Icon name={cat.icon} size={size * 0.56} stroke={1.9} />
      </div>
    );
  }

  function Delta({ cur, prev, invert }) {
    if (!prev) return null;
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    if (!isFinite(pct) || Math.abs(pct) < 0.5) return <span className="kpi-delta flat">—</span>;
    const up = pct > 0;
    const good = invert ? !up : up;
    return (
      <span className={"kpi-delta " + (good ? "good" : "bad")}>
        <Icon name={up ? "arrowUp" : "arrowDown"} size={12} stroke={2.2} />
        {Math.abs(pct).toFixed(1).replace(".", ",")}%
      </span>
    );
  }

  // ---------- KPI ----------
  function Kpi({ label, value, prev, color, invert, big }) {
    const v = useCountUp(value, [value]);
    return (
      <div className="kpi">
        <div className="kpi-top">
          <span className="kpi-label">{label}</span>
          <Delta cur={value} prev={prev} invert={invert} />
        </div>
        <div className={"kpi-value" + (big ? " hero" : "")} style={color ? { color } : null}>
          {fmtEUR(v, { plus: big && value > 0 })}
        </div>
      </div>
    );
  }

  // ---------- category breakdown ----------
  function CatBreakdown({ data, months, total, onPick }) {
    const max = data.cats[0]?.val || 1;
    const m = Math.max(1, months || 1);
    return (
      <div className="catlist">
        {data.cats.map(({ cat, val }) => {
          const pct = total ? (val / total) * 100 : 0;
          const budget = cat.budget ? cat.budget * m : null;
          const overPct = budget ? (val / budget) * 100 : 0;
          const warn = budget && overPct >= 80;
          const over = budget && overPct > 100;
          return (
            <button className="catrow" key={cat.id} onClick={() => onPick && onPick(cat)}>
              <div className="catrow-head">
                <CatGlyph cat={cat} size={26} />
                <span className="catrow-name">{cat.name}</span>
                <span className="catrow-amt">{fmtEUR(val)}</span>
              </div>
              <div className="catrow-track">
                <div className="catrow-fill" style={{ width: Math.max(3, (val / max) * 100) + "%", background: cat.color }} />
              </div>
              <div className="catrow-meta">
                <span className="catrow-pct">{pct.toFixed(0)}% del totale</span>
                {budget && (
                  <span className={"catrow-budget" + (over ? " over" : warn ? " warn" : "")}>
                    {over ? "sforato di " + fmtEUR(val - budget) : "rimangono " + fmtEUR(budget - val)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ---------- recent transactions ----------
  function RecentList({ list, density, onPick }) {
    return (
      <div className={"txlist d-" + density}>
        {list.map((t) => {
          const cat = catById[t.categoryId];
          const inc = t.amount > 0;
          const d = new Date(t.date + "T12:00:00");
          return (
            <button className="txrow" key={t.id} onClick={() => onPick(t)}>
              <CatGlyph cat={cat} size={density === "compatta" ? 28 : 34} />
              <div className="txrow-main">
                <span className="txrow-desc">{t.description}</span>
                <span className="txrow-sub">
                  <span className="txrow-cat" style={{ color: cat.color }}>{cat.name}</span>
                  <span className="dot">·</span>
                  {t.source === "manuale" ? "Manuale" : "Import"}
                </span>
              </div>
              <div className="txrow-right">
                <span className={"txrow-amt " + (inc ? "in" : "out")}>{fmtEUR(t.amount, { plus: inc })}</span>
                <span className="txrow-date">{d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }).replace(".", "")}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  window.Overview = { getRange, aggregate, saldoSeries, Kpi, CatBreakdown, RecentList, CatGlyph, catById };
})();
