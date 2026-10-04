export interface ProjectProps {
  id: string;
  sourceProjectId: string;
  title: string;
  sourceUrl: string;
  descriptionRaw?: string;
  publishedAt?: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  status: string;
  clientId?: string;
}

export class Project {
  public readonly id: string;
  public readonly sourceProjectId: string;
  public title: string;
  public sourceUrl: string;
  public descriptionRaw?: string;
  public publishedAt?: Date;
  public readonly firstSeenAt: Date;
  public lastSeenAt: Date;
  public status: string;
  public clientId?: string;

  constructor(props: ProjectProps) {
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

  public updateLastSeen(timestamp: Date = new Date()): void {
    this.lastSeenAt = timestamp;
  }

  public updateStatus(status: string): void {
    this.status = status;
  }
}
