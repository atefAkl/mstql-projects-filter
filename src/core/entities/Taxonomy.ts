export interface TaxonomyDimensionProps {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

export class TaxonomyDimension {
  public readonly id: string;
  public readonly code: string;
  public nameAr: string;
  public nameEn: string;

  constructor(props: TaxonomyDimensionProps) {
    this.id = props.id;
    this.code = props.code;
    this.nameAr = props.nameAr;
    this.nameEn = props.nameEn;
  }
}

export interface TaxonomyTermProps {
  id: string;
  dimensionCode: string;
  code: string;
  nameAr: string;
  nameEn: string;
  parentId?: string;
}

export class TaxonomyTerm {
  public readonly id: string;
  public readonly dimensionCode: string;
  public readonly code: string;
  public nameAr: string;
  public nameEn: string;
  public parentId?: string;

  constructor(props: TaxonomyTermProps) {
    this.id = props.id;
    this.dimensionCode = props.dimensionCode;
    this.code = props.code;
    this.nameAr = props.nameAr;
    this.nameEn = props.nameEn;
    this.parentId = props.parentId;
  }
}

export interface SourceSkillMappingProps {
  id: string;
  sourceSkill: string;
  canonicalTermId: string;
  normalizedName: string;
}

export class SourceSkillMapping {
  public readonly id: string;
  public readonly sourceSkill: string;
  public canonicalTermId: string;
  public normalizedName: string;

  constructor(props: SourceSkillMappingProps) {
    this.id = props.id;
    this.sourceSkill = props.sourceSkill;
    this.canonicalTermId = props.canonicalTermId;
    this.normalizedName = props.normalizedName;
  }
}

export interface ProjectSkillProps {
  id: string;
  projectId: string;
  skillName: string;
  canonicalTermId?: string;
}

export class ProjectSkill {
  public readonly id: string;
  public readonly projectId: string;
  public readonly skillName: string;
  public canonicalTermId?: string;

  constructor(props: ProjectSkillProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.skillName = props.skillName;
    this.canonicalTermId = props.canonicalTermId;
  }
}

export interface ProjectClassificationProps {
  id: string;
  projectId: string;
  taxonomyTermId: string;
  confidenceScore: number;
  classifiedBy: string;
  classifiedAt: Date;
}

export class ProjectClassification {
  public readonly id: string;
  public readonly projectId: string;
  public readonly taxonomyTermId: string;
  public confidenceScore: number;
  public classifiedBy: string;
  public classifiedAt: Date;

  constructor(props: ProjectClassificationProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.taxonomyTermId = props.taxonomyTermId;
    this.confidenceScore = props.confidenceScore;
    this.classifiedBy = props.classifiedBy;
    this.classifiedAt = props.classifiedAt;
  }
}
