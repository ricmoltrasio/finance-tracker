import streamlit as st
from utils.importer import parse_file, map_columns
from utils.db import bulk_insert


def show():
    st.title("📥 Importa transazioni")
    st.markdown("Carica un file **CSV o Excel** esportato dalla tua banca.")

    uploaded = st.file_uploader("Scegli file", type=["csv", "xlsx", "xls"])

    if uploaded:
        raw_df = parse_file(uploaded)
        if raw_df is None:
            return

        st.markdown("**Anteprima del file:**")
        st.dataframe(raw_df.head(5), use_container_width=True)

        mapped_df = map_columns(raw_df)

        if mapped_df is not None:
            n = bulk_insert(mapped_df)
            if n > 0:
                st.success(f"✅ Importate **{n}** nuove transazioni (duplicati ignorati).")
            else:
                st.warning("Nessuna nuova transazione — tutte già presenti nel database.")
