import { CollectionRun } from '../entities/CollectionRun';

export interface ICollectionRunRepository {
  findById(id: string): Promise<CollectionRun | null>;
  save(run: CollectionRun): Promise<void>;
  update(run: CollectionRun): Promise<void>;
  getLatestCompletedRun(): Promise<CollectionRun | null>;
  listRuns(limit?: number, offset?: number): Promise<CollectionRun[]>;
}
