import Database from 'better-sqlite3';
import { TaxonomyDimension, TaxonomyTerm, SourceSkillMapping, ProjectSkill, ProjectClassification } from '../../core/entities/Taxonomy';
import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
export declare class SqliteTaxonomyRepository implements ITaxonomyRepository {
    private readonly db;
    constructor(db: Database.Database);
    getAllDimensions(): Promise<TaxonomyDimension[]>;
    getTermsByDimension(dimensionCode: string): Promise<TaxonomyTerm[]>;
    getAllTerms(): Promise<TaxonomyTerm[]>;
    getTermByCode(code: string): Promise<TaxonomyTerm | null>;
    saveTerm(term: TaxonomyTerm): Promise<void>;
    getSkillMapping(sourceSkill: string): Promise<SourceSkillMapping | null>;
    getAllSkillMappings(): Promise<SourceSkillMapping[]>;
    saveSkillMapping(mapping: SourceSkillMapping): Promise<void>;
    saveProjectSkills(projectId: string, skills: {
        skillName: string;
        canonicalTermId?: string;
    }[]): Promise<void>;
    getProjectSkills(projectId: string): Promise<ProjectSkill[]>;
    saveClassifications(classifications: ProjectClassification[]): Promise<void>;
    getProjectClassifications(projectId: string): Promise<ProjectClassification[]>;
    getProjectTerms(projectId: string): Promise<TaxonomyTerm[]>;
}
