"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillNormalizerService = void 0;
class SkillNormalizerService {
    taxonomyRepo;
    constructor(taxonomyRepo) {
        this.taxonomyRepo = taxonomyRepo;
    }
    async normalizeSkills(skills) {
        if (!skills || skills.length === 0)
            return [];
        const results = [];
        const allMappings = await this.taxonomyRepo.getAllSkillMappings();
        const mappingDict = new Map();
        for (const m of allMappings) {
            mappingDict.set(m.sourceSkill.toLowerCase(), { termId: m.canonicalTermId, normName: m.normalizedName });
        }
        const allTerms = await this.taxonomyRepo.getAllTerms();
        const termDictByCode = new Map();
        for (const t of allTerms) {
            termDictByCode.set(t.id, t.code);
        }
        for (const raw of skills) {
            const cleaned = raw.trim();
            const lower = cleaned.toLowerCase();
            if (mappingDict.has(lower)) {
                const mapped = mappingDict.get(lower);
                results.push({
                    rawSkill: cleaned,
                    normalizedName: mapped.normName,
                    canonicalTermId: mapped.termId,
                    canonicalTermCode: termDictByCode.get(mapped.termId)
                });
            }
            else {
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
exports.SkillNormalizerService = SkillNormalizerService;
//# sourceMappingURL=SkillNormalizerService.js.map