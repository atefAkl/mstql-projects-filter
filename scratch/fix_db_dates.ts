import { AppDatabase } from '../src/infrastructure/database/Database';
import { MostaqlParser } from '../src/infrastructure/collectors/MostaqlParser';

async function fixDbDates() {
  const appDb = new AppDatabase();
  const db = appDb.getRawConnection();

  console.log('=== FIXING DATABASE PUBLISHED_AT TIMESTAMPS ===');

  const rows = db.prepare(`
    SELECT p.id, p.source_project_id, p.published_at, rp.raw_html
    FROM projects p
    LEFT JOIN raw_payloads rp ON rp.project_id = p.id
  `).all() as any[];

  let fixedCount = 0;

  const updateStmt = db.prepare(`UPDATE projects SET published_at = ? WHERE id = ?`);

  const transaction = db.transaction(() => {
    for (const r of rows) {
      if (!r.raw_html) continue;

      const dtMatch = r.raw_html.match(/datetime=["']([^"']+)["']/);
      if (dtMatch) {
        const rawDateStr = dtMatch[1];
        const newDate = MostaqlParser.parseDateTime(rawDateStr);
        if (newDate) {
          const newIso = newDate.toISOString();
          if (newIso !== r.published_at) {
            updateStmt.run(newIso, r.id);
            fixedCount++;
          }
        }
      }
    }
  });

  transaction();

  console.log(`Successfully fixed ${fixedCount} project timestamps in SQLite database.`);

  const sample = db.prepare(`
    SELECT p.source_project_id, p.published_at, rp.raw_html
    FROM projects p
    LEFT JOIN raw_payloads rp ON rp.project_id = p.id
    ORDER BY p.published_at DESC
    LIMIT 5
  `).all() as any[];

  console.log('Sample updated projects:');
  for (const s of sample) {
    const dtMatch = s.raw_html ? s.raw_html.match(/datetime=["']([^"']+)["']/) : null;
    console.log({
      sourceProjectId: s.source_project_id,
      rawHtmlDatetime: dtMatch ? dtMatch[1] : 'N/A',
      storedIso: s.published_at,
      formattedRiyadh: new Intl.DateTimeFormat('ar-EG', { timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(new Date(s.published_at))
    });
  }

  appDb.close();
}

fixDbDates().catch(console.error);
