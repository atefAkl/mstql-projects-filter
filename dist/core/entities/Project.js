"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
class Project {
    id;
    sourceProjectId;
    title;
    sourceUrl;
    descriptionRaw;
    publishedAt;
    firstSeenAt;
    lastSeenAt;
    status;
    clientId;
    rawContentHash;
    normalizedContentHash;
    lastSourceSyncAt;
    lastSyncStatus;
    completenessStatus;
    constructor(props) {
        this.id = props.id;
        this.sourceProjectId = props.sourceProjectId;
        this.title = props.title;
        this.sourceUrl = props.sourceUrl;
        this.descriptionRaw = props.descriptionRaw;
        this.publishedAt = props.publishedAt;
        this.firstSeenAt = props.firstSeenAt;
        this.lastSeenAt = props.lastSeenAt;
        this.status = props.status;
        this.clientId = props.clientId;
        this.rawContentHash = props.rawContentHash;
        this.normalizedContentHash = props.normalizedContentHash;
        this.lastSourceSyncAt = props.lastSourceSyncAt;
        this.lastSyncStatus = props.lastSyncStatus;
        this.completenessStatus = props.completenessStatus || (props.descriptionRaw ? 'complete' : 'discovered');
    }
    updateLastSeen(timestamp = new Date()) {
        this.lastSeenAt = timestamp;
    }
    updateStatus(status) {
        this.status = status;
    }
    markCompleteness(status) {
        this.completenessStatus = status;
    }
    updateSyncDetails(rawHash, normHash, syncStatus = 'success', timestamp = new Date()) {
        if (rawHash)
            this.rawContentHash = rawHash;
        if (normHash)
            this.normalizedContentHash = normHash;
        this.lastSourceSyncAt = timestamp;
        this.lastSyncStatus = syncStatus;
        this.lastSeenAt = timestamp;
    }
}
exports.Project = Project;
//# sourceMappingURL=Project.js.map