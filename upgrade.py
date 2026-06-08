import sqlite3

def upgrade():
    conn = sqlite3.connect('D:\\PETER\\ChizaApp\\mariage_app\\mariage.db')
    cursor = conn.cursor()
    
    queries = [
        "ALTER TABLE invitations ADD COLUMN role TEXT DEFAULT 'invité'",
        "ALTER TABLE invitations ADD COLUMN regime_alimentaire TEXT DEFAULT 'Aucun'",
        "ALTER TABLE invitations ADD COLUMN accompagnants INTEGER DEFAULT 0"
    ]
    
    for q in queries:
        try:
            cursor.execute(q)
            print("Successfully added:", q)
        except Exception as e:
            print("Skipped or error:", e)
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    upgrade()
