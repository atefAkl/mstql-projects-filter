export type CollectionRunType = 'historical' | 'daily' | 'manual';
export type CollectionRunStatus = 'running' | 'completed' | 'failed' | 'interrupted';

export interface CollectionRunProps {
  id: string;
  type: CollectionRunType;
  status: CollectionRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  pagesProcessed: number;
  projectsFound: number;
  newProjectsCount: number;
  duplicateProjectsCount: number;
  observationsCreated: number;
  lastProcessedPage?: number;
  lastProcessedProjectId?: string;
  cutoffDate?: Date;
  errorCount: number;
  errorLog?: string;
}

export class CollectionRun {
  public readonly id: string;
  public readonly type: CollectionRunType;
  public status: CollectionRunStatus;
  public readonly startedAt: Date;
  public finishedAt?: Date;
  public pagesProcessed: number;
  public projectsFound: number;
  public newProjectsCount: number;
  public duplicateProjectsCount: number;
  public observationsCreated: number;
  public lastProcessedPage?: number;
  public lastProcessedProjectId?: string;
  public cutoffDate?: Date;
  public errorCount: number;
  public errorLog?: string;

  constructor(props: CollectionRunProps) {
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

  public incrementPages(): void {
    this.pagesProcessed += 1;
  }

  public setProgress(pageNumber: number, projectId?: string): void {
    this.lastProcessedPage = pageNumber;
    if (projectId) {
      this.lastProcessedProjectId = projectId;
    }
  }

  public recordNewProject(): void {
    this.projectsFound += 1;
    this.newProjectsCount += 1;
    this.observationsCreated += 1;
  }

  public recordDuplicateProject(): void {
    this.projectsFound += 1;
    this.duplicateProjectsCount += 1;
    this.observationsCreated += 1;
  }

  public recordError(message: string): void {
    this.errorCount += 1;
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    this.errorLog = this.errorLog ? this.errorLog + entry : entry;
  }

  public markCompleted(): void {
    this.status = 'completed';
    this.finishedAt = new Date();
  }

  public markInterrupted(reason: string): void {
    this.status = 'interrupted';
    this.recordError(reason);
    this.finishedAt = new Date();
  }

  public markFailed(errorReason: string): void {
    this.status = 'failed';
    this.recordError(errorReason);
    this.finishedAt = new Date();
  }
}
