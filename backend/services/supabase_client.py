"""Supabase client factory. RLS is enabled — pass the user's token for
user-scoped reads/writes; use the service role only for admin/ingest."""
import os

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# TODO: from supabase import create_client; return create_client(...)
