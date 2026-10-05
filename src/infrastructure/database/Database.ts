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
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();
    this.seedInitialTaxonomy();
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
        raw_content_hash TEXT,
        normalized_content_hash TEXT,
        last_source_sync_at TEXT,
        last_sync_status TEXT,
        completeness_status TEXT DEFAULT 'complete',
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

      -- Phase 4C Taxonomy & Classification Tables
      CREATE TABLE IF NOT EXISTS taxonomy_dimensions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS taxonomy_terms (
        id TEXT PRIMARY KEY,
        dimension_code TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        parent_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS source_skill_mappings (
        id TEXT PRIMARY KEY,
        source_skill TEXT NOT NULL UNIQUE,
        canonical_term_id TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        FOREIGN KEY (canonical_term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS project_skills (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        canonical_term_id TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (canonical_term_id) REFERENCES taxonomy_terms(id) ON DELETE SET NULL,
        UNIQUE(project_id, skill_name) ON CONFLICT REPLACE
      );

      CREATE TABLE IF NOT EXISTS project_classifications (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        taxonomy_term_id TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        classified_by TEXT NOT NULL,
        classified_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (taxonomy_term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
        UNIQUE(project_id, taxonomy_term_id) ON CONFLICT REPLACE
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
    `;

    this.db.exec(migrationSql);

    // Safely alter existing table if columns don't exist
    const projectPragma = this.db.prepare("PRAGMA table_info('projects')").all() as { name: string }[];
    const projectColumns = projectPragma.map(c => c.name);

    if (!projectColumns.includes('raw_content_hash')) {
      this.db.exec("ALTER TABLE projects ADD COLUMN raw_content_hash TEXT");
    }
    if (!projectColumns.includes('normalized_content_hash')) {
      this.db.exec("ALTER TABLE projects ADD COLUMN normalized_content_hash TEXT");
    }
    if (!projectColumns.includes('last_source_sync_at')) {
      this.db.exec("ALTER TABLE projects ADD COLUMN last_source_sync_at TEXT");
    }
    if (!projectColumns.includes('last_sync_status')) {
      this.db.exec("ALTER TABLE projects ADD COLUMN last_sync_status TEXT");
    }
    if (!projectColumns.includes('completeness_status')) {
      this.db.exec("ALTER TABLE projects ADD COLUMN completeness_status TEXT DEFAULT 'complete'");
    }

    // Safely check taxonomy_terms table columns
    const termPragma = this.db.prepare("PRAGMA table_info('taxonomy_terms')").all() as { name: string }[];
    const termColumns = termPragma.map(c => c.name);
    if (!termColumns.includes('dimension_code')) {
      if (termColumns.includes('dimension')) {
        this.db.exec("ALTER TABLE taxonomy_terms RENAME COLUMN dimension TO dimension_code");
      } else {
        this.db.exec("ALTER TABLE taxonomy_terms ADD COLUMN dimension_code TEXT");
      }
    }

    // Index creation
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_source_id ON projects(source_project_id);
      CREATE INDEX IF NOT EXISTS idx_projects_published_at ON projects(published_at);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_completeness ON projects(completeness_status);
      CREATE INDEX IF NOT EXISTS idx_observations_project_id ON project_observations(project_id);
      CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON project_observations(observed_at);
      CREATE INDEX IF NOT EXISTS idx_observations_bids_budget ON project_observations(project_id, bids_count, budget_avg_usd);
      CREATE INDEX IF NOT EXISTS idx_collection_runs_status ON collection_runs(status);
      CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_dim ON taxonomy_terms(dimension_code);
      CREATE INDEX IF NOT EXISTS idx_project_classifications_proj ON project_classifications(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_classifications_term ON project_classifications(taxonomy_term_id);
      CREATE INDEX IF NOT EXISTS idx_project_skills_proj ON project_skills(project_id);
    `);

    // Create FTS5 Virtual Table for Full-Text Search
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
          project_id UNINDEXED,
          title,
          description,
          skills,
          client_name,
          taxonomy_terms,
          tokenize='unicode61 remove_diacritics 2'
        );
      `);
    } catch (err) {
      console.warn('FTS5 virtual table warning:', err);
    }
  }

  public seedInitialTaxonomy(): void {
    const insertDim = this.db.prepare(`
      INSERT INTO taxonomy_dimensions (id, code, name_ar, name_en)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name_ar=excluded.name_ar, name_en=excluded.name_en
    `);

    const insertTerm = this.db.prepare(`
      INSERT INTO taxonomy_terms (id, dimension_code, code, name_ar, name_en, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name_ar=excluded.name_ar, name_en=excluded.name_en
    `);

    const insertSkillMap = this.db.prepare(`
      INSERT INTO source_skill_mappings (id, source_skill, canonical_term_id, normalized_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source_skill) DO UPDATE SET canonical_term_id=excluded.canonical_term_id, normalized_name=excluded.normalized_name
    `);

    this.db.transaction(() => {
      // 1. Dimensions
      const dimensions = [
        { id: 'dim_domain', code: 'domain', ar: 'المجال الرئيس', en: 'Domain' },
        { id: 'dim_service_type', code: 'service_type', ar: 'نوع الخدمة', en: 'Service Type' },
        { id: 'dim_project_type', code: 'project_type', ar: 'نوع المشروع', en: 'Project Type' },
        { id: 'dim_industry', code: 'industry', ar: 'القطاع التجارى', en: 'Industry' },
        { id: 'dim_work_type', code: 'work_type', ar: 'طبيعة العمل', en: 'Work Type' },
        { id: 'dim_technology', code: 'technology', ar: 'التقنية', en: 'Technology' },
        { id: 'dim_skill', code: 'skill', ar: 'المهارات', en: 'Skill' }
      ];

      for (const d of dimensions) {
        insertDim.run(d.id, d.code, d.ar, d.en);
      }

      // 2. Terms
      const terms = [
        // Domains
        { id: 'term_dom_software', dim: 'domain', code: 'software', ar: 'برمجيات وتطوير', en: 'Software & Web' },
        { id: 'term_dom_design', dim: 'domain', code: 'design', ar: 'تصميم ووسائط', en: 'Design & Media' },
        { id: 'term_dom_marketing', dim: 'domain', code: 'marketing', ar: 'تسويق ومبيعات', en: 'Marketing & Sales' },
        { id: 'term_dom_writing', dim: 'domain', code: 'writing', ar: 'كتابة وترجمة', en: 'Writing & Translation' },
        { id: 'term_dom_engineering', dim: 'domain', code: 'engineering', ar: 'هندسة وعمارة', en: 'Engineering & Architecture' },
        { id: 'term_dom_consulting', dim: 'domain', code: 'consulting', ar: 'أعمال واستشارات', en: 'Business & Consulting' },

        // Service Types
        { id: 'term_srv_development', dim: 'service_type', code: 'development', ar: 'تطوير وبرمجة', en: 'Development' },
        { id: 'term_srv_design', dim: 'service_type', code: 'design', ar: 'تصميم واجهات وتجربة', en: 'UI/UX Design' },
        { id: 'term_srv_maintenance', dim: 'service_type', code: 'maintenance', ar: 'صيانة ودعم فني', en: 'Maintenance & Support' },
        { id: 'term_srv_integration', dim: 'service_type', code: 'integration', ar: 'ربط وتكامل أنظمة', en: 'Integration' },
        { id: 'term_srv_consulting', dim: 'service_type', code: 'consulting', ar: 'استشارات تقنية', en: 'Consulting' },
        { id: 'term_srv_testing', dim: 'service_type', code: 'testing', ar: 'فحص واختبار الجودة', en: 'Testing & QA' },

        // Project Types
        { id: 'term_pt_web_app', dim: 'project_type', code: 'web_app', ar: 'تطبيق ويب', en: 'Web Application' },
        { id: 'term_pt_mobile_app', dim: 'project_type', code: 'mobile_app', ar: 'تطبيق جوال', en: 'Mobile Application' },
        { id: 'term_pt_ecommerce', dim: 'project_type', code: 'ecommerce', ar: 'متجر إلكتروني', en: 'E-commerce' },
        { id: 'term_pt_erp', dim: 'project_type', code: 'erp', ar: 'نظام ERP وتسيير إداري', en: 'ERP & Management' },
        { id: 'term_pt_crm', dim: 'project_type', code: 'crm', ar: 'نظام إدارة علاقات العملاء CRM', en: 'CRM System' },
        { id: 'term_pt_api', dim: 'project_type', code: 'api', ar: 'واجهة برمجية API', en: 'API Integration' },
        { id: 'term_pt_wordpress', dim: 'project_type', code: 'wordpress_site', ar: 'موقع ووردبريس', en: 'WordPress Site' },

        // Industries
        { id: 'term_ind_retail', dim: 'industry', code: 'retail', ar: 'تجزئة وتجارة إلكترونية', en: 'Retail & E-commerce' },
        { id: 'term_ind_healthcare', dim: 'industry', code: 'healthcare', ar: 'رعاية صحية وطبية', en: 'Healthcare' },
        { id: 'term_ind_education', dim: 'industry', code: 'education', ar: 'تعليم وتدريب', en: 'Education & EdTech' },
        { id: 'term_ind_realestate', dim: 'industry', code: 'real_estate', ar: 'عقارات وتطوير عقاري', en: 'Real Estate' },
        { id: 'term_ind_finance', dim: 'industry', code: 'finance', ar: 'مالية وتكنولوجيا مالية', en: 'Finance & Fintech' },
        { id: 'term_ind_logistics', dim: 'industry', code: 'logistics', ar: 'لوجستيات وتوصيل', en: 'Logistics' },

        // Work Types
        { id: 'term_wt_new_dev', dim: 'work_type', code: 'new_dev', ar: 'تطوير جديد من الصفر', en: 'New Development' },
        { id: 'term_wt_modification', dim: 'work_type', code: 'modification', ar: 'تعديل وتطوير ميزات', en: 'Feature Addition / Modification' },
        { id: 'term_wt_bug_fix', dim: 'work_type', code: 'bug_fix', ar: 'إصلاح أعطال ومشكلات', en: 'Bug Fix' },
        { id: 'term_wt_migration', dim: 'work_type', code: 'migration', ar: 'نقل وتحويل بيانات/نظام', en: 'System Migration' },

        // Technologies
        { id: 'term_tech_laravel', dim: 'technology', code: 'laravel', ar: 'لارافيل (Laravel)', en: 'Laravel' },
        { id: 'term_tech_react', dim: 'technology', code: 'react', ar: 'رياكت (React)', en: 'React' },
        { id: 'term_tech_vue', dim: 'technology', code: 'vue', ar: 'فيو جي اس (Vue.js)', en: 'Vue.js' },
        { id: 'term_tech_nodejs', dim: 'technology', code: 'nodejs', ar: 'نود جي اس (Node.js)', en: 'Node.js' },
        { id: 'term_tech_python', dim: 'technology', code: 'python', ar: 'بايثون (Python)', en: 'Python' },
        { id: 'term_tech_php', dim: 'technology', code: 'php', ar: 'بي اتش بي (PHP)', en: 'PHP' },
        { id: 'term_tech_flutter', dim: 'technology', code: 'flutter', ar: 'فلاتر (Flutter)', en: 'Flutter' },
        { id: 'term_tech_wordpress', dim: 'technology', code: 'wordpress', ar: 'ووردبريس (WordPress)', en: 'WordPress' },
        { id: 'term_tech_docker', dim: 'technology', code: 'docker', ar: 'دوكر (Docker)', en: 'Docker' },
        { id: 'term_tech_mysql', dim: 'technology', code: 'mysql', ar: 'ماي اس كيو ال (MySQL)', en: 'MySQL' },
        { id: 'term_tech_postgresql', dim: 'technology', code: 'postgresql', ar: 'بوستجري اس كيو ال (PostgreSQL)', en: 'PostgreSQL' }
      ];

      for (const t of terms) {
        insertTerm.run(t.id, t.dim, t.code, t.ar, t.en, null);
      }

      // 3. Source Skill Mappings
      const mappings = [
        { id: 'map_laravel_1', skill: 'laravel', termId: 'term_tech_laravel', name: 'Laravel' },
        { id: 'map_laravel_2', skill: 'لارافيل', termId: 'term_tech_laravel', name: 'Laravel' },
        { id: 'map_laravel_3', skill: 'laravel framework', termId: 'term_tech_laravel', name: 'Laravel' },
        { id: 'map_react_1', skill: 'react', termId: 'term_tech_react', name: 'React' },
        { id: 'map_react_2', skill: 'react.js', termId: 'term_tech_react', name: 'React' },
        { id: 'map_react_3', skill: 'reactjs', termId: 'term_tech_react', name: 'React' },
        { id: 'map_react_4', skill: 'رياكت', termId: 'term_tech_react', name: 'React' },
        { id: 'map_vue_1', skill: 'vue', termId: 'term_tech_vue', name: 'Vue.js' },
        { id: 'map_vue_2', skill: 'vue.js', termId: 'term_tech_vue', name: 'Vue.js' },
        { id: 'map_vue_3', skill: 'vuejs', termId: 'term_tech_vue', name: 'Vue.js' },
        { id: 'map_vue_4', skill: 'فيو جي اس', termId: 'term_tech_vue', name: 'Vue.js' },
        { id: 'map_node_1', skill: 'node.js', termId: 'term_tech_nodejs', name: 'Node.js' },
        { id: 'map_node_2', skill: 'nodejs', termId: 'term_tech_nodejs', name: 'Node.js' },
        { id: 'map_node_3', skill: 'نود جي اس', termId: 'term_tech_nodejs', name: 'Node.js' },
        { id: 'map_python_1', skill: 'python', termId: 'term_tech_python', name: 'Python' },
        { id: 'map_python_2', skill: 'بايثون', termId: 'term_tech_python', name: 'Python' },
        { id: 'map_php_1', skill: 'php', termId: 'term_tech_php', name: 'PHP' },
        { id: 'map_php_2', skill: 'بي اتش بي', termId: 'term_tech_php', name: 'PHP' },
        { id: 'map_flutter_1', skill: 'flutter', termId: 'term_tech_flutter', name: 'Flutter' },
        { id: 'map_flutter_2', skill: 'فلاتر', termId: 'term_tech_flutter', name: 'Flutter' },
        { id: 'map_wp_1', skill: 'wordpress', termId: 'term_tech_wordpress', name: 'WordPress' },
        { id: 'map_wp_2', skill: 'ووردبريس', termId: 'term_tech_wordpress', name: 'WordPress' },
        { id: 'map_wp_3', skill: 'وردبريس', termId: 'term_tech_wordpress', name: 'WordPress' },
        { id: 'map_mysql_1', skill: 'mysql', termId: 'term_tech_mysql', name: 'MySQL' },
        { id: 'map_mysql_2', skill: 'ماي اس كيو ال', termId: 'term_tech_mysql', name: 'MySQL' },
        { id: 'map_pg_1', skill: 'postgresql', termId: 'term_tech_postgresql', name: 'PostgreSQL' },
        { id: 'map_pg_2', skill: 'بوستجري اس كيو ال', termId: 'term_tech_postgresql', name: 'PostgreSQL' }
      ];

      for (const m of mappings) {
        insertSkillMap.run(m.id, m.skill.toLowerCase(), m.termId, m.name);
      }
    })();
  }

  public close(): void {
    this.db.close();
  }
}
