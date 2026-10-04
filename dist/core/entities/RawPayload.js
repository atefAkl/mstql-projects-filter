"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawPayload = void 0;
class RawPayload {
    id;
    projectId;
    rawHtml;
    rawMetadata;
    createdAt;
    constructor(props) {
        this.id = props.id;
        this.projectId = props.projectId;
        this.rawHtml = props.rawHtml;
        this.rawMetadata = props.rawMetadata;
        this.createdAt = props.createdAt;
    }
}
exports.RawPayload = RawPayload;
//# sourceMappingURL=RawPayload.js.map