# Phase 4C Assessment: Expanded Taxonomy, Search & Advanced Filtering

## 1. Current Data Inventory
After reviewing the existing SQLite database (`data/market_intelligence.db`) and entity structures:

- **`projects` Table:**
  - `id`, `source_project_id`, `title`, `source_url`, `description_raw`
  - `published_at`, `first_seen_at`, `last_seen_at`, `status`, `client_id`
  - `raw_content_hash`, `normalized_content_hash`, `last_source_sync_at`, `last_sync_status`, `completeness_status`

- **`project_observations` Table:**
  - `id`, `project_id`, `observed_at`, `bids_count`, `budget_min_usd`, `budget_max_usd`, `budget_avg_usd`, `status`, `collection_run_id`

- **`clients` Table:**
  - `id`, `source_client_id`, `name`, `profile_url`, `created_at`

- **`raw_payloads` Table:**
  - `id`, `project_id`, `raw_html`, `raw_metadata` (contains parsed JSON with `skillsTagsRaw`, `executionDaysParsed`, `clientProfileUrl`, `budgetMinUsd`, etc.)

---

## 2. Proposed Taxonomy Dimensions

We establish a multi-dimensional, flexible taxonomy model where projects can be tagged across independent axes:

1. **`domain`** (المدال الرئيسي): e.g. Software, Design, Marketing, Writing & Translation, Engineering, Business & Consulting.
2. **`service_type`** (نوع الخدمة): e.g. Development, Design, Maintenance & Support, Integration, Consulting, Optimization, Testing.
3. **`project_type`** (نوع المشروع): e.g. Web Application, Mobile App, E-commerce, ERP, CRM, API Integration, Desktop App, Landing Page.
4. **`industry`** (القطاع / المجال التجاري): e.g. Retail & E-commerce, Healthcare, Education, Real Estate, Finance & Fintech, Logistics.
5. **`work_type`** (طبيعة العمل): e.g. New Development, Customization / Feature Addition, Bug Fix, Code Refactoring / Optimization, Migration.
6. **`technology`** (التقنية المستعملة): e.g. Laravel, React, Node.js, Python, Flutter, Vue.js, PHP, WordPress, Docker, MySQL, PostgreSQL.
7. **`skill`** (المهارات الفرعية): e.g. REST API, HTML/CSS, UI/UX Design, Git, Web Scraping, Database Design.

---

## 3. Initial Taxonomy Terms & Normalization Rules

### Skill Normalization Mapping Examples:
- `"Laravel"`, `"Laravel Framework"`, `"لارافيل"` $\rightarrow$ Canonical Term: `Laravel` (Code: `tech_laravel`)
- `"React"`, `"React.js"`, `"رياكت"` $\rightarrow$ Canonical Term: `React` (Code: `tech_react`)
- `"Vue"`, `"Vue.js"`, `"فيو جي اس"` $\rightarrow$ Canonical Term: `Vue.js` (Code: `tech_vue`)
- `"Node.js"`, `"Nodejs"`, `"نود جي اس"` $\rightarrow$ Canonical Term: `Node.js` (Code: `tech_nodejs`)
- `"WordPress"`, `"ووردبريس"`, `"وردبريس"` $\rightarrow$ Canonical Term: `WordPress` (Code: `tech_wordpress`)
- `"Python"`, `"بايثون"` $\rightarrow$ Canonical Term: `Python` (Code: `tech_python`)
- `"Flutter"`, `"فلاتر"` $\rightarrow$ Canonical Term: `Flutter` (Code: `tech_flutter`)

### Rule-Based Keyword Classification Rules:
- Title / Description contains `"متجر"`, `"E-commerce"`, `"تطبيق متجر"`, `"WooCommerce"` $\rightarrow$ `project_type` = `E-commerce`
- Title / Description contains `"ERP"`, `"نظام ادارة"`, `"إدارة شركة"` $\rightarrow$ `project_type` = `ERP`
- Title / Description contains `"تعديل"`, `"إصلاح"`, `"bug"`, `"مشكلة"` $\rightarrow$ `work_type` = `Bug Fix / Modification`
- Title / Description contains `"تطبيق جوال"`, `"تطبيق هاتف"`, `"Mobile App"` $\rightarrow$ `project_type` = `Mobile Application`

---

## 4. Search Model (SQLite FTS5)

We utilize SQLite's Virtual Table mechanism (`FTS5` or standard FTS fallback) for high-performance, full-text searching in Arabic & English across:
- Project Title (`title`)
- Description (`description_raw`)
- Raw & Normalized Skills (`skills`)
- Client Name (`client_name`)
- Canonical Taxonomy Terms (`taxonomy_terms`)

Query format: `SELECT project_id FROM projects_fts WHERE projects_fts MATCH ?` with snippet & rank support.

---

## 5. Filter Engine (`ProjectSearchCriteria`)

A unified criteria structure decouples controllers from database queries:

```typescript
export interface ProjectSearchCriteria {
  query?: string;
  publishedFrom?: Date;
  publishedTo?: Date;
  datePreset?: 'today' | 'last_3_days' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month';
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: 'any' | 'assigned' | 'unassigned';
  bidsFrom?: number;
  bidsTo?: number;
  bidsPreset?: '0' | '1-5' | '6-10' | '11-20' | '21-50' | '50+';
  status?: string;
  executionDaysMin?: number;
  executionDaysMax?: number;
  skills?: string[];
  skillsMatchMode?: 'any' | 'all';
  domain?: string;
  serviceType?: string;
  projectType?: string;
  industry?: string;
  workType?: string;
  clientId?: string;
  clientName?: string;
  competitionLevel?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  completenessStatus?: string;
  sortBy?: 'published_at' | 'budget' | 'bids_count' | 'updated_at' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

---

## 6. Required Database Schema & Indexes

1. **`taxonomy_dimensions`**: Defines dimensions (`domain`, `service_type`, `project_type`, `industry`, `work_type`, `technology`, `skill`).
2. **`taxonomy_terms`**: Defines terms within dimensions (`tech_laravel`, `type_ecommerce`, etc.).
3. **`source_skill_mappings`**: Maps raw skill strings (Arabic/English variations) to canonical taxonomy terms.
4. **`project_skills`**: Stores raw project skills linked to canonical terms.
5. **`project_classifications`**: Relates projects to taxonomy terms with `confidence_score` and `classified_by = 'rule_engine' | 'source_skill'`.
6. **`projects_fts`**: FTS5 table indexing projects for fast search.
7. **Indexes**:
   - `idx_projects_published_status` on `projects(published_at, status)`
   - `idx_observations_project_bids_budget` on `project_observations(project_id, bids_count, budget_avg_usd)`
   - `idx_project_classifications_lookup` on `project_classifications(project_id, taxonomy_term_id)`
   - `idx_taxonomy_terms_dimension` on `taxonomy_terms(dimension_code, code)`

---

## 7. API & UI Enhancements

- **REST API (`GET /api/projects`):** Supports all query filters, returns paginated results, count, and active filter state.
- **REST API (`GET /api/taxonomy`):** Delivers dynamic list of dimensions, canonical terms, and counts for UI filters.
- **UI Search & Filter Bar:**
  - Quick filters: Search keyword, Date Presets, Budget Range, Bids Count Presets, Technology Multi-select.
  - Advanced filters drawer: Domain, Service Type, Project Type, Industry, Work Type, Execution Time, Client.
  - Match Any / Match All toggle for skills.
  - Live result counter (e.g., "1,248 مشاريع").
  - URL synchronization (`/projects?skills=laravel,react&skillsMatchMode=all`).

---

## 8. Testing & Validation Plan

- **FTS Search Tests:** Verify title, description, Arabic, English text matching.
- **Multi-Filter Combination Tests:** Combined Technology (Match Any/All) + Budget + Bids + Taxonomy terms.
- **Local-Only Guard Test:** Assert that 0 HTTP requests are initiated during search/filter operations.
- **Observation Deduplication Safety:** Ensure multiple observations do not produce duplicate project rows in query results.
