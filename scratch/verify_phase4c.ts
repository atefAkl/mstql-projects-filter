import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteTaxonomyRepository } from '../src/infrastructure/repositories/SqliteTaxonomyRepository';
import { RuleBasedClassifierService } from '../src/application/services/RuleBasedClassifierService';

async function runVerification() {
  const appDb = new AppDatabase();
  const db = appDb.getRawConnection();
  
  // Re-seed taxonomy
  appDb.seedInitialTaxonomy();

  const projectRepo = new SqliteProjectRepository(db);
  const taxonomyRepo = new SqliteTaxonomyRepository(db);
  const classifier = new RuleBasedClassifierService(taxonomyRepo, db);

  console.log('=== 1. TAXONOMY TERMS REGISTRY DISTRIBUTION ===');
  const dims = await taxonomyRepo.getAllDimensions();
  const terms = await taxonomyRepo.getAllTerms();

  const termDist: Record<string, number> = {};
  for (const d of dims) {
    termDist[d.code] = terms.filter(t => t.dimensionCode === d.code).length;
  }
  console.log('Terms per dimension in Registry:', JSON.stringify(termDist, null, 2));
  console.log('Total Registry Terms:', terms.length);

  console.log('\n=== RE-RUNNING CLASSIFIER PASS OVER EXISTING DB PROJECTS ===');
  db.prepare(`DELETE FROM project_classifications`).run();
  db.prepare(`DELETE FROM project_skills`).run();

  const allProjects = await projectRepo.findProjects({ limit: 5000 });
  console.log(`Total projects in DB: ${allProjects.length}`);

  for (const p of allProjects) {
    const rawPayload = await projectRepo.getLatestRawPayloadByProjectId(p.id);
    const meta = (rawPayload?.rawMetadata as any) || {};
    const skills = meta.skillsTagsRaw || [];
    const clientName = meta.clientNameRaw || '';
    await classifier.classifyProject(p, skills, clientName);
  }

  console.log('\n=== 2. CLASSIFICATION COVERAGE & UNCLASSIFIED BY DIMENSION ===');
  const totalProjects = allProjects.length;

  const dimCoverage: Record<string, { classified: number; unclassified: number }> = {};
  const dimCodes = ['domain', 'service_type', 'project_type', 'industry', 'work_type', 'technology', 'skill'];

  for (const code of dimCodes) {
    const res = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as cnt
      FROM projects p
      INNER JOIN project_classifications pc ON pc.project_id = p.id
      INNER JOIN taxonomy_terms tt ON tt.id = pc.taxonomy_term_id
      WHERE tt.dimension_code = ?
    `).get(code) as { cnt: number };

    dimCoverage[code] = {
      classified: res.cnt,
      unclassified: totalProjects - res.cnt
    };
  }

  const overallUnclassified = db.prepare(`
    SELECT COUNT(*) as unclassified FROM projects p
    WHERE NOT EXISTS (SELECT 1 FROM project_classifications pc WHERE pc.project_id = p.id)
  `).get() as { unclassified: number };

  console.log('Dimension Coverage breakdown:', JSON.stringify({
    totalProjects,
    overallUnclassified: overallUnclassified.unclassified,
    dimensions: dimCoverage
  }, null, 2));

  console.log('\n=== 3. FIXED FALSE POSITIVE TARGET PROJECTS CHECK ===');
  const targetIds = ['1283115', '1282870', '1224639'];
  for (const tid of targetIds) {
    const p = await projectRepo.findBySourceProjectId(tid);
    if (p) {
      const pTerms = await taxonomyRepo.getProjectTerms(p.id);
      console.log(`Project ${tid} ("${p.title}"):`, {
        termsCount: pTerms.length,
        assignedTerms: pTerms.map(t => `${t.dimensionCode}:${t.code} (${t.nameAr})`)
      });
    }
  }

  console.log('\n=== 4. 15 DIVERSE REAL PROJECTS SAMPLE ===');
  const sampleProjects = allProjects.slice(0, 15);
  for (const p of sampleProjects) {
    const projectTerms = await taxonomyRepo.getProjectTerms(p.id);
    const getDim = (dimCode: string) => projectTerms.filter(t => t.dimensionCode === dimCode).map(t => `${t.nameAr} (${t.code})`).join(', ') || 'N/A';
    const clsList = await taxonomyRepo.getProjectClassifications(p.id);
    const evidenceStr = clsList.map(c => `${c.taxonomyTermId}:${c.classifiedBy}`).join(', ') || 'None';

    console.log({
      id: p.sourceProjectId,
      title: p.title.trim().slice(0, 55),
      domain: getDim('domain'),
      serviceType: getDim('service_type'),
      projectType: getDim('project_type'),
      industry: getDim('industry'),
      workType: getDim('work_type'),
      technologies: getDim('technology'),
      evidence: evidenceStr
    });
  }

  appDb.close();
}

runVerification().catch(console.error);
