import sys
sys.path.insert(0, '.')
from backend.db import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("UPDATE complaints SET status = 'Assigned Employee' WHERE id = 2")
conn.commit()
cursor.execute('SELECT id, status FROM complaints WHERE id=2')
print(dict(cursor.fetchone()))
conn.close()
