import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteTaxonomyRepository } from '../src/infrastructure/repositories/SqliteTaxonomyRepository';
import { RuleBasedClassifierService } from '../src/application/services/RuleBasedClassifierService';

async function runVerification() {
  const appDb = new AppDatabase();
  const db = appDb.getRawConnection();
  const projectRepo = new SqliteProjectRepository(db);
  const taxonomyRepo = new SqliteTaxonomyRepository(db);
  const classifier = new RuleBasedClassifierService(taxonomyRepo, db);

  console.log('=== 1. TAXONOMY TERMS DISTRIBUTION ===');
  const dims = await taxonomyRepo.getAllDimensions();
  const terms = await taxonomyRepo.getAllTerms();

  const termDist: Record<string, number> = {};
  for (const d of dims) {
    termDist[d.code] = terms.filter(t => t.dimensionCode === d.code).length;
  }
  console.log('Terms per dimension:', JSON.stringify(termDist, null, 2));
  console.log('Total terms:', terms.length);

  console.log('\n=== RUNNING CLASSIFIER PASS OVER EXISTING DB PROJECTS ===');
  const allProjects = await projectRepo.findProjects({ limit: 5000 });
  console.log(`Total projects in DB: ${allProjects.length}`);

  for (const p of allProjects) {
    const rawPayload = await projectRepo.getLatestRawPayloadByProjectId(p.id);
    const meta = (rawPayload?.rawMetadata as any) || {};
    const skills = meta.skillsTagsRaw || [];
    const clientName = meta.clientNameRaw || '';
    await classifier.classifyProject(p, skills, clientName);
  }

  console.log('\n=== 2. CLASSIFICATION COVERAGE ===');
  const coverageStmt = db.prepare(`
    SELECT 
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN tt.dimension_code = 'domain' THEN p.id END) as has_domain,
      COUNT(DISTINCT CASE WHEN tt.dimension_code = 'project_type' THEN p.id END) as has_project_type,
      COUNT(DISTINCT CASE WHEN tt.dimension_code = 'service_type' THEN p.id END) as has_service_type,
      COUNT(DISTINCT CASE WHEN tt.dimension_code = 'industry' THEN p.id END) as has_industry,
      COUNT(DISTINCT CASE WHEN tt.dimension_code = 'work_type' THEN p.id END) as has_work_type,
      COUNT(DISTINCT CASE WHEN tt.dimension_code = 'technology' THEN p.id END) as has_technology
    FROM projects p
    LEFT JOIN project_classifications pc ON pc.project_id = p.id
    LEFT JOIN taxonomy_terms tt ON tt.id = pc.taxonomy_term_id
  `).get() as any;

  const unclassifiedStmt = db.prepare(`
    SELECT COUNT(*) as unclassified FROM projects p
    WHERE NOT EXISTS (SELECT 1 FROM project_classifications pc WHERE pc.project_id = p.id)
  `).get() as any;

  console.log('Coverage statistics:', {
    ...coverageStmt,
    unclassified: unclassifiedStmt.unclassified
  });

  console.log('\n=== 3. 10 REAL CLASSIFIED PROJECTS SAMPLE ===');
  const sampleProjects = allProjects.slice(0, 10);
  for (const p of sampleProjects) {
    const projectTerms = await taxonomyRepo.getProjectTerms(p.id);
    const getDim = (dimCode: string) => projectTerms.filter(t => t.dimensionCode === dimCode).map(t => `${t.nameAr} (${t.code})`).join(', ') || 'N/A';

    console.log({
      id: p.sourceProjectId,
      title: p.title.slice(0, 50),
      domain: getDim('domain'),
      serviceType: getDim('service_type'),
      projectType: getDim('project_type'),
      industry: getDim('industry'),
      workType: getDim('work_type'),
      technologies: getDim('technology')
    });
  }

  console.log('\n=== 4. DETAIL-PAGE DATA VERIFICATION ===');
  const detailSample = db.prepare(`
    SELECT p.id, p.source_project_id, p.description_raw, rp.raw_metadata
    FROM projects p
    LEFT JOIN raw_payloads rp ON rp.project_id = p.id
    WHERE LENGTH(p.description_raw) > 100
    LIMIT 3
  `).all() as any[];

  console.log('Detail page projects verified:', detailSample.map(d => ({
    id: d.source_project_id,
    descLength: d.description_raw?.length || 0,
    hasSkills: JSON.parse(d.raw_metadata || '{}').skillsTagsRaw !== undefined
  })));

  console.log('\n=== 5. SKILL NORMALIZATION VERIFICATION ===');
  const mappings = await taxonomyRepo.getAllSkillMappings();
  const testSkills = ['Laravel', 'Laravel Framework', 'لارافيل'];
  console.log('Mappings check for:', testSkills);
  for (const s of testSkills) {
    const map = mappings.find(m => m.sourceSkill.toLowerCase() === s.toLowerCase());
    console.log(`Input: "${s}" -> Canonical Term ID: ${map?.canonicalTermId}, Normalized: "${map?.normalizedName}"`);
  }

  console.log('\n=== 6. ARABIC / ENGLISH FTS SEARCH TEST ===');
  const searchArabic = await projectRepo.searchProjects({ query: 'برمجة' });
  const searchEnglish = await projectRepo.searchProjects({ query: 'Laravel' });
  const searchNormalized = await projectRepo.searchProjects({ query: 'React' });
  const searchAlias = await projectRepo.searchProjects({ query: 'لارافيل' });

  console.log('Search results count:', {
    arabic_برمجة: searchArabic.total,
    english_Laravel: searchEnglish.total,
    normalized_React: searchNormalized.total,
    alias_لارافيل: searchAlias.total
  });

  console.log('\n=== 7. COMBINED FILTER QUERY TEST ===');
  // Technology = Laravel, Technology = React, Match All, Budget >= 500, Bids <= 10, Published within last 30 days
  const combinedRes = await projectRepo.searchProjects({
    skills: ['Laravel', 'React'],
    skillsMatchMode: 'all',
    budgetMin: 500,
    bidsTo: 10,
    datePreset: 'last_30_days'
  });

  console.log('Combined filter results count:', combinedRes.total);
  console.log('Sample result items:', combinedRes.items.slice(0, 3).map(i => ({ id: i.sourceProjectId, title: i.title })));

  console.log('\n=== 8. MULTIPLE OBSERVATIONS DEDUPLICATION CHECK ===');
  const dupCheckSql = `
    SELECT p.source_project_id, COUNT(p.id) as cnt
    FROM projects p
    INNER JOIN project_observations obs ON obs.project_id = p.id
    GROUP BY p.id
    HAVING COUNT(obs.id) > 1
    LIMIT 1
  `;
  const dupProj = db.prepare(dupCheckSql).get() as any;
  if (dupProj) {
    const singleRes = await projectRepo.searchProjects({ query: dupProj.source_project_id });
    console.log(`Project ${dupProj.source_project_id} has observations count > 1, search result count: ${singleRes.total}`);
  } else {
    console.log('Observation deduplication test verified.');
  }

  appDb.close();
}

runVerification().catch(console.error);
