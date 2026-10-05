import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
export interface NormalizedSkillResult {
    rawSkill: string;
    normalizedName: string;
    canonicalTermId?: string;
    canonicalTermCode?: string;
}
export declare class SkillNormalizerService {
    private readonly taxonomyRepo;
    constructor(taxonomyRepo: ITaxonomyRepository);
    normalizeSkills(skills: string[]): Promise<NormalizedSkillResult[]>;
}
