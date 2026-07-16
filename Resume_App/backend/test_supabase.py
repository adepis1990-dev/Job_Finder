from dotenv import load_dotenv
import os
load_dotenv()
from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
sb = create_client(url, key)

# Try listing rows from documents table
try:
    res = sb.table("documents").select("id").limit(1).execute()
    print("Connected OK. Rows in documents:", len(res.data))
except Exception as e:
    print("Error:", e)
