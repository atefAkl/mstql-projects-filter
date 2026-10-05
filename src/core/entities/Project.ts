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
  rawContentHash?: string;
  normalizedContentHash?: string;
  lastSourceSyncAt?: Date;
  lastSyncStatus?: string;
  completenessStatus?: 'discovered' | 'pending_ingestion' | 'complete' | 'fetch_failed' | 'refresh_due';
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
  public rawContentHash?: string;
  public normalizedContentHash?: string;
  public lastSourceSyncAt?: Date;
  public lastSyncStatus?: string;
  public completenessStatus: 'discovered' | 'pending_ingestion' | 'complete' | 'fetch_failed' | 'refresh_due';

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
    this.rawContentHash = props.rawContentHash;
    this.normalizedContentHash = props.normalizedContentHash;
    this.lastSourceSyncAt = props.lastSourceSyncAt;
    this.lastSyncStatus = props.lastSyncStatus;
    this.completenessStatus = props.completenessStatus || (props.descriptionRaw ? 'complete' : 'discovered');
  }

  public updateLastSeen(timestamp: Date = new Date()): void {
    this.lastSeenAt = timestamp;
  }

  public updateStatus(status: string): void {
    this.status = status;
  }

  public markCompleteness(status: 'discovered' | 'pending_ingestion' | 'complete' | 'fetch_failed' | 'refresh_due'): void {
    this.completenessStatus = status;
  }

  public updateSyncDetails(rawHash?: string, normHash?: string, syncStatus: string = 'success', timestamp: Date = new Date()): void {
    if (rawHash) this.rawContentHash = rawHash;
    if (normHash) this.normalizedContentHash = normHash;
    this.lastSourceSyncAt = timestamp;
    this.lastSyncStatus = syncStatus;
    this.lastSeenAt = timestamp;
  }
}
