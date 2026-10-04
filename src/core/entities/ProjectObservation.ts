export interface ProjectObservationProps {
  id: string;
  projectId: string;
  observedAt: Date;
  bidsCount: number;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  budgetAvgUsd?: number;
  status: string;
  collectionRunId?: string;
}

export class ProjectObservation {
  public readonly id: string;
  public readonly projectId: string;
  public readonly observedAt: Date;
  public readonly bidsCount: number;
  public readonly budgetMinUsd?: number;
  public readonly budgetMaxUsd?: number;
  public readonly budgetAvgUsd?: number;
  public readonly status: string;
  public readonly collectionRunId?: string;

  constructor(props: ProjectObservationProps) {
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
