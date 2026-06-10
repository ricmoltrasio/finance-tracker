import streamlit as st

st.set_page_config(
    page_title="Finance Tracker",
    page_icon="💶",
    layout="wide",
    initial_sidebar_state="expanded",
)

# navigazione manuale (compatibile con Streamlit Cloud free tier)
PAGES = {
    "📊 Dashboard":         "pages.dashboard",
    "📥 Importa":           "pages.importa",
    "✏️ Aggiungi spesa":    "pages.aggiungi",
    "📋 Transazioni":       "pages.transazioni",
}

with st.sidebar:
    st.markdown("## 💶 Finance Tracker")
    st.divider()
    page = st.radio("Navigazione", list(PAGES.keys()), label_visibility="collapsed")

# carica il modulo selezionato
import importlib
mod = importlib.import_module(PAGES[page])
mod.show()
