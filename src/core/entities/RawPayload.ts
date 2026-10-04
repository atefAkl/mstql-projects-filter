export interface RawPayloadProps {
  id: string;
  projectId: string;
  rawHtml?: string;
  rawMetadata?: Record<string, unknown>;
  createdAt: Date;
}

export class RawPayload {
  public readonly id: string;
  public readonly projectId: string;
  public readonly rawHtml?: string;
  public readonly rawMetadata?: Record<string, unknown>;
  public readonly createdAt: Date;

  constructor(props: RawPayloadProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.rawHtml = props.rawHtml;
    this.rawMetadata = props.rawMetadata;
    this.createdAt = props.createdAt;
  }
}
