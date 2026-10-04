"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectObservation = void 0;
class ProjectObservation {
    id;
    projectId;
    observedAt;
    bidsCount;
    budgetMinUsd;
    budgetMaxUsd;
    budgetAvgUsd;
    status;
    collectionRunId;
    constructor(props) {
        this.id = props.id;
        this.projectId = props.projectId;
        this.observedAt = props.observedAt;
        this.bidsCount = props.bidsCount;
        this.budgetMinUsd = props.budgetMinUsd;
        this.budgetMaxUsd = props.budgetMaxUsd;
        this.budgetAvgUsd = props.budgetAvgUsd;
        this.status = props.status;
        this.collectionRunId = props.collectionRunId;
    }
}
exports.ProjectObservation = ProjectObservation;
//# sourceMappingURL=ProjectObservation.js.map