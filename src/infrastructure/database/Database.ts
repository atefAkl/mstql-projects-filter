import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class AppDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'market_intelligence.db');
    
    // Ensure parent directory exists
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    // Enable WAL mode for high performance concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();
  }

  public getRawConnection(): Database.Database {
    return this.db;
  }

  public runMigrations(): void {
    const migrationSql = `
      CREATE TABLE IF NOT EXISTS collection_runs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        pages_processed INTEGER DEFAULT 0,
        projects_found INTEGER DEFAULT 0,
        new_projects_count INTEGER DEFAULT 0,
        duplicate_projects_count INTEGER DEFAULT 0,
        observations_created INTEGER DEFAULT 0,
        last_processed_page INTEGER,
        last_processed_project_id TEXT,
        cutoff_date TEXT,
        error_count INTEGER DEFAULT 0,
        error_log TEXT
      );

      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        source_client_id TEXT,
        name TEXT,
        profile_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        source_project_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        source_url TEXT NOT NULL,
        description_raw TEXT,
        published_at TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        status TEXT NOT NULL,
        client_id TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS project_observations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        bids_count INTEGER NOT NULL,
        budget_min_usd REAL,
        budget_max_usd REAL,
        budget_avg_usd REAL,
        status TEXT NOT NULL,
        collection_run_id TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (collection_run_id) REFERENCES collection_runs(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS raw_payloads (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        raw_html TEXT,
        raw_metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS taxonomy_terms (
        id TEXT PRIMARY KEY,
        dimension TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        parent_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS project_classifications (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        taxonomy_term_id TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        classified_by TEXT NOT NULL,
        classified_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (taxonomy_term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS classification_reviews (
        id TEXT PRIMARY KEY,
        classification_id TEXT NOT NULL,
        original_term_id TEXT NOT NULL,
        reviewed_term_id TEXT NOT NULL,
        reviewer_note TEXT,
        reviewed_at TEXT NOT NULL,
        FOREIGN KEY (classification_id) REFERENCES project_classifications(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_projects_source_id ON projects(source_project_id);
      CREATE INDEX IF NOT EXISTS idx_projects_published_at ON projects(published_at);
      CREATE INDEX IF NOT EXISTS idx_observations_project_id ON project_observations(project_id);
      CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON project_observations(observed_at);
      CREATE INDEX IF NOT EXISTS idx_collection_runs_status ON collection_runs(status);
    `;

    this.db.exec(migrationSql);
  }

  public close(): void {
    this.db.close();
  }
}
