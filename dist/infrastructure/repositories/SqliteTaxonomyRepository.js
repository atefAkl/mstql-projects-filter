"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteTaxonomyRepository = void 0;
const Taxonomy_1 = require("../../core/entities/Taxonomy");
class SqliteTaxonomyRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getAllDimensions() {
        const stmt = this.db.prepare(`
      SELECT id, code, name_ar, name_en
      FROM taxonomy_dimensions
      ORDER BY id ASC
    `);
        const rows = stmt.all();
        return rows.map(r => new Taxonomy_1.TaxonomyDimension({
            id: r.id,
            code: r.code,
            nameAr: r.name_ar,
            nameEn: r.name_en
        }));
    }
    async getTermsByDimension(dimensionCode) {
        const stmt = this.db.prepare(`
      SELECT id, dimension_code, code, name_ar, name_en, parent_id
      FROM taxonomy_terms
      WHERE dimension_code = ?
      ORDER BY name_ar ASC
    `);
        const rows = stmt.all(dimensionCode);
        return rows.map(r => new Taxonomy_1.TaxonomyTerm({
            id: r.id,
            dimensionCode: r.dimension_code,
            code: r.code,
            nameAr: r.name_ar,
            nameEn: r.name_en,
            parentId: r.parent_id || undefined
        }));
    }
    async getAllTerms() {
        const stmt = this.db.prepare(`
      SELECT id, dimension_code, code, name_ar, name_en, parent_id
      FROM taxonomy_terms
      ORDER BY dimension_code, name_ar ASC
    `);
        const rows = stmt.all();
        return rows.map(r => new Taxonomy_1.TaxonomyTerm({
            id: r.id,
            dimensionCode: r.dimension_code,
            code: r.code,
            nameAr: r.name_ar,
            nameEn: r.name_en,
            parentId: r.parent_id || undefined
        }));
    }
    async getTermByCode(code) {
        const stmt = this.db.prepare(`
      SELECT id, dimension_code, code, name_ar, name_en, parent_id
      FROM taxonomy_terms
      WHERE code = ?
    `);
        const r = stmt.get(code);
        if (!r)
            return null;
        return new Taxonomy_1.TaxonomyTerm({
            id: r.id,
            dimensionCode: r.dimension_code,
            code: r.code,
            nameAr: r.name_ar,
            nameEn: r.name_en,
            parentId: r.parent_id || undefined
        });
    }
    async saveTerm(term) {
        const stmt = this.db.prepare(`
      INSERT INTO taxonomy_terms (id, dimension_code, code, name_ar, name_en, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        name_ar = excluded.name_ar,
        name_en = excluded.name_en,
        parent_id = excluded.parent_id
    `);
        stmt.run(term.id, term.dimensionCode, term.code, term.nameAr, term.nameEn, term.parentId || null);
    }
    async getSkillMapping(sourceSkill) {
        const stmt = this.db.prepare(`
      SELECT id, source_skill, canonical_term_id, normalized_name
      FROM source_skill_mappings
      WHERE LOWER(source_skill) = LOWER(?)
    `);
        const r = stmt.get(sourceSkill);
        if (!r)
            return null;
        return new Taxonomy_1.SourceSkillMapping({
            id: r.id,
            sourceSkill: r.source_skill,
            canonicalTermId: r.canonical_term_id,
            normalizedName: r.normalized_name
        });
    }
    async getAllSkillMappings() {
        const stmt = this.db.prepare(`
      SELECT id, source_skill, canonical_term_id, normalized_name
      FROM source_skill_mappings
    `);
        const rows = stmt.all();
        return rows.map(r => new Taxonomy_1.SourceSkillMapping({
            id: r.id,
            sourceSkill: r.source_skill,
            canonicalTermId: r.canonical_term_id,
            normalizedName: r.normalized_name
        }));
    }
    async saveSkillMapping(mapping) {
        const stmt = this.db.prepare(`
      INSERT INTO source_skill_mappings (id, source_skill, canonical_term_id, normalized_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source_skill) DO UPDATE SET
        canonical_term_id = excluded.canonical_term_id,
        normalized_name = excluded.normalized_name
    `);
        stmt.run(mapping.id, mapping.sourceSkill.toLowerCase(), mapping.canonicalTermId, mapping.normalizedName);
    }
    async saveProjectSkills(projectId, skills) {
        const stmt = this.db.prepare(`
      INSERT INTO project_skills (id, project_id, skill_name, canonical_term_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, skill_name) DO UPDATE SET
        canonical_term_id = COALESCE(excluded.canonical_term_id, project_skills.canonical_term_id)
    `);
        const transaction = this.db.transaction(() => {
            for (const s of skills) {
                const id = `psk_${projectId.slice(0, 8)}_${Buffer.from(s.skillName).toString('hex').slice(0, 8)}`;
                stmt.run(id, projectId, s.skillName, s.canonicalTermId || null);
            }
        });
        transaction();
    }
    async getProjectSkills(projectId) {
        const stmt = this.db.prepare(`
      SELECT id, project_id, skill_name, canonical_term_id
      FROM project_skills
      WHERE project_id = ?
    `);
        const rows = stmt.all(projectId);
        return rows.map(r => new Taxonomy_1.ProjectSkill({
            id: r.id,
            projectId: r.project_id,
            skillName: r.skill_name,
            canonicalTermId: r.canonical_term_id || undefined
        }));
    }
    async saveClassifications(classifications) {
        if (!classifications || classifications.length === 0)
            return;
        const projectId = classifications[0].projectId;
        this.db.prepare(`DELETE FROM project_classifications WHERE project_id = ?`).run(projectId);
        const stmt = this.db.prepare(`
      INSERT INTO project_classifications (id, project_id, taxonomy_term_id, confidence_score, classified_by, classified_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const transaction = this.db.transaction(() => {
            for (const c of classifications) {
                stmt.run(c.id, c.projectId, c.taxonomyTermId, c.confidenceScore, c.classifiedBy, c.classifiedAt.toISOString());
            }
        });
        transaction();
    }
    async getProjectClassifications(projectId) {
        const stmt = this.db.prepare(`
      SELECT id, project_id, taxonomy_term_id, confidence_score, classified_by, classified_at
      FROM project_classifications
      WHERE project_id = ?
    `);
        const rows = stmt.all(projectId);
        return rows.map(r => new Taxonomy_1.ProjectClassification({
            id: r.id,
            projectId: r.project_id,
            taxonomyTermId: r.taxonomy_term_id,
            confidenceScore: r.confidence_score,
            classifiedBy: r.classified_by,
            classifiedAt: new Date(r.classified_at)
        }));
    }
    async getProjectTerms(projectId) {
        const stmt = this.db.prepare(`
      SELECT t.id, t.dimension_code, t.code, t.name_ar, t.name_en, t.parent_id
      FROM taxonomy_terms t
      INNER JOIN project_classifications c ON t.id = c.taxonomy_term_id
      WHERE c.project_id = ?
    `);
        const rows = stmt.all(projectId);
        return rows.map(r => new Taxonomy_1.TaxonomyTerm({
            id: r.id,
            dimensionCode: r.dimension_code,
            code: r.code,
            nameAr: r.name_ar,
            nameEn: r.name_en,
            parentId: r.parent_id || undefined
        }));
    }
}
exports.SqliteTaxonomyRepository = SqliteTaxonomyRepository;
//# sourceMappingURL=SqliteTaxonomyRepository.js.map