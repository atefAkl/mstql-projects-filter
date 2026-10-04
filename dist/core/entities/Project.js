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
    }
    updateLastSeen(timestamp = new Date()) {
        this.lastSeenAt = timestamp;
    }
    updateStatus(status) {
        this.status = status;
    }
}
exports.Project = Project;
//# sourceMappingURL=Project.js.map