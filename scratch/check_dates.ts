import { AppDatabase } from '../src/infrastructure/database/Database';

const appDb = new AppDatabase();
const db = appDb.getRawConnection();

const rows = db.prepare(`
  SELECT source_project_id, title, published_at, first_seen_at
  FROM projects
  WHERE published_at IS NOT NULL
  ORDER BY published_at DESC
  LIMIT 10
`).all();

console.log('Sample DB published_at timestamps:', rows);
appDb.close();
