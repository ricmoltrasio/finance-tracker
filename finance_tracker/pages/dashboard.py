import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date
from utils.db import load_transactions


# ── helpers ──────────────────────────────────────────────────────────────────

def _filter_by_period(df: pd.DataFrame, period: str) -> pd.DataFrame:
    today = pd.Timestamp(date.today())
    if period == "Mese corrente":
        return df[df["date"].dt.to_period("M") == today.to_period("M")]
    elif period == "Ultimi 3 mesi":
        return df[df["date"] >= today - pd.DateOffset(months=3)]
    elif period == "Ultimi 6 mesi":
        return df[df["date"] >= today - pd.DateOffset(months=6)]
    elif period == "Ultimi 12 mesi":
        return df[df["date"] >= today - pd.DateOffset(months=12)]
    elif period == "Anno corrente":
        return df[df["date"].dt.year == today.year]
    elif period.startswith("Anno "):
        year = int(period.split(" ")[1])
        return df[df["date"].dt.year == year]
    else:
        # mese specifico es "2025-03"
        return df[df["date"].dt.to_period("M").astype(str) == period]


def show():
    st.title("📊 Dashboard")

    df = load_transactions()
    if df.empty:
        st.info("Nessuna transazione ancora. Vai su **Importa** o **Aggiungi spesa** per iniziare.")
        return

    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.to_period("M")

    # ── selezione periodo ─────────────────────────────────────────────────────
    today = pd.Timestamp(date.today())
    years = sorted(df["date"].dt.year.unique(), reverse=True)
    months_all = sorted(df["month"].unique(), reverse=True)
    month_labels = [str(m) for m in months_all]

    preset_options = (
        ["Mese corrente", "Ultimi 3 mesi", "Ultimi 6 mesi", "Ultimi 12 mesi", "Anno corrente"]
        + [f"Anno {y}" for y in years if y != today.year]
        + ["— Mese specifico —"]
    )

    c_period, c_month = st.columns([2, 2])
    with c_period:
        period = st.selectbox("📅 Periodo", preset_options, index=0)
    with c_month:
        if period == "— Mese specifico —":
            selected_label = st.selectbox("Scegli mese", month_labels)
            period = selected_label
        else:
            st.empty()

    fdf = _filter_by_period(df, period)

    if fdf.empty:
        st.warning("Nessuna transazione nel periodo selezionato.")
        return

    spese   = fdf[fdf["amount"] < 0].copy()
    entrate = fdf[fdf["amount"] > 0].copy()
    spese["amount_abs"] = spese["amount"].abs()

    # ── KPI ──────────────────────────────────────────────────────────────────
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("💸 Spese", f"€ {spese['amount_abs'].sum():,.2f}")
    k2.metric("💰 Entrate", f"€ {entrate['amount'].sum():,.2f}")
    netto = fdf["amount"].sum()
    k3.metric("📈 Netto periodo", f"€ {netto:,.2f}", delta=f"{netto:,.2f}")
    k4.metric("🔢 Transazioni", len(fdf))

    st.divider()

    # ── riga 1: trend spese/entrate + resoconto mensile ──────────────────────
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("📊 Spese ed entrate per mese")
        monthly = (
            fdf.groupby(fdf["date"].dt.to_period("M"))["amount"]
            .apply(lambda x: pd.Series({
                "Spese": x[x < 0].abs().sum(),
                "Entrate": x[x > 0].sum()
            }))
            .unstack()
            .reset_index()
        )
        monthly["month"] = monthly["date"].astype(str)
        monthly = monthly.sort_values("month")
        fig_trend = go.Figure()
        fig_trend.add_bar(x=monthly["month"], y=monthly["Spese"],   name="Spese",   marker_color="#EF7B7B")
        fig_trend.add_bar(x=monthly["month"], y=monthly["Entrate"], name="Entrate", marker_color="#6CBF8E")
        fig_trend.update_layout(barmode="group", margin=dict(t=10, b=10), legend=dict(orientation="h"))
        st.plotly_chart(fig_trend, use_container_width=True)

    with col2:
        st.subheader("📋 Resoconto mensile")
        resoconto = (
            fdf.groupby(fdf["date"].dt.to_period("M"))["amount"]
            .apply(lambda x: pd.Series({
                "Uscite (€)":  round(x[x < 0].abs().sum(), 2),
                "Entrate (€)": round(x[x > 0].sum(), 2),
                "Totale (€)":  round(x.sum(), 2),
            }))
            .unstack()
            .reset_index()
        )
        resoconto = resoconto.rename(columns={"date": "Mese"})
        resoconto["Mese"] = resoconto["Mese"].astype(str)
        resoconto = resoconto.sort_values("Mese", ascending=False)

        def color_totale(val):
            color = "#6CBF8E" if val >= 0 else "#EF7B7B"
            return f"color: {color}; font-weight: bold"

        styled = resoconto.style.map(color_totale, subset=["Totale (€)"])
        st.dataframe(styled, use_container_width=True, hide_index=True)

    st.divider()

    # ── riga 2: saldo cumulativo + torta categorie ────────────────────────────
    col3, col4 = st.columns(2)

    with col3:
        st.subheader("📈 Andamento saldo")
        saldo_attuale = st.number_input(
            "Saldo attuale del conto (€)",
            value=st.session_state.get("saldo_attuale", 0.0),
            step=100.0, format="%.2f",
            help="Inserisci il saldo reale di oggi — il grafico verrà calcolato a ritroso"
        )
        st.session_state["saldo_attuale"] = saldo_attuale

        # calcola saldo giornaliero a ritroso da oggi
        # 1. somma netta per giorno su TUTTO lo storico
        daily_net = (
            df.groupby(df["date"].dt.normalize())["amount"]
            .sum()
            .sort_index()
        )
        # 2. partiamo dal saldo attuale e andiamo indietro giorno per giorno
        saldo_series = {}
        saldo = saldo_attuale
        for day in sorted(daily_net.index, reverse=True):
            saldo_series[day] = round(saldo, 2)
            saldo -= daily_net[day]

        saldo_df = pd.DataFrame(
            sorted(saldo_series.items()),
            columns=["Data", "Saldo (€)"]
        )
        # filtra solo i giorni nel periodo selezionato
        saldo_df = saldo_df[
            (saldo_df["Data"] >= fdf["date"].min()) &
            (saldo_df["Data"] <= fdf["date"].max())
        ].sort_values("Data")

        fig_saldo = px.line(
            saldo_df, x="Data", y="Saldo (€)",
            color_discrete_sequence=["#6C9BCF"],
        )
        fig_saldo.update_layout(margin=dict(t=10, b=10), hovermode="x unified")
        fig_saldo.update_traces(line_width=2)
        fig_saldo.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.4)
        st.plotly_chart(fig_saldo, use_container_width=True)

    with col4:
        st.subheader("🍩 Spese per categoria")
        if spese.empty:
            st.info("Nessuna spesa nel periodo.")
        else:
            cat_df = spese.groupby("category")["amount_abs"].sum().reset_index()
            fig_pie = px.pie(
                cat_df, values="amount_abs", names="category",
                hole=0.4,
                color_discrete_sequence=px.colors.qualitative.Pastel,
            )
            fig_pie.update_traces(textposition="inside", textinfo="percent+label")
            fig_pie.update_layout(showlegend=False, margin=dict(t=10, b=10))
            st.plotly_chart(fig_pie, use_container_width=True)

    st.divider()

    # ── top spese espandibile ─────────────────────────────────────────────────
    st.subheader("🔝 Spese maggiori")
    if not spese.empty:
        n_default = 5
        mostra_tutte = st.toggle("Mostra tutte", value=False)
        top_spese = spese.nlargest(len(spese) if mostra_tutte else n_default, "amount_abs")
        top_display = top_spese[["date", "description", "category", "amount_abs"]].copy()
        top_display = top_display.rename(columns={
            "amount_abs": "Importo (€)", "date": "Data",
            "description": "Descrizione", "category": "Categoria"
        })
        top_display["Data"] = top_display["Data"].dt.strftime("%d/%m/%Y")
        st.dataframe(top_display, use_container_width=True, hide_index=True)