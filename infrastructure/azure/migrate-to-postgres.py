"""
In2IT ERP - copy data from a local SQLite database into PostgreSQL

The target schema is created by Alembic, never by this script:

    # 1. Create the schema in the target (from backend/)
    DATABASE_URL="postgresql+asyncpg://<user>@<host>:5432/in2it_erp" alembic upgrade head
    # 2. Upgrade the SQLite source to the same revision (on a copy if you prefer)
    DATABASE_URL="sqlite+aiosqlite:///./in2it_erp.db" alembic upgrade head
    # 3. Copy the rows (the URL comes from the environment, not the command line)
    export TARGET_DATABASE_URL="postgresql://<user>:<password>@<host>:5432/in2it_erp?sslmode=require"
    python infrastructure/azure/migrate-to-postgres.py --sqlite ./backend/in2it_erp.db

Safety:
- Refuses to run unless source and target are at the same Alembic revision.
- Refuses to write into a target table that already contains rows (nothing is deleted).
- Copies everything in one transaction; on any error nothing is committed.
- Never prints credentials.

Requires a synchronous PostgreSQL driver: pip install psycopg2-binary
"""

import argparse
import os
import sys
from urllib.parse import urlsplit

from sqlalchemy import Boolean, MetaData, create_engine, func, select, text

SKIP_TABLES = {"alembic_version"}


def _masked(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.hostname or ''}:{parts.port or ''}{parts.path}"


def _revision(conn) -> str | None:
    try:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:
        return None


def migrate(sqlite_path: str, target_url: str) -> None:
    source = create_engine(f"sqlite:///{sqlite_path}")
    target = create_engine(target_url.replace("+asyncpg", ""))
    print(f"Source: sqlite:///{sqlite_path}")
    print(f"Target: {_masked(target_url)}")

    with source.connect() as src, target.connect() as dst:
        src_rev, dst_rev = _revision(src), _revision(dst)
        if not dst_rev:
            sys.exit("Target has no Alembic revision. Run `alembic upgrade head` against it first.")
        if src_rev != dst_rev:
            sys.exit(f"Revision mismatch: source {src_rev}, target {dst_rev}. Upgrade both to head.")

        target_meta = MetaData()
        target_meta.reflect(bind=dst)
        source_meta = MetaData()
        source_meta.reflect(bind=src)

        tables = [t for t in target_meta.sorted_tables if t.name not in SKIP_TABLES]
        for table in tables:
            if dst.execute(select(func.count()).select_from(table)).scalar():
                sys.exit(f"Target table '{table.name}' is not empty; refusing to overwrite.")

        with dst.begin():
            for table in tables:
                src_table = source_meta.tables.get(table.name)
                if src_table is None:
                    print(f"  {table.name}: not in source, skipped")
                    continue
                rows = [dict(r._mapping) for r in src.execute(select(src_table))]
                if not rows:
                    print(f"  {table.name}: 0 rows")
                    continue
                booleans = [c.name for c in table.columns if isinstance(c.type, Boolean)]
                for row in rows:
                    for name in booleans:
                        if row.get(name) is not None:
                            row[name] = bool(row[name])
                dst.execute(table.insert(), rows)
                print(f"  {table.name}: {len(rows)} rows")
    print("Done. Verify row counts and sign-in before switching DATABASE_URL.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy In2IT ERP data from SQLite to PostgreSQL")
    parser.add_argument("--sqlite", default="./backend/in2it_erp.db", help="Path to the SQLite file")
    args = parser.parse_args()

    target_url = os.environ.get("TARGET_DATABASE_URL")
    if not target_url:
        sys.exit("Set TARGET_DATABASE_URL to the PostgreSQL connection URL.")
    migrate(args.sqlite, target_url)


if __name__ == "__main__":
    main()
