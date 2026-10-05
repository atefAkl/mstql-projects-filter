import Database from 'better-sqlite3';
import {
  TaxonomyDimension,
  TaxonomyTerm,
  SourceSkillMapping,
  ProjectSkill,
  ProjectClassification
} from '../../core/entities/Taxonomy';
import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';

export class SqliteTaxonomyRepository implements ITaxonomyRepository {
  constructor(private readonly db: Database.Database) {}

  public async getAllDimensions(): Promise<TaxonomyDimension[]> {
    const stmt = this.db.prepare(`
      SELECT id, code, name_ar, name_en
      FROM taxonomy_dimensions
      ORDER BY id ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map(r => new TaxonomyDimension({
      id: r.id,
      code: r.code,
      nameAr: r.name_ar,
      nameEn: r.name_en
    }));
  }

  public async getTermsByDimension(dimensionCode: string): Promise<TaxonomyTerm[]> {
    const stmt = this.db.prepare(`
      SELECT id, dimension_code, code, name_ar, name_en, parent_id
      FROM taxonomy_terms
      WHERE dimension_code = ?
      ORDER BY name_ar ASC
    `);
    const rows = stmt.all(dimensionCode) as any[];
    return rows.map(r => new TaxonomyTerm({
      id: r.id,
      dimensionCode: r.dimension_code,
      code: r.code,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      parentId: r.parent_id || undefined
    }));
  }

  public async getAllTerms(): Promise<TaxonomyTerm[]> {
    const stmt = this.db.prepare(`
      SELECT id, dimension_code, code, name_ar, name_en, parent_id
      FROM taxonomy_terms
      ORDER BY dimension_code, name_ar ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map(r => new TaxonomyTerm({
      id: r.id,
      dimensionCode: r.dimension_code,
      code: r.code,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      parentId: r.parent_id || undefined
    }));
  }

  public async getTermByCode(code: string): Promise<TaxonomyTerm | null> {
    const stmt = this.db.prepare(`
      SELECT id, dimension_code, code, name_ar, name_en, parent_id
      FROM taxonomy_terms
      WHERE code = ?
    `);
    const r = stmt.get(code) as any;
    if (!r) return null;
    return new TaxonomyTerm({
      id: r.id,
      dimensionCode: r.dimension_code,
      code: r.code,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      parentId: r.parent_id || undefined
    });
  }

  public async saveTerm(term: TaxonomyTerm): Promise<void> {
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

  public async getSkillMapping(sourceSkill: string): Promise<SourceSkillMapping | null> {
    const stmt = this.db.prepare(`
      SELECT id, source_skill, canonical_term_id, normalized_name
      FROM source_skill_mappings
      WHERE LOWER(source_skill) = LOWER(?)
    `);
    const r = stmt.get(sourceSkill) as any;
    if (!r) return null;
    return new SourceSkillMapping({
      id: r.id,
      sourceSkill: r.source_skill,
      canonicalTermId: r.canonical_term_id,
      normalizedName: r.normalized_name
    });
  }

  public async getAllSkillMappings(): Promise<SourceSkillMapping[]> {
    const stmt = this.db.prepare(`
      SELECT id, source_skill, canonical_term_id, normalized_name
      FROM source_skill_mappings
    `);
    const rows = stmt.all() as any[];
    return rows.map(r => new SourceSkillMapping({
      id: r.id,
      sourceSkill: r.source_skill,
      canonicalTermId: r.canonical_term_id,
      normalizedName: r.normalized_name
    }));
  }

  public async saveSkillMapping(mapping: SourceSkillMapping): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO source_skill_mappings (id, source_skill, canonical_term_id, normalized_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source_skill) DO UPDATE SET
        canonical_term_id = excluded.canonical_term_id,
        normalized_name = excluded.normalized_name
    `);
    stmt.run(mapping.id, mapping.sourceSkill.toLowerCase(), mapping.canonicalTermId, mapping.normalizedName);
  }

  public async saveProjectSkills(projectId: string, skills: { skillName: string; canonicalTermId?: string }[]): Promise<void> {
    if (!skills || skills.length === 0) return;

    this.db.prepare(`DELETE FROM project_skills WHERE project_id = ?`).run(projectId);

    const stmt = this.db.prepare(`
      INSERT INTO project_skills (id, project_id, skill_name, canonical_term_id)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      let idx = 0;
      for (const s of skills) {
        idx++;
        const id = `psk_${projectId}_${idx}`;
        stmt.run(id, projectId, s.skillName, s.canonicalTermId || null);
      }
    });

    transaction();
  }

  public async getProjectSkills(projectId: string): Promise<ProjectSkill[]> {
    const stmt = this.db.prepare(`
      SELECT id, project_id, skill_name, canonical_term_id
      FROM project_skills
      WHERE project_id = ?
    `);
    const rows = stmt.all(projectId) as any[];
    return rows.map(r => new ProjectSkill({
      id: r.id,
      projectId: r.project_id,
      skillName: r.skill_name,
      canonicalTermId: r.canonical_term_id || undefined
    }));
  }

  public async saveClassifications(classifications: ProjectClassification[]): Promise<void> {
    if (!classifications || classifications.length === 0) return;
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

  public async getProjectClassifications(projectId: string): Promise<ProjectClassification[]> {
    const stmt = this.db.prepare(`
      SELECT id, project_id, taxonomy_term_id, confidence_score, classified_by, classified_at
      FROM project_classifications
      WHERE project_id = ?
    `);
    const rows = stmt.all(projectId) as any[];
    return rows.map(r => new ProjectClassification({
      id: r.id,
      projectId: r.project_id,
      taxonomyTermId: r.taxonomy_term_id,
      confidenceScore: r.confidence_score,
      classifiedBy: r.classified_by,
      classifiedAt: new Date(r.classified_at)
    }));
  }

  public async getProjectTerms(projectId: string): Promise<TaxonomyTerm[]> {
    const stmt = this.db.prepare(`
      SELECT t.id, t.dimension_code, t.code, t.name_ar, t.name_en, t.parent_id
      FROM taxonomy_terms t
      INNER JOIN project_classifications c ON t.id = c.taxonomy_term_id
      WHERE c.project_id = ?
    `);
    const rows = stmt.all(projectId) as any[];
    return rows.map(r => new TaxonomyTerm({
      id: r.id,
      dimensionCode: r.dimension_code,
      code: r.code,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      parentId: r.parent_id || undefined
    }));
  }
}
