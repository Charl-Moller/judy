import os
import sys
from dotenv import load_dotenv
from sqlalchemy.engine.url import make_url
import psycopg2

# Load .env from project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
DOTENV_PATH = os.path.join(PROJECT_ROOT, ".env")
load_dotenv(DOTENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env", file=sys.stderr)
    sys.exit(1)

try:
    url = make_url(DATABASE_URL)
except Exception as exc:
    print(f"ERROR: Invalid DATABASE_URL: {exc}", file=sys.stderr)
    sys.exit(2)

# Basic diagnostics (no secrets)
print(f"Driver: {url.drivername}, Host: {url.host}, DB: {url.database}")

# Accept 'postgresql', 'postgresql+psycopg2', and 'postgres'
drivername_lower = (url.drivername or "").lower()
if not ("postgresql" in drivername_lower or drivername_lower.startswith("postgres")):
    print("ERROR: Only postgres/postgresql URLs are supported for DB creation", file=sys.stderr)
    sys.exit(3)

db_name = url.database
if not db_name:
    print("ERROR: DATABASE_URL missing database name", file=sys.stderr)
    sys.exit(4)

"""
Connect to admin DB (postgres) and create target DB if needed.
Force SSL for cloud providers like Azure by appending sslmode=require when missing.
"""
admin_url = url.set(database="postgres")
admin_dsn = str(admin_url).replace("+psycopg2", "")
if "sslmode=" not in admin_dsn:
    sep = "&" if "?" in admin_dsn else "?"
    admin_dsn = f"{admin_dsn}{sep}sslmode=require"

try:
    conn = psycopg2.connect(admin_dsn)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    exists = cur.fetchone() is not None
    if exists:
        print(f"Database '{db_name}' already exists")
    else:
        cur.execute(f"CREATE DATABASE \"{db_name}\"")
        print(f"Created database '{db_name}'")
    cur.close()
    conn.close()
except Exception as exc:
    print(
        "ERROR: Failed to create database: "
        f"{exc}\n- Ensure your Azure Postgres firewall allows your IP\n"
        "- Verify username/password (Azure may require the server suffix or specific roles)\n"
        "- Confirm SSL is required; we set sslmode=require automatically\n",
        file=sys.stderr,
    )
    sys.exit(5)

