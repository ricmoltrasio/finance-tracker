import os
import threading

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_client: Client | None = None
# Gli endpoint sync girano nel threadpool: senza lock, N richieste simultanee
# a cache fredda costruirebbero N client in parallelo (double-checked locking).
_lock = threading.Lock()


def get_client() -> Client:
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                url = os.environ["SUPABASE_URL"]
                key = os.environ["SUPABASE_KEY"]
                _client = create_client(url, key)
    return _client
