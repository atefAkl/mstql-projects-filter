import { AppDatabase } from './infrastructure/database/Database';
import { SqliteProjectRepository } from './infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from './infrastructure/repositories/SqliteCollectionRunRepository';

export class MostaqlMonitorPlatform {
  private db: AppDatabase;
  public projectRepository: SqliteProjectRepository;
  public collectionRunRepository: SqliteCollectionRunRepository;

  constructor(dbPath?: string) {
    this.db = new AppDatabase(dbPath);
    const rawDb = this.db.getRawConnection();
    this.projectRepository = new SqliteProjectRepository(rawDb);
    this.collectionRunRepository = new SqliteCollectionRunRepository(rawDb);
  }

  public close(): void {
    this.db.close();
  }
}

if (require.main === module) {
  console.log('Mostaql Market Intelligence Platform Core Initialized.');
  const platform = new MostaqlMonitorPlatform();
  console.log('Database initialized successfully.');
  platform.close();
}
