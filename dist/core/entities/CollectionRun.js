"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionRun = void 0;
class CollectionRun {
    id;
    type;
    status;
    startedAt;
    finishedAt;
    pagesProcessed;
    projectsFound;
    newProjectsCount;
    duplicateProjectsCount;
    observationsCreated;
    lastProcessedPage;
    lastProcessedProjectId;
    cutoffDate;
    errorCount;
    errorLog;
    constructor(props) {
        this.id = props.id;
        this.type = props.type;
        this.status = props.status;
        this.startedAt = props.startedAt;
        this.finishedAt = props.finishedAt;
        this.pagesProcessed = props.pagesProcessed;
        this.projectsFound = props.projectsFound;
        this.newProjectsCount = props.newProjectsCount;
        this.duplicateProjectsCount = props.duplicateProjectsCount;
        this.observationsCreated = props.observationsCreated || 0;
        this.lastProcessedPage = props.lastProcessedPage;
        this.lastProcessedProjectId = props.lastProcessedProjectId;
        this.cutoffDate = props.cutoffDate;
        this.errorCount = props.errorCount;
        this.errorLog = props.errorLog;
    }
    incrementPages() {
        this.pagesProcessed += 1;
    }
    setProgress(pageNumber, projectId) {
        this.lastProcessedPage = pageNumber;
        if (projectId) {
            this.lastProcessedProjectId = projectId;
        }
    }
    recordNewProject() {
        this.projectsFound += 1;
        this.newProjectsCount += 1;
        this.observationsCreated += 1;
    }
    recordDuplicateProject() {
        this.projectsFound += 1;
        this.duplicateProjectsCount += 1;
        this.observationsCreated += 1;
    }
    recordError(message) {
        this.errorCount += 1;
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] ${message}\n`;
        this.errorLog = this.errorLog ? this.errorLog + entry : entry;
    }
    markCompleted() {
        this.status = 'completed';
        this.finishedAt = new Date();
    }
    markInterrupted(reason) {
        this.status = 'interrupted';
        this.recordError(reason);
        this.finishedAt = new Date();
    }
    markFailed(errorReason) {
        this.status = 'failed';
        this.recordError(errorReason);
        this.finishedAt = new Date();
    }
}
exports.CollectionRun = CollectionRun;
//# sourceMappingURL=CollectionRun.js.map