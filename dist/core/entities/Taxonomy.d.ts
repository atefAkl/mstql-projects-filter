export interface TaxonomyDimensionProps {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
}
export declare class TaxonomyDimension {
    readonly id: string;
    readonly code: string;
    nameAr: string;
    nameEn: string;
    constructor(props: TaxonomyDimensionProps);
}
export interface TaxonomyTermProps {
    id: string;
    dimensionCode: string;
    code: string;
    nameAr: string;
    nameEn: string;
    parentId?: string;
}
export declare class TaxonomyTerm {
    readonly id: string;
    readonly dimensionCode: string;
    readonly code: string;
    nameAr: string;
    nameEn: string;
    parentId?: string;
    constructor(props: TaxonomyTermProps);
}
export interface SourceSkillMappingProps {
    id: string;
    sourceSkill: string;
    canonicalTermId: string;
    normalizedName: string;
}
export declare class SourceSkillMapping {
    readonly id: string;
    readonly sourceSkill: string;
    canonicalTermId: string;
    normalizedName: string;
    constructor(props: SourceSkillMappingProps);
}
export interface ProjectSkillProps {
    id: string;
    projectId: string;
    skillName: string;
    canonicalTermId?: string;
}
export declare class ProjectSkill {
    readonly id: string;
    readonly projectId: string;
    readonly skillName: string;
    canonicalTermId?: string;
    constructor(props: ProjectSkillProps);
}
export interface ProjectClassificationProps {
    id: string;
    projectId: string;
    taxonomyTermId: string;
    confidenceScore: number;
    classifiedBy: string;
    classifiedAt: Date;
}
export declare class ProjectClassification {
    readonly id: string;
    readonly projectId: string;
    readonly taxonomyTermId: string;
    confidenceScore: number;
    classifiedBy: string;
    classifiedAt: Date;
    constructor(props: ProjectClassificationProps);
}
