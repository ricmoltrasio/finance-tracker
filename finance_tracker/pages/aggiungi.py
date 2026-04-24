import streamlit as st
from datetime import date
from utils.db import insert_transaction
from utils.categories import CATEGORIES

PAYMENT_METHODS = ["💵 Contanti", "💳 Carta non tracciata", "🤝 Bonifico a privato", "🔄 Altro fuori conto"]


def show():
    st.title("✏️ Aggiungi spesa manuale")
    st.markdown("Per le spese **fuori conto**: contanti, pagamenti non tracciati, affitti in nero, ecc.")

    tab1, tab2 = st.tabs(["➕ Singola spesa", "🔁 Spesa ricorrente"])

    # ── TAB 1: spesa singola
    with tab1:
        with st.form("add_form", clear_on_submit=True):
            c1, c2 = st.columns(2)
            with c1:
                tx_date     = st.date_input("Data", value=date.today())
                amount_raw  = st.number_input("Importo (€)", min_value=0.01, step=0.01, format="%.2f")
                tx_type     = st.radio("Tipo", ["Uscita 💸", "Entrata 💰"], horizontal=True)
            with c2:
                description = st.text_input("Descrizione", placeholder="es. Mercato, Babysitter, Affitto...")
                category    = st.selectbox("Categoria", CATEGORIES)
                payment     = st.selectbox("Metodo di pagamento", PAYMENT_METHODS)
                note        = st.text_area("Note (opzionale)", height=68)

            submitted = st.form_submit_button("💾 Salva", use_container_width=True)

        if submitted:
            if not description.strip():
                st.warning("Inserisci una descrizione.")
            else:
                amount = -amount_raw if "Uscita" in tx_type else amount_raw
                full_note = f"[{payment}] {note}".strip()
                insert_transaction(tx_date, description.strip(), amount, category, "manuale", full_note)
                st.success(f"✅ Salvato: **{description}** — € {amount_raw:.2f} ({payment})")

    # ── TAB 2: spesa ricorrente
    with tab2:
        st.markdown("Genera automaticamente più voci per una spesa che si ripete ogni mese (es. affitto, babysitter).")

        with st.form("recurring_form", clear_on_submit=True):
            c1, c2 = st.columns(2)
            with c1:
                rec_desc    = st.text_input("Descrizione", placeholder="es. Affitto in contanti")
                rec_amount  = st.number_input("Importo mensile (€)", min_value=0.01, step=0.01, format="%.2f")
                rec_type    = st.radio("Tipo", ["Uscita 💸", "Entrata 💰"], horizontal=True, key="rec_type")
            with c2:
                rec_cat     = st.selectbox("Categoria", CATEGORIES, key="rec_cat")
                rec_payment = st.selectbox("Metodo di pagamento", PAYMENT_METHODS, key="rec_pay")
                rec_day     = st.number_input("Giorno del mese", min_value=1, max_value=28, value=1)
                rec_months  = st.number_input("Quanti mesi passati?", min_value=1, max_value=24, value=3,
                                               help="Verranno create voci per gli ultimi N mesi")

            rec_submit = st.form_submit_button("🔁 Genera voci ricorrenti", use_container_width=True)

        if rec_submit:
            if not rec_desc.strip():
                st.warning("Inserisci una descrizione.")
            else:
                amount = -rec_amount if "Uscita" in rec_type else rec_amount
                full_note = f"[{rec_payment}] ricorrente"
                today = date.today()
                inserted = 0
                for i in range(int(rec_months)):
                    month_offset = today.month - i - 1
                    year  = today.year + (month_offset // 12)
                    month = month_offset % 12 + 1
                    try:
                        tx_date = date(year, month, int(rec_day))
                    except ValueError:
                        tx_date = date(year, month, 28)
                    insert_transaction(tx_date, rec_desc.strip(), amount, rec_cat, "manuale", full_note)
                    inserted += 1
                st.success(f"✅ Create **{inserted}** voci per «{rec_desc}» — € {amount_raw:.2f}/mese")
                st.info("💡 Controlla in **Transazioni** che non ci siano duplicati se hai già inserito alcune voci.")
