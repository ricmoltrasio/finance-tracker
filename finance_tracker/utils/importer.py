import pandas as pd
import streamlit as st
from utils.categories import categorize


def parse_file(uploaded_file) -> pd.DataFrame | None:
    name = uploaded_file.name.lower()
    try:
        if name.endswith(".xlsx") or name.endswith(".xls"):
            df = pd.read_excel(uploaded_file, header=0)
        else:
            try:
                df = pd.read_csv(uploaded_file, sep=";", encoding="utf-8")
                if df.shape[1] < 2:
                    uploaded_file.seek(0)
                    df = pd.read_csv(uploaded_file, sep=",", encoding="utf-8")
            except Exception:
                uploaded_file.seek(0)
                df = pd.read_csv(uploaded_file, sep=",", encoding="latin-1")
    except Exception as e:
        st.error(f"Errore nella lettura del file: {e}")
        return None

    df.columns = [c.strip() for c in df.columns]
    return df


def _parse_one(val) -> float:
    """
    Converte un valore testuale in float gestendo formati europei.
    -3,50      -> -3.5
    -1.234,50  -> -1234.5
    1.200,00   -> 1200.0
    """
    s = str(val).strip().replace("\xa0", "").replace(" ", "")
    if s in ("", "nan", "None", "-"):
        return float("nan")
    if "." in s and "," in s:
        # punto = migliaia, virgola = decimale
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        # solo virgola = decimale
        s = s.replace(",", ".")
    # altrimenti lascia stare (già formato con punto o intero)
    try:
        return float(s)
    except ValueError:
        return float("nan")


def _parse_amount_col(series: pd.Series) -> pd.Series:
    return series.apply(_parse_one)


def _detect_intesa_columns(df: pd.DataFrame):
    """Rileva automaticamente le colonne Intesa Sanpaolo per nome."""
    cols = {c.strip().lower(): c for c in df.columns}
    date_col   = next((cols[k] for k in ["data", "data operazione"] if k in cols), None)
    desc_col   = next((cols[k] for k in ["dettagli", "descrizione", "operazione"] if k in cols), None)
    amount_col = next((cols[k] for k in ["importo"] if k in cols), None)
    return date_col, desc_col, amount_col


def map_columns(df: pd.DataFrame):
    st.markdown("#### Mappa le colonne del tuo file")

    # prova rilevamento automatico
    auto_date, auto_desc, auto_amount = _detect_intesa_columns(df)

    if auto_date and auto_desc and auto_amount:
        st.success(f"✅ Colonne rilevate automaticamente: **{auto_date}** | **{auto_desc}** | **{auto_amount}**")
        st.markdown("Puoi confermare o cambiare manualmente qui sotto.")
    
    cols_opt = ["— seleziona —"] + list(df.columns)

    def default_idx(col):
        if col and col in df.columns:
            return cols_opt.index(col)
        return 0

    c1, c2, c3 = st.columns(3)
    with c1:
        col_date   = st.selectbox("📅 Data", cols_opt, index=default_idx(auto_date), key="map_date")
    with c2:
        col_desc   = st.selectbox("📝 Descrizione", cols_opt, index=default_idx(auto_desc), key="map_desc")
    with c3:
        col_amount = st.selectbox("💶 Importo", cols_opt, index=default_idx(auto_amount), key="map_amount")

    if st.button("✅ Conferma mapping", use_container_width=True):
        missing = []
        if "seleziona" in col_date:   missing.append("Data")
        if "seleziona" in col_desc:   missing.append("Descrizione")
        if "seleziona" in col_amount: missing.append("Importo")
        if missing:
            st.warning(f"Seleziona le colonne mancanti: {', '.join(missing)}")
            return None

        out = pd.DataFrame()
        out["date"]        = pd.to_datetime(df[col_date], dayfirst=True, errors="coerce")
        out["description"] = df[col_desc].astype(str).str.strip()
        out["amount"]      = _parse_amount_col(df[col_amount])

        out = out.dropna(subset=["date", "amount"])
        out = out[out["amount"] != 0]
        out["category"] = out["description"].apply(categorize)

        # anteprima con valori leggibili
        preview = out.head(10).copy()
        preview["date"] = preview["date"].dt.strftime("%d/%m/%Y")
        st.success(f"Trovate **{len(out)}** transazioni valide.")
        st.dataframe(preview[["date", "description", "amount", "category"]], use_container_width=True)
        return out

    return None