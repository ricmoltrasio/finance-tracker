/* SaldoChart — renders the area/line as an <img> (SVG data-URI) so it captures
   reliably in screenshots/PDF/PPTX, with an HTML overlay for hover crosshair + tooltip.
   props: series [{date, value}], color, height, fmt(value)->string, mode 'curve'|'bars' */
(function () {
  const { useRef, useState, useMemo, useLayoutEffect } = React;

  function smoothD(pts) {
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.16;
      const c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
      const c2x = p2.x - (p3.x - p1.x) * t, c2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }
  function hexA(hex, a) {
    const h = hex.replace("#", ""), n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})`;
  }

  function SaldoChart({ series, color = "#57D9B0", height = 260, fmt, mode = "curve", locale = "it-IT" }) {
    const wrapRef = useRef(null);
    const [w, setW] = useState(720);
    const [hover, setHover] = useState(null);
    const H = height;
    const padT = 18, padB = 30, padL = 6, padR = 6;

    useLayoutEffect(() => {
      const el = wrapRef.current; if (!el) return;
      const ro = new ResizeObserver((e) => setW(Math.round(e[0].contentRect.width)));
      ro.observe(el); setW(el.clientWidth);
      return () => ro.disconnect();
    }, []);

    const geom = useMemo(() => {
      const vals = series.map((s) => s.value);
      let min = Math.min(...vals), max = Math.max(...vals);
      const span = max - min || 1; min -= span * 0.14; max += span * 0.14;
      const innerW = Math.max(10, w - padL - padR), innerH = H - padT - padB;
      const x = (i) => padL + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
      const y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;
      const pts = series.map((s, i) => ({ x: x(i), y: y(s.value), ...s }));
      return { pts, innerW, innerH };
    }, [series, w, H]);

    const ticks = useMemo(() => {
      const out = []; let lastM = -1;
      series.forEach((s, i) => { const d = new Date(s.date + "T00:00:00");
        if (d.getMonth() !== lastM) { lastM = d.getMonth(); out.push({ i, label: d.toLocaleDateString(locale, { month: "short" }).replace(".", "").toUpperCase() }); } });
      return out;
    }, [series, locale]);

    const imgSrc = useMemo(() => {
      const pts = geom.pts; if (!pts.length) return "";
      const base = H - padB;
      const grid = [0.25, 0.5, 0.75].map((g) => {
        const yy = (padT + geom.innerH * g).toFixed(1);
        return `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
      }).join("");
      let body;
      if (mode === "bars") {
        const bw = Math.max(1.5, geom.innerW / series.length - 1.6);
        body = pts.map((p) => `<rect x="${(p.x - bw / 2).toFixed(1)}" y="${p.y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, base - p.y).toFixed(1)}" rx="${Math.min(2, bw / 2).toFixed(1)}" fill="${color}" fill-opacity="0.55"/>`).join("");
      } else {
        const d = smoothD(pts);
        const area = `${d} L ${pts[pts.length-1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`;
        body = `<path d="${area}" fill="url(#g)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>`;
      }
      const tk = ticks.map((t) => { const p = pts[t.i]; return p ? `<text x="${p.x.toFixed(1)}" y="${H - 10}" fill="rgba(255,255,255,0.42)" font-size="11" font-family="Geist, system-ui" font-weight="600" text-anchor="middle" letter-spacing="0.5">${t.label}</text>` : ""; }).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.34"/><stop offset="55%" stop-color="${color}" stop-opacity="0.08"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}${body}${tk}</svg>`;
      return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }, [geom, w, H, color, mode, ticks, series.length]);

    function onMove(e) {
      const rect = wrapRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let best = 0, bd = Infinity;
      geom.pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < bd) { bd = d; best = i; } });
      setHover(best);
    }
    const hp = hover != null ? geom.pts[hover] : null;

    return (
      <div ref={wrapRef} style={{ position: "relative", width: "100%", height: H }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {imgSrc && <img src={imgSrc} draggable="false"
          style={{ display: "block", width: "100%", height: H, userSelect: "none" }} alt="Andamento saldo" />}
        {hp && mode !== "bars" && (
          <>
            <div style={{ position: "absolute", left: hp.x, top: padT - 6, height: H - padB - (padT - 6), width: 1,
              borderLeft: "1px dashed rgba(255,255,255,0.28)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: hp.x - 6, top: hp.y - 6, width: 12, height: 12, borderRadius: "50%",
              background: color, boxShadow: "0 0 0 2.5px #0B0D10", pointerEvents: "none" }} />
          </>
        )}
        {hp && (
          <div style={{ position: "absolute", top: padT - 4, pointerEvents: "none",
            left: Math.max(4, Math.min(w - 150, hp.x - 70)),
            background: "rgba(20,23,28,0.96)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10, padding: "8px 11px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", minWidth: 132 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 3, textTransform: "capitalize" }}>
              {new Date(hp.date + "T00:00:00").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" })}
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              {fmt ? fmt(hp.value) : hp.value}
            </div>
          </div>
        )}
      </div>
    );
  }

  window.SaldoChart = SaldoChart;
})();
