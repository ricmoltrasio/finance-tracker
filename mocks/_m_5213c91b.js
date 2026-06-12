/* App shell, period selector, transaction drawer, tweaks, mount.
   Globals: FINANCE, Icon, SaldoChart, Overview, useTweaks + Tweak* */
(function () {
  const { useMemo, useState, useEffect, useRef } = React;
  const { categories, catById, transactions, settings, fmtEUR } = window.FINANCE;
  const { getRange, aggregate, saldoSeries, Kpi, CatBreakdown, RecentList, CatGlyph } = window.Overview;

  const NAV = [
    { id: "overview", label: "Panoramica", icon: "overview" },
    { id: "tx", label: "Transazioni", icon: "list" },
    { id: "import", label: "Import", icon: "upload" },
    { id: "cats", label: "Categorie", icon: "grid" },
    { id: "settings", label: "Impostazioni", icon: "settings" },
  ];
  const PERIODS = [
    { key: "mese", label: "Questo mese" },
    { key: "3m", label: "Ultimi 3 mesi" },
    { key: "6m", label: "Ultimi 6 mesi" },
    { key: "anno", label: "Quest'anno" },
    { key: "custom", label: "Personalizzato" },
  ];

  const ACCENTS = {
    mint: "#57D9B0", amber: "#F2A65A", blue: "#6AA6FF", violet: "#B388FF",
  };

  // ---------- Period selector ----------
  function PeriodSelector({ value, onChange }) {
    return (
      <div className="periodbar" role="tablist">
        {PERIODS.map((p) => (
          <button key={p.key} role="tab" aria-selected={value === p.key}
            className={"pill" + (value === p.key ? " on" : "")} onClick={() => onChange(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  // ---------- Sidebar ----------
  function Sidebar({ active, onNav, onToast }) {
    return (
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="spark" size={18} stroke={2} /></div>
          <span className="brand-name">Saldo</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={"navitem" + (active === n.id ? " on" : "")}
              onClick={() => (n.id === "overview" ? onNav(n.id) : onToast(n.label + " — in arrivo"))}>
              <Icon name={n.icon} size={19} stroke={1.8} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="user" onClick={() => onToast("Profilo — in arrivo")}>
            <div className="avatar">MB</div>
            <div className="user-meta">
              <span className="user-name">{settings.user.name}</span>
              <span className="user-sub">{settings.bankDefault}</span>
            </div>
          </button>
        </div>
      </aside>
    );
  }

  function BottomNav({ active, onNav, onToast }) {
    return (
      <nav className="bottomnav">
        {NAV.map((n) => (
          <button key={n.id} className={"bnav" + (active === n.id ? " on" : "")}
            onClick={() => (n.id === "overview" ? onNav(n.id) : onToast(n.label + " — in arrivo"))}>
            <Icon name={n.icon} size={21} stroke={1.8} />
            <span>{n.label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    );
  }

  // ---------- Transaction drawer ----------
  function Drawer({ tx, onClose, onCategory, onToast }) {
    const [closing, setClosing] = useState(false);
    const cat = catById[tx.categoryId];
    const inc = tx.amount > 0;
    function close() { setClosing(true); setTimeout(onClose, 200); }
    const d = new Date(tx.date + "T12:00:00");
    return (
      <div className={"drawer-scrim" + (closing ? " out" : "")} onClick={close}>
        <div className={"drawer" + (closing ? " out" : "")} onClick={(e) => e.stopPropagation()}>
          <div className="drawer-head">
            <span className="drawer-title">Dettaglio transazione</span>
            <button className="iconbtn" onClick={close}><Icon name="close" size={18} /></button>
          </div>
          <div className="drawer-amount">
            <CatGlyph cat={cat} size={46} />
            <div>
              <div className={"drawer-amt " + (inc ? "in" : "out")}>{fmtEUR(tx.amount, { plus: inc })}</div>
              <div className="drawer-desc">{tx.description}</div>
            </div>
          </div>
          <dl className="drawer-rows">
            <div><dt>Data</dt><dd style={{ textTransform: "capitalize" }}>{d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</dd></div>
            <div><dt>Fonte</dt><dd>{tx.source === "manuale" ? "Inserita manualmente" : "Import bancario"}</dd></div>
            <div className="drawer-catrow">
              <dt>Categoria</dt>
              <dd>
                <div className="catselect">
                  {categories.filter((c) => !c.income || tx.amount > 0).slice(0, 99).map((c) => (
                    <button key={c.id} className={"catchip" + (c.id === tx.categoryId ? " on" : "")}
                      style={c.id === tx.categoryId ? { color: c.color, borderColor: c.color + "66", background: c.color + "1f" } : null}
                      onClick={() => onCategory(tx.id, c.id)}>
                      <Icon name={c.icon} size={13} stroke={2} />{c.name}
                    </button>
                  ))}
                </div>
              </dd>
            </div>
          </dl>
          <label className="drawer-note">
            <span>Note</span>
            <textarea placeholder="Aggiungi una nota o un tag…" rows={2} defaultValue={tx.note || ""} />
          </label>
          <div className="drawer-actions">
            <button className="btn ghost" onClick={() => onToast("Dividi importo — in arrivo")}>
              <Icon name="tag" size={15} /> Dividi
            </button>
            <button className="btn danger" onClick={() => { onToast("Eliminata (demo)"); close(); }}>Elimina</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Toast ----------
  function Toast({ msg }) {
    return <div className={"toast" + (msg ? " show" : "")}>{msg}</div>;
  }

  // ---------- Tweaks defaults ----------
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "direzione": "Raffinato",
    "accent": "#57D9B0",
    "grafico": "Curva",
    "densita": "Comoda",
    "vista": "Desktop",
  }/*EDITMODE-END*/;

  // ---------- App ----------
  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const [active, setActive] = useState("overview");
    const [period, setPeriod] = useState("3m");
    const [overrides, setOverrides] = useState({}); // txId -> categoryId
    const [drawerTx, setDrawerTx] = useState(null);
    const [toast, setToast] = useState("");
    const toastTimer = useRef(null);

    const editorial = t.direzione === "Editoriale";
    const accent = t.accent || (editorial ? ACCENTS.amber : ACCENTS.mint);
    const density = (t.densita || "Comoda").toLowerCase() === "compatta" ? "compatta" : "comoda";
    const mobile = t.vista === "Mobile";

    function showToast(m) {
      setToast(m); clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 2200);
    }
    function setCategory(txId, catId) {
      setOverrides((o) => ({ ...o, [txId]: catId }));
      setDrawerTx((d) => (d && d.id === txId ? { ...d, categoryId: catId } : d));
      showToast("Categoria aggiornata");
    }

    // apply overrides
    const txData = useMemo(() => transactions.map((x) => overrides[x.id] ? { ...x, categoryId: overrides[x.id] } : x), [overrides]);
    // patch FINANCE arrays used by aggregate (aggregate reads module transactions) -> recompute locally
    const { start, end, label } = getRange(period);
    const agg = useMemo(() => {
      const list = txData.filter((x) => { const d = new Date(x.date + "T12:00:00"); return d >= start && d <= end; });
      let spese = 0, entrate = 0; const byCat = {};
      for (const x of list) { if (x.amount < 0) { spese += -x.amount; byCat[x.categoryId] = (byCat[x.categoryId] || 0) + -x.amount; } else entrate += x.amount; }
      const cats = Object.entries(byCat).map(([id, val]) => ({ cat: catById[id], val })).sort((a, b) => b.val - a.val);
      return { list, spese, entrate, netto: entrate - spese, cats };
    }, [txData, period]);

    // previous period for deltas
    const prevAgg = useMemo(() => {
      const len = end - start;
      const pEnd = new Date(start.getTime() - 86400000), pStart = new Date(pEnd.getTime() - len);
      const list = txData.filter((x) => { const d = new Date(x.date + "T12:00:00"); return d >= pStart && d <= pEnd; });
      let spese = 0, entrate = 0; for (const x of list) { if (x.amount < 0) spese += -x.amount; else entrate += x.amount; }
      return { spese, entrate, netto: entrate - spese };
    }, [txData, period]);

    const series = useMemo(() => saldoSeries(start, end), [period]);
    const recent = useMemo(() => agg.list.slice(0, 10), [agg]);
    const months = Math.max(1, Math.round((end - start) / (86400000 * 30.4)));

    const fmtAxis = (v) => fmtEUR(v, { noSymbol: false });

    return (
      <div className={"app" + (mobile ? " mobile" : "") + (editorial ? " editorial" : "")}
        style={{ "--accent": accent }}>
        {!mobile && <Sidebar active={active} onNav={setActive} onToast={showToast} />}

        <main className="content">
          <header className="topbar">
            <div className="topbar-l">
              <h1 className="page-title">Panoramica</h1>
              <p className="page-sub" style={{ textTransform: "capitalize" }}>{label}</p>
            </div>
            <div className="topbar-r">
              <button className="iconbtn ring" onClick={() => showToast("Notifiche — in arrivo")}><Icon name="bell" size={18} /></button>
            </div>
          </header>

          <PeriodSelector value={period} onChange={setPeriod} />

          {/* KPIs */}
          <section className="kpis">
            <Kpi label="Spese totali" value={agg.spese} prev={prevAgg.spese} invert />
            <Kpi label="Entrate totali" value={agg.entrate} prev={prevAgg.entrate} />
            <Kpi label="Saldo netto" value={agg.netto} prev={prevAgg.netto}
              color={agg.netto >= 0 ? "var(--in)" : "var(--out)"} big />
          </section>

          {/* main grid */}
          <section className="grid2">
            <div className="card chartcard">
              <div className="card-head">
                <div>
                  <span className="card-eyebrow">Andamento saldo</span>
                  <div className="card-balance">{fmtEUR(series[series.length - 1]?.value || settings.saldoAttuale)}</div>
                </div>
                <span className="card-note">saldo a fine periodo</span>
              </div>
              <SaldoChart series={series} color={accent} height={mobile ? 200 : 260}
                mode={t.grafico === "Barre" ? "bars" : "curve"} fmt={fmtAxis} />
            </div>

            <div className="card catcard">
              <div className="card-head">
                <span className="card-eyebrow">Spese per categoria</span>
                <span className="card-note">{fmtEUR(agg.spese)}</span>
              </div>
              <CatBreakdown data={agg} months={months} total={agg.spese}
                onPick={(c) => showToast(c.name + " — apri in Transazioni")} />
            </div>
          </section>

          {/* recent */}
          <section className="card recentcard">
            <div className="card-head">
              <span className="card-eyebrow">Ultime transazioni</span>
              <button className="link" onClick={() => showToast("Transazioni — in arrivo")}>
                Vedi tutte <Icon name="chevRight" size={14} stroke={2.2} />
              </button>
            </div>
            <RecentList list={recent} density={density} onPick={setDrawerTx} />
          </section>

          <div style={{ height: mobile ? 96 : 28 }} />
        </main>

        {mobile && <BottomNav active={active} onNav={setActive} onToast={showToast} />}

        <button className="fab" onClick={() => showToast("Nuova transazione — in arrivo")} aria-label="Aggiungi">
          <Icon name="plus" size={22} stroke={2.2} />
        </button>

        {drawerTx && <Drawer tx={drawerTx} onClose={() => setDrawerTx(null)} onCategory={setCategory} onToast={showToast} />}
        <Toast msg={toast} />

        <TweaksPanel>
          <TweakSection label="Direzione visiva" />
          <TweakRadio label="Stile" value={t.direzione} options={["Raffinato", "Editoriale"]}
            onChange={(v) => { setTweak("direzione", v); setTweak("accent", v === "Editoriale" ? ACCENTS.amber : ACCENTS.mint); }} />
          <TweakColor label="Accento" value={t.accent}
            options={[ACCENTS.mint, ACCENTS.amber, ACCENTS.blue, ACCENTS.violet]}
            onChange={(v) => setTweak("accent", v)} />
          <TweakSection label="Layout" />
          <TweakRadio label="Grafico saldo" value={t.grafico} options={["Curva", "Barre"]}
            onChange={(v) => setTweak("grafico", v)} />
          <TweakRadio label="Densità righe" value={t.densita} options={["Comoda", "Compatta"]}
            onChange={(v) => setTweak("densita", v)} />
          <TweakRadio label="Vista" value={t.vista} options={["Desktop", "Mobile"]}
            onChange={(v) => setTweak("vista", v)} />
        </TweaksPanel>
      </div>
    );
  }

  window.__mountApp = function () {
    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
  };
})();
