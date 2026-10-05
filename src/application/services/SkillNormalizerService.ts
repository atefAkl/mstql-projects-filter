import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
import { ProjectSkill } from '../../core/entities/Taxonomy';

export interface NormalizedSkillResult {
  rawSkill: string;
  normalizedName: string;
  canonicalTermId?: string;
  canonicalTermCode?: string;
}

export class SkillNormalizerService {
  constructor(private readonly taxonomyRepo: ITaxonomyRepository) {}

  public async normalizeSkills(skills: string[]): Promise<NormalizedSkillResult[]> {
    if (!skills || skills.length === 0) return [];

    const results: NormalizedSkillResult[] = [];
    const allMappings = await this.taxonomyRepo.getAllSkillMappings();
    const mappingDict = new Map<string, { termId: string; normName: string }>();
    for (const m of allMappings) {
      mappingDict.set(m.sourceSkill.toLowerCase(), { termId: m.canonicalTermId, normName: m.normalizedName });
    }

    const allTerms = await this.taxonomyRepo.getAllTerms();
    const termDictByCode = new Map<string, string>();
    for (const t of allTerms) {
      termDictByCode.set(t.id, t.code);
    }

    for (const raw of skills) {
      const cleaned = raw.trim();
      const lower = cleaned.toLowerCase();

      if (mappingDict.has(lower)) {
        const mapped = mappingDict.get(lower)!;
        results.push({
          rawSkill: cleaned,
          normalizedName: mapped.normName,
          canonicalTermId: mapped.termId,
          canonicalTermCode: termDictByCode.get(mapped.termId)
        });
      } else {
        // Simple capitalization fallback
        results.push({
          rawSkill: cleaned,
          normalizedName: cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
        });
      }
    }

    return results;
  }
}
