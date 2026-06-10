
precisazioni sulle categorie:
le categorie devono essere queste, le ultime tre sono le entrate, le altre le uscite; tenere le parole chiave esistenti per la categorizzazione di quelle che c'erano già, aggiungere per quelle nuove 

uscite:

cibo(spesa ristoranti bar) 
auto (benzina, spese meccanico) , 
salute (spese mediche, farmacia, creme), 
intrattenimento (cinema, concerti, videogiochi), 
abbonamenti(netflix, amazon, google), 
shopping (vestiti, oggetti), 
teatro e cinema(corso), 
spostamenti (mezzi pubblici e parcheggi)
viaggi (trasporto e alloggio)
altro (spese varie)


entrate:

stipendio (non usare parole chiave se un entrate è maggiore di 600€ conta come stipendio)
contanti
rimborsi



aggiungi anche questa feature per il calcolo del saldo partendo dall attuale 

Aggiungi una riga in settings:
sql
INSERT INTO settings (key, value) VALUES ('saldo_iniziale', '1500.00');
Poi modifichi la query timeline così:
sql
WITH saldo_iniziale AS (
  SELECT COALESCE(
    (SELECT value::numeric FROM settings WHERE key = 'saldo_iniziale'), 
    0
  ) as starting_balance
)
SELECT 
  t.date,
  starting_balance + SUM(SUM(t.amount)) OVER (ORDER BY t.date) AS saldo_cumulativo
FROM transactions t
CROSS JOIN saldo_iniziale si
GROUP BY t.date, si.starting_balance
Cosa fa: Parte da saldo_iniziale (es. 1500€) e somma tutte le transazioni successive.

📝 Nel tuo piano, dove lo inserisci
Backend — db/supabase.py o nella query timeline
python
# Nel servizio che calcola il timeline
def get_timeline(from_date, to_date):
    # Prendi il saldo iniziale dalle settings
    initial = get_setting('saldo_iniziale', 0)
    
    query = """
    WITH cumulative AS (
        SELECT 
            date,
            SUM(amount) OVER (ORDER BY date) as running_total
        FROM transactions
        WHERE date >= $1 AND date <= $2
    )
    SELECT date, ($3 + running_total) as balance
    FROM cumulative
    """
    return supabase.query(query, [from_date, to_date, initial])
Frontend — nessuna modifica
L'utente non deve pensare al saldo iniziale. Semplicemente:
Primo utilizzo: l'utente inserisce il saldo attuale nelle impostazioni (una volta sola)
Backend lo salva in settings.saldo_iniziale
Tutti i calcoli successivi partono da quel valore


