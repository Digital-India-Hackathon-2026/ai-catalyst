import sys
sys.path.insert(0, '.')
from backend.db import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()

# Check complaints table columns
try:
    cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='complaints' ORDER BY ordinal_position")
    rows = cursor.fetchall()
    print("Complaints columns:")
    for r in rows:
        print(f"  {r['column_name']}: {r['data_type']}")
except Exception as e:
    print('columns error:', e)

# Test category with dict access
try:
    cursor.execute("SELECT category, COUNT(*) as cnt FROM complaints GROUP BY category")
    rows = cursor.fetchall()
    print("Category query result:", rows)
    print("First row type:", type(rows[0]) if rows else "empty")
    if rows:
        print("First row items:", dict(rows[0]))
except Exception as e:
    print('category error:', type(e).__name__, e)

conn.close()
print("Done")
