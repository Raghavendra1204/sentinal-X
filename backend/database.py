"""SQLite storage with explicit write transactions."""

from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Iterator


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        connection.execute("PRAGMA synchronous = FULL")
        return connection

    def initialize(self) -> None:
        with self.connect() as db:
            db.execute("PRAGMA journal_mode = WAL")
            db.executescript("""
                BEGIN IMMEDIATE;
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    target_app_id TEXT NOT NULL,
                    finding_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attempt INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS patch_proposals (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL REFERENCES jobs(id),
                    attempt INTEGER NOT NULL,
                    root_cause TEXT NOT NULL,
                    explanation TEXT NOT NULL,
                    patch_format TEXT NOT NULL,
                    patch_text TEXT NOT NULL,
                    files_changed_json TEXT NOT NULL,
                    patch_hash TEXT NOT NULL,
                    policy_status TEXT NOT NULL,
                    policy_details_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(job_id, attempt)
                );
                CREATE TABLE IF NOT EXISTS approvals (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL REFERENCES jobs(id),
                    patch_id TEXT NOT NULL REFERENCES patch_proposals(id),
                    patch_hash TEXT NOT NULL,
                    attempt INTEGER NOT NULL,
                    decision TEXT NOT NULL,
                    approved_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(patch_id)
                );
                CREATE TABLE IF NOT EXISTS verification_runs (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL REFERENCES jobs(id),
                    patch_id TEXT NOT NULL REFERENCES patch_proposals(id),
                    patch_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                );
                CREATE TABLE IF NOT EXISTS workflow_events (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL REFERENCES jobs(id),
                    event_type TEXT NOT NULL,
                    event_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_events_job ON workflow_events(job_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_runs_job ON verification_runs(job_id, created_at);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_patch ON verification_runs(patch_id);
                CREATE TRIGGER IF NOT EXISTS workflow_events_no_update
                    BEFORE UPDATE ON workflow_events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
                CREATE TRIGGER IF NOT EXISTS workflow_events_no_delete
                    BEFORE DELETE ON workflow_events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
                CREATE TABLE IF NOT EXISTS job_bindings (
                    job_id TEXT PRIMARY KEY REFERENCES jobs(id),
                    source_revision TEXT NOT NULL,
                    verification_profile TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS approval_bindings (
                    approval_id TEXT PRIMARY KEY REFERENCES approvals(id),
                    target_app_id TEXT NOT NULL,
                    source_revision TEXT NOT NULL,
                    identity_kind TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS verification_leases (
                    run_id TEXT PRIMARY KEY REFERENCES verification_runs(id),
                    owner TEXT NOT NULL,
                    token TEXT NOT NULL UNIQUE,
                    expires_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS run_attestations (
                    run_id TEXT PRIMARY KEY REFERENCES verification_runs(id),
                    attempt INTEGER NOT NULL,
                    source_revision TEXT NOT NULL,
                    verification_profile TEXT NOT NULL,
                    test_suite_id TEXT NOT NULL,
                    evidence_digest TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS job_comments (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL REFERENCES jobs(id),
                    author_id TEXT NOT NULL,
                    author_name TEXT NOT NULL,
                    author_role TEXT NOT NULL,
                    comment_text TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_comments_job ON job_comments(job_id, created_at);
            """)
            try:
                columns = {row["name"] for row in db.execute("PRAGMA table_info(approvals)")}
                if "attempt" not in columns:
                    db.execute("ALTER TABLE approvals ADD COLUMN attempt INTEGER")
                    db.execute("""UPDATE approvals SET attempt =
                                  (SELECT attempt FROM patch_proposals WHERE id = approvals.patch_id)""")
                job_columns = {row["name"] for row in db.execute("PRAGMA table_info(jobs)")}
                if "version" not in job_columns:
                    db.execute("ALTER TABLE jobs ADD COLUMN version INTEGER NOT NULL DEFAULT 0")
                if db.execute("PRAGMA foreign_keys").fetchone()[0] != 1:
                    raise RuntimeError("SQLite foreign keys are disabled")
                required = {"job_bindings", "approval_bindings", "verification_leases", "run_attestations"}
                found = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if not required <= found:
                    raise RuntimeError("critical database schema is incomplete")
                critical = {"idx_runs_patch", "workflow_events_no_update", "workflow_events_no_delete"}
                objects = {row[0] for row in db.execute("SELECT name FROM sqlite_master")}
                if not critical <= objects:
                    raise RuntimeError("critical database constraint is missing")
                if db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                    raise RuntimeError("database integrity check failed")
                if db.execute("PRAGMA foreign_key_check").fetchone():
                    raise RuntimeError("database foreign key integrity check failed")
                db.commit()
            except Exception:
                db.rollback()
                raise

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        db = self.connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    @contextmanager
    def read(self) -> Iterator[sqlite3.Connection]:
        db = self.connect()
        try:
            db.execute("BEGIN")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
