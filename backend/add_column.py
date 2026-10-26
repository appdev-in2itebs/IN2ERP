import sqlite3

conn = sqlite3.connect('in2it_erp.db')
c = conn.cursor()
c.execute('PRAGMA table_info(app_assignments)')
cols = [r[1] for r in c.fetchall()]
print('Current columns:', cols)
if 'app_role' not in cols:
    c.execute("ALTER TABLE app_assignments ADD COLUMN app_role VARCHAR(50) DEFAULT 'Member'")
    conn.commit()
    print('Added app_role column successfully!')
else:
    print('app_role column already exists.')

# Let's inspect current assignments
c.execute("SELECT id, user_id, application_id, status, app_role FROM app_assignments")
rows = c.fetchall()
print('Current rows:', rows)
conn.close()
