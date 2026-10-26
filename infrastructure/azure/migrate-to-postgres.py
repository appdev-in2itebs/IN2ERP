"""
In2IT ERP - SQLite to PostgreSQL Data Migration Script
Transfers all data from local SQLite database to Azure PostgreSQL Flexible Server.

Usage:
  python infrastructure/azure/migrate-to-postgres.py \
    --sqlite ./backend/in2it_erp.db \
    --postgres postgresql://user:password@hostname:5432/in2it_erp
"""

import argparse
import sys
from sqlalchemy import create_engine, MetaData, Table, select
from sqlalchemy.orm import sessionmaker


def migrate(sqlite_url: str, postgres_url: str):
    print(f"🔄 Connecting to SQLite: {sqlite_url}")
    sqlite_engine = create_engine(sqlite_url)

    print(f"🔄 Connecting to PostgreSQL: {postgres_url}")
    postgres_engine = create_engine(postgres_url)

    # Reflect SQLite schema
    metadata = MetaData()
    metadata.reflect(bind=sqlite_engine)

    print(f"📋 Found {len(metadata.sorted_tables)} tables to migrate in dependency order:")
    for table in metadata.sorted_tables:
        print(f"   • {table.name}")

    # Create tables in PostgreSQL if not present
    print("\n🔨 Creating tables in PostgreSQL...")
    metadata.create_all(bind=postgres_engine)

    # Transfer data in foreign-key dependency order
    sqlite_conn = sqlite_engine.connect()
    postgres_conn = postgres_engine.connect()

    trans = postgres_conn.begin()
    try:
        for table in metadata.sorted_tables:
            print(f"\n📦 Migrating table: {table.name}...")
            # Read rows from SQLite
            rows = sqlite_conn.execute(select(table)).fetchall()
            if not rows:
                print(f"   (0 rows found, skipping)")
                continue

            print(f"   Transferring {len(rows)} records...")
            # Convert Row objects to dicts
            row_dicts = [dict(row._mapping) for row in rows]

            # Clear target table to prevent duplication
            postgres_conn.execute(table.delete())

            # Bulk insert
            postgres_conn.execute(table.insert(), row_dicts)
            print(f"   ✅ {len(rows)} records inserted into PostgreSQL.")

        trans.commit()
        print("\n🎉 Migration completed successfully! All data transferred to PostgreSQL.")

    except Exception as e:
        trans.rollback()
        print(f"\n❌ Error during migration: {e}", file=sys.stderr)
        raise
    finally:
        sqlite_conn.close()
        postgres_conn.close()


def main():
    parser = argparse.ArgumentParser(description="Migrate In2IT ERP database from SQLite to PostgreSQL")
    parser.add_argument(
        "--sqlite",
        default="sqlite:///./backend/in2it_erp.db",
        help="SQLite database URL (default: sqlite:///./backend/in2it_erp.db)",
    )
    parser.add_argument(
        "--postgres",
        required=True,
        help="Target PostgreSQL database URL (e.g. postgresql://user:pass@host:5432/in2it_erp)",
    )

    args = parser.parse_args()

    # Ensure synchronous dialect for migration script
    sqlite_url = args.sqlite.replace("+aiosqlite", "")
    postgres_url = args.postgres.replace("+asyncpg", "")

    migrate(sqlite_url, postgres_url)


if __name__ == "__main__":
    main()
