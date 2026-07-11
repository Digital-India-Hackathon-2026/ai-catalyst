import os
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor

# Manual parser to load .env variables if not loaded
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip()
    except Exception as e:
        print(f"Error loading .env file: {e}")

def get_db_connection():
    """Establishes connection to the PostgreSQL database with RealDictCursor enabled."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL is not set in environment variables.")
        
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    return conn

def init_db():
    """
    Supabase database schema is managed via the SQL Editor (database/supabase_schema.sql).
    This function is kept as a stub so app.py doesn't crash.
    """
    pass

if __name__ == '__main__':
    try:
        conn = get_db_connection()
        print("Connected to Supabase PostgreSQL successfully.")
        conn.close()
    except Exception as e:
        print(f"Failed to connect to database: {e}")
