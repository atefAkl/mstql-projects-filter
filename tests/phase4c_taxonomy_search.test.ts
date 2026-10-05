import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteTaxonomyRepository } from '../src/infrastructure/repositories/SqliteTaxonomyRepository';
import { ProcessCollectionItemUseCase } from '../src/application/use-cases/ProcessCollectionItemUseCase';
import { RuleBasedClassifierService } from '../src/application/services/RuleBasedClassifierService';
import { ParsedProjectItem } from '../src/core/interfaces/ICollectorAdapter';

describe('Phase 4C - Expanded Taxonomy, Search & Advanced Filtering Suite', () => {
  let dbPath: string;
  let appDb: AppDatabase;
  let projectRepo: SqliteProjectRepository;
  let taxonomyRepo: SqliteTaxonomyRepository;
  let processItemUseCase: ProcessCollectionItemUseCase;
  let classifier: RuleBasedClassifierService;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), 'data', `test_phase4c_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);
    appDb = new AppDatabase(dbPath);
    const db = appDb.getRawConnection();
    projectRepo = new SqliteProjectRepository(db);
    taxonomyRepo = new SqliteTaxonomyRepository(db);
    processItemUseCase = new ProcessCollectionItemUseCase(projectRepo, taxonomyRepo, db);
    classifier = new RuleBasedClassifierService(taxonomyRepo, db);

    // Seed test projects
    const now = new Date();
    const item1: ParsedProjectItem = {
      sourceProjectId: '1001',
      title: 'بناء متجر إلكتروني متكامل باستخدام Laravel و React',
      sourceUrl: 'https://mostaql.com/project/1001-laravel-react-ecommerce',
      descriptionRaw: 'مطلوب تطوير متجر إلكتروني كامل لشركة تجارة تجزئة مع ربط بوابات الدفع وقواعد بيانات MySQL',
      publishedAtParsed: new Date(now.getTime() - 2 * 86400 * 1000), // 2 days ago
      bidsCountParsed: 5,
      budgetMinUsd: 500,
      budgetMaxUsd: 1000,
      budgetAvgUsd: 750,
      statusRaw: 'مفتوح',
      skillsTagsRaw: ['Laravel', 'React.js', 'MySQL', 'تارة تجزئة'],
      clientNameRaw: 'شركة الأمل للتجارة',
      rawHtml: '<html>...</html>'
    };

    const item2: ParsedProjectItem = {
      sourceProjectId: '1002',
      title: 'تطبيق جوال للاستشارات الطبية بنظام Flutter',
      sourceUrl: 'https://mostaql.com/project/1002-flutter-healthcare-app',
      descriptionRaw: 'نظام عيادات ورعاية صحية يتضمن تطبيق هاتف وتواصل مباشر مع الأطباء وبايثون باك إند',
      publishedAtParsed: new Date(now.getTime() - 10 * 86400 * 1000), // 10 days ago
      bidsCountParsed: 15,
      budgetMinUsd: 1000,
      budgetMaxUsd: 2500,
      budgetAvgUsd: 1750,
      statusRaw: 'قيد التنفيذ',
      skillsTagsRaw: ['Flutter', 'Python', 'PostgreSQL'],
      clientNameRaw: 'مستشفى السلام',
      rawHtml: '<html>...</html>'
    };

    const item3: ParsedProjectItem = {
      sourceProjectId: '1003',
      title: 'إصلاح عطل في موقع ووردبريس وتطوير ميزات Vue.js',
      sourceUrl: 'https://mostaql.com/project/1003-wordpress-vue-bugfix',
      descriptionRaw: 'لدينا مشكلة في أداء موقع ووردبريس ونريد حل وتعديل السكريبت وبناء واجهة فيو',
      publishedAtParsed: new Date(now.getTime() - 40 * 86400 * 1000), // 40 days ago
      bidsCountParsed: 2,
      budgetMinUsd: 100,
      budgetMaxUsd: 250,
      budgetAvgUsd: 175,
      statusRaw: 'مفتوح',
      skillsTagsRaw: ['WordPress', 'Vue', 'PHP'],
      clientNameRaw: 'مركز التعليم الذكي',
      rawHtml: '<html>...</html>'
    };

    await processItemUseCase.execute(item1);
    await processItemUseCase.execute(item2);
    await processItemUseCase.execute(item3);
  });

  afterEach(() => {
    appDb.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  });

  it('1. Full Text Search: should match Arabic & English text in title, description, skills, and client', async () => {
    // Search Arabic keyword
    const resArabic = await projectRepo.searchProjects({ query: 'متجر' });
    expect(resArabic.total).toBe(1);
    expect(resArabic.items[0].sourceProjectId).toBe('1001');

    // Search English technology keyword
    const resEng = await projectRepo.searchProjects({ query: 'Flutter' });
    expect(resEng.total).toBe(1);
    expect(resEng.items[0].sourceProjectId).toBe('1002');
  });

  it('2. Date Presets: should filter by last 7 days preset', async () => {
    const res7Days = await projectRepo.searchProjects({ datePreset: 'last_7_days' });
    expect(res7Days.total).toBe(1); // Only project 1001 (2 days ago)
    expect(res7Days.items[0].sourceProjectId).toBe('1001');

    const res30Days = await projectRepo.searchProjects({ datePreset: 'last_30_days' });
    expect(res30Days.total).toBe(2); // Project 1001 & 1002
  });

  it('3. Budget Filters: should filter by budget min/max and handle unassigned budget', async () => {
    const resHighBudget = await projectRepo.searchProjects({ budgetMin: 800 });
    expect(resHighBudget.total).toBe(1);
    expect(resHighBudget.items[0].sourceProjectId).toBe('1002');

    const resLowBudget = await projectRepo.searchProjects({ budgetMax: 300 });
    expect(resLowBudget.total).toBe(1);
    expect(resLowBudget.items[0].sourceProjectId).toBe('1003');
  });

  it('4. Bids Filters: should filter by bids presets', async () => {
    const resLowBids = await projectRepo.searchProjects({ bidsPreset: '1-5' });
    expect(resLowBids.total).toBe(2); // Project 1001 (5 bids) & 1003 (2 bids)

    const resMediumBids = await projectRepo.searchProjects({ bidsPreset: '11-20' });
    expect(resMediumBids.total).toBe(1);
    expect(resMediumBids.items[0].sourceProjectId).toBe('1002');
  });

  it('5. Technology Multi-Select: Match Any vs Match All', async () => {
    // Match Any: Laravel OR Flutter
    const resAny = await projectRepo.searchProjects({
      skills: ['Laravel', 'Flutter'],
      skillsMatchMode: 'any'
    });
    expect(resAny.total).toBe(2);

    // Match All: Laravel AND React
    const resAll = await projectRepo.searchProjects({
      skills: ['Laravel', 'React.js'],
      skillsMatchMode: 'all'
    });
    expect(resAll.total).toBe(1);
    expect(resAll.items[0].sourceProjectId).toBe('1001');

    // Match All negative test: Laravel AND Flutter (No single project uses both)
    const resAllNeg = await projectRepo.searchProjects({
      skills: ['Laravel', 'Flutter'],
      skillsMatchMode: 'all'
    });
    expect(resAllNeg.total).toBe(0);
  });

  it('6. Taxonomy Dimensions Filter: Domain, Service Type, Project Type, Industry, Work Type', async () => {
    // Project Type = E-commerce
    const resEcommerce = await projectRepo.searchProjects({ projectType: 'ecommerce' });
    expect(resEcommerce.total).toBe(1);
    expect(resEcommerce.items[0].sourceProjectId).toBe('1001');

    // Industry = Healthcare
    const resHealth = await projectRepo.searchProjects({ industry: 'healthcare' });
    expect(resHealth.total).toBe(1);
    expect(resHealth.items[0].sourceProjectId).toBe('1002');

    // Work Type = Bug Fix
    const resBugFix = await projectRepo.searchProjects({ workType: 'bug_fix' });
    expect(resBugFix.total).toBe(1);
    expect(resBugFix.items[0].sourceProjectId).toBe('1003');
  });

  it('7. Combined Filters: should combine Technology + Budget + Bids + Date preset', async () => {
    const resCombined = await projectRepo.searchProjects({
      skills: ['Laravel'],
      budgetMin: 500,
      bidsTo: 10,
      datePreset: 'last_30_days',
      projectType: 'ecommerce'
    });

    expect(resCombined.total).toBe(1);
    expect(resCombined.items[0].sourceProjectId).toBe('1001');
  });

  it('8. Sorting & Pagination: should sort and paginate correctly', async () => {
    // Sort by Budget DESC
    const resSortBudget = await projectRepo.searchProjects({ sortBy: 'budget', sortOrder: 'desc' });
    expect(resSortBudget.items[0].sourceProjectId).toBe('1002'); // $1750 avg

    // Pagination
    const page1 = await projectRepo.searchProjects({ limit: 2, page: 1 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);

    const page2 = await projectRepo.searchProjects({ limit: 2, page: 2 });
    expect(page2.items.length).toBe(1);
  });

  it('9. Local Only Guard: Search/Filter executes 100% locally without external network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await projectRepo.searchProjects({
      query: 'Laravel',
      skills: ['React'],
      budgetMin: 100,
      datePreset: 'last_30_days'
    });

    expect(result).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('10. Duplicate Safety: Multiple observations for a project do NOT duplicate project in search results', async () => {
    // Add multiple observations for project 1001
    const p1001 = await projectRepo.findBySourceProjectId('1001');
    expect(p1001).toBeDefined();

    for (let i = 0; i < 5; i++) {
      await processItemUseCase.execute({
        sourceProjectId: '1001',
        title: 'بناء متجر إلكتروني متكامل باستخدام Laravel و React',
        sourceUrl: 'https://mostaql.com/project/1001-laravel-react-ecommerce',
        bidsCountParsed: 5 + i,
        statusRaw: 'مفتوح'
      });
    }

    const res = await projectRepo.searchProjects({ query: 'Laravel' });
    expect(res.total).toBe(1);
    expect(res.items.length).toBe(1);
    expect(res.items[0].sourceProjectId).toBe('1001');
  });

  it('11. Evidence-Based Domain Classification: Audio/non-tech project should remain unclassified (no software fallback)', async () => {
    const audioItem: ParsedProjectItem = {
      sourceProjectId: '1004',
      title: 'تسجيل وتعديل صوتي لحلقات بودكاست',
      sourceUrl: 'https://mostaql.com/project/1004-podcast-audio',
      descriptionRaw: 'مطلوب مؤدي صوت عربي محترف لتلخيص وتسجيل بودكاست صوتي',
      publishedAtParsed: new Date(),
      bidsCountParsed: 3,
      budgetMinUsd: 50,
      budgetMaxUsd: 100,
      budgetAvgUsd: 75,
      statusRaw: 'مفتوح',
      skillsTagsRaw: ['هندسة صوتية', 'تعليق صوتي'],
      clientNameRaw: 'استوديو الصوت',
      rawHtml: '<html>...</html>'
    };

    await processItemUseCase.execute(audioItem);

    const project4 = await projectRepo.findBySourceProjectId('1004');
    expect(project4).toBeDefined();

    const terms = await taxonomyRepo.getProjectTerms(project4!.id);
    const domainTerms = terms.filter(t => t.dimensionCode === 'domain');
    expect(domainTerms.length).toBe(0); // MUST be unclassified, no default 'software' fallback!
  });

  it('12. Regression Test 1283115: Voice-over child project must NOT be classified as Healthcare or Education', async () => {
    const item: ParsedProjectItem = {
      sourceProjectId: '1283115',
      title: 'مطلوب مؤدي صوت عربي لصوت طفل 6–8 سنوات لمشروع تسجيل صوتي',
      sourceUrl: 'https://mostaql.com/project/1283115',
      descriptionRaw: 'مطلوب أداء صوتي محترف لصوت طفل لمشروع تسجيل صوتي قصصي',
      publishedAtParsed: new Date(),
      bidsCountParsed: 0,
      statusRaw: 'مفتوح',
      skillsTagsRaw: ['تعليق صوتي', 'تسجيل صوتي']
    };

    await processItemUseCase.execute(item);
    const project = await projectRepo.findBySourceProjectId('1283115');
    expect(project).toBeDefined();

    const terms = await taxonomyRepo.getProjectTerms(project!.id);
    const termCodes = terms.map(t => t.code);
    expect(termCodes).not.toContain('healthcare');
    expect(termCodes).not.toContain('education');
  });

  it('13. Regression Test 1282870: Apartment engineering project must NOT be classified as Software, Web App, or Integration', async () => {
    const item: ParsedProjectItem = {
      sourceProjectId: '1282870',
      title: 'عمل تصميمات وتخطيط هندسي شامل لشقة',
      sourceUrl: 'https://mostaql.com/project/1282870',
      descriptionRaw: 'مطلوب عمل مخططات إلكترونية وتخيطيط داخلي ومعماري لشقة فندقية',
      publishedAtParsed: new Date(),
      bidsCountParsed: 0,
      statusRaw: 'مفتوح',
      skillsTagsRaw: ['تصميم داخلي', 'أوتوكاد']
    };

    await processItemUseCase.execute(item);
    const project = await projectRepo.findBySourceProjectId('1282870');
    expect(project).toBeDefined();

    const terms = await taxonomyRepo.getProjectTerms(project!.id);
    const termCodes = terms.map(t => t.code);
    expect(termCodes).not.toContain('software');
    expect(termCodes).not.toContain('web_app');
    expect(termCodes).not.toContain('srv_integration');
    expect(termCodes).not.toContain('integration');
  });

  it('14. Regression Test 1224639: Academic rhetoric research project must NOT be classified as Consulting', async () => {
    const item: ParsedProjectItem = {
      sourceProjectId: '1224639',
      title: 'باحث متميز في تخصص البلاغة والنقد',
      sourceUrl: 'https://mostaql.com/project/1224639',
      descriptionRaw: 'مطلوب باحث أكاديمي متخصص في نقد البلاغة العربية القديمة والحديثة',
      publishedAtParsed: new Date(),
      bidsCountParsed: 5,
      statusRaw: 'مفتوح',
      skillsTagsRaw: ['البلاغة العربية', 'النقد الأدبي']
    };

    await processItemUseCase.execute(item);
    const project = await projectRepo.findBySourceProjectId('1224639');
    expect(project).toBeDefined();

    const terms = await taxonomyRepo.getProjectTerms(project!.id);
    const termCodes = terms.map(t => t.code);
    expect(termCodes).not.toContain('consulting');
    expect(termCodes).not.toContain('srv_consulting');
  });
});


