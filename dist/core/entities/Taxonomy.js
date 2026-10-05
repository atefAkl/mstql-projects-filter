"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectClassification = exports.ProjectSkill = exports.SourceSkillMapping = exports.TaxonomyTerm = exports.TaxonomyDimension = void 0;
class TaxonomyDimension {
    id;
    code;
    nameAr;
    nameEn;
    constructor(props) {
        this.id = props.id;
        this.code = props.code;
        this.nameAr = props.nameAr;
        this.nameEn = props.nameEn;
    }
}
exports.TaxonomyDimension = TaxonomyDimension;
class TaxonomyTerm {
    id;
    dimensionCode;
    code;
    nameAr;
    nameEn;
    parentId;
    constructor(props) {
        this.id = props.id;
        this.dimensionCode = props.dimensionCode;
        this.code = props.code;
        this.nameAr = props.nameAr;
        this.nameEn = props.nameEn;
        this.parentId = props.parentId;
    }
}
exports.TaxonomyTerm = TaxonomyTerm;
class SourceSkillMapping {
    id;
    sourceSkill;
    canonicalTermId;
    normalizedName;
    constructor(props) {
        this.id = props.id;
        this.sourceSkill = props.sourceSkill;
        this.canonicalTermId = props.canonicalTermId;
        this.normalizedName = props.normalizedName;
    }
}
exports.SourceSkillMapping = SourceSkillMapping;
class ProjectSkill {
    id;
    projectId;
    skillName;
    canonicalTermId;
    constructor(props) {
        this.id = props.id;
        this.projectId = props.projectId;
        this.skillName = props.skillName;
        this.canonicalTermId = props.canonicalTermId;
    }
}
exports.ProjectSkill = ProjectSkill;
class ProjectClassification {
    id;
    projectId;
    taxonomyTermId;
    confidenceScore;
    classifiedBy;
    classifiedAt;
    constructor(props) {
        this.id = props.id;
        this.projectId = props.projectId;
        this.taxonomyTermId = props.taxonomyTermId;
        this.confidenceScore = props.confidenceScore;
        this.classifiedBy = props.classifiedBy;
        this.classifiedAt = props.classifiedAt;
    }
}
exports.ProjectClassification = ProjectClassification;
//# sourceMappingURL=Taxonomy.js.map