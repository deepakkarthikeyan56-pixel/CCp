import sqlite3
import os
from datetime import datetime

# On Vercel / serverless, /var/task (the project dir) is read-only.
# Use /tmp for the database when it is available (writable on all platforms),
# falling back to a local path for development.
_LOCAL_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'churn.db')
DB_PATH = os.environ.get('DB_PATH') or (
    '/tmp/churn.db' if os.path.exists('/tmp') else _LOCAL_DB
)


def get_db():
    # Only create parent directory for local dev; /tmp always exists on Vercel.
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and db_dir != '/tmp':
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            avatar_color TEXT DEFAULT '#2563EB',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_path TEXT DEFAULT '',
            rows_count INTEGER,
            columns_count INTEGER,
            column_names TEXT,
            missing_values INTEGER DEFAULT 0,
            duplicate_values INTEGER DEFAULT 0,
            target_column TEXT,
            file_size REAL,
            csv_data BLOB,
            column_dtypes TEXT,
            head_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            dataset_id INTEGER,
            customer_name TEXT,
            input_data TEXT,
            prediction_result TEXT,
            probability REAL,
            algorithm_used TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS model_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            dataset_id INTEGER,
            algorithm TEXT NOT NULL,
            accuracy REAL,
            precision_score REAL,
            recall_score REAL,
            f1_score REAL,
            roc_auc REAL,
            model_path TEXT,
            model_size REAL,
            confusion_matrix TEXT,
            feature_importance TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS login_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
    ''')

    # Migrate existing databases: add new columns if they don't exist yet.
    migrations = [
        "ALTER TABLE datasets ADD COLUMN csv_data BLOB",
        "ALTER TABLE datasets ADD COLUMN column_dtypes TEXT",
        "ALTER TABLE datasets ADD COLUMN head_data TEXT",
    ]
    for stmt in migrations:
        try:
            cursor.execute(stmt)
        except Exception:
            pass  # Column already exists — safe to ignore.

    conn.commit()
    conn.close()


def log_activity(user_id, action, details=None):
    conn = get_db()
    conn.execute(
        'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
        (user_id, action, details)
    )
    conn.commit()
    conn.close()


if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
