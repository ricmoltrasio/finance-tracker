import streamlit as st
import pandas as pd
from utils.db import load_transactions, delete_transaction, update_category
from utils.categories import CATEGORIES


def show():
    st.title("📋 Transazioni")

    df = load_transactions()
    if df.empty:
        st.info("Nessuna transazione ancora.")
        return

    # ── filtri ────────────────────────────────────────────────────────────────
    df["month"] = df["date"].dt.to_period("M")
    months = ["Tutti"] + [str(m) for m in sorted(df["month"].unique(), reverse=True)]
    cats   = ["Tutte"] + CATEGORIES

    c1, c2, c3 = st.columns(3)
    with c1: sel_month  = st.selectbox("Mese", months)
    with c2: sel_cat    = st.selectbox("Categoria", cats)
    with c3: sel_source = st.selectbox("Fonte", ["Tutte", "import", "manuale"])

    fdf = df.copy()
    if sel_month  != "Tutti":  fdf = fdf[fdf["month"].astype(str) == sel_month]
    if sel_cat    != "Tutte":  fdf = fdf[fdf["category"] == sel_cat]
    if sel_source != "Tutte":  fdf = fdf[fdf["source"] == sel_source]

    st.markdown(f"**{len(fdf)} transazioni** | Totale: € {fdf['amount'].sum():,.2f}")

    # ── tabella con menu categoria per riga ───────────────────────────────────
    # usa st.data_editor con colonna categoria come selectbox
    edit_df = fdf[["id", "date", "description", "amount", "category", "source"]].copy()
    edit_df["date"] = edit_df["date"].dt.strftime("%d/%m/%Y")
    edit_df = edit_df.rename(columns={
        "id": "ID", "date": "Data", "description": "Descrizione",
        "amount": "Importo (€)", "category": "Categoria", "source": "Fonte"
    })

    edited = st.data_editor(
        edit_df,
        use_container_width=True,
        hide_index=True,
        disabled=["ID", "Data", "Descrizione", "Importo (€)", "Fonte"],
        column_config={
            "Categoria": st.column_config.SelectboxColumn(
                "Categoria",
                options=CATEGORIES,
                required=True,
                width="medium",
            )
        },
        key="tx_editor"
    )

    # rileva righe con categoria modificata e salva
    changed = edited[edited["Categoria"] != edit_df["Categoria"]]
    if not changed.empty:
        for _, row in changed.iterrows():
            update_category(int(row["ID"]), row["Categoria"])
        st.success(f"✅ Aggiornate {len(changed)} categorie.")
        st.rerun()

    # ── elimina ───────────────────────────────────────────────────────────────
    st.divider()
    st.subheader("🗑️ Elimina transazione")
    del_id = st.number_input("ID da eliminare", min_value=1, step=1)
    if st.button("Elimina", type="secondary"):
        delete_transaction(int(del_id))
        st.success(f"Transazione {del_id} eliminata.")
        st.rerun()