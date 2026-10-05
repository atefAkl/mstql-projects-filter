"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const Database_1 = require("../infrastructure/database/Database");
const SqliteProjectRepository_1 = require("../infrastructure/repositories/SqliteProjectRepository");
const SqliteCollectionRunRepository_1 = require("../infrastructure/repositories/SqliteCollectionRunRepository");
const SqliteTaxonomyRepository_1 = require("../infrastructure/repositories/SqliteTaxonomyRepository");
const MostaqlHtmlCollectorAdapter_1 = require("../infrastructure/collectors/MostaqlHtmlCollectorAdapter");
const ProcessCollectionItemUseCase_1 = require("../application/use-cases/ProcessCollectionItemUseCase");
const DailyCollectionUseCase_1 = require("../application/use-cases/DailyCollectionUseCase");
const DailyScheduler_1 = require("../application/schedulers/DailyScheduler");
const GetAndRefreshProjectUseCase_1 = require("../application/use-cases/GetAndRefreshProjectUseCase");
const BackfillIncompleteProjectsUseCase_1 = require("../application/use-cases/BackfillIncompleteProjectsUseCase");
const RuleBasedClassifierService_1 = require("../application/services/RuleBasedClassifierService");
const dateUtils_1 = require("../shared/dateUtils");
function createServer(dbPath) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const appDb = new Database_1.AppDatabase(dbPath);
    const db = appDb.getRawConnection();
    const projectRepo = new SqliteProjectRepository_1.SqliteProjectRepository(db);
    const runRepo = new SqliteCollectionRunRepository_1.SqliteCollectionRunRepository(db);
    const taxonomyRepo = new SqliteTaxonomyRepository_1.SqliteTaxonomyRepository(db);
    const collector = new MostaqlHtmlCollectorAdapter_1.MostaqlHtmlCollectorAdapter({ minDelayMs: 1000, maxDelayMs: 1500 });
    const processItemUseCase = new ProcessCollectionItemUseCase_1.ProcessCollectionItemUseCase(projectRepo, taxonomyRepo, db);
    const dailyCollectionUseCase = new DailyCollectionUseCase_1.DailyCollectionUseCase(collector, projectRepo, runRepo, processItemUseCase);
    const getAndRefreshUseCase = new GetAndRefreshProjectUseCase_1.GetAndRefreshProjectUseCase(projectRepo, collector);
    const scheduler = new DailyScheduler_1.DailyScheduler(dailyCollectionUseCase);
    // Start background scheduler
    scheduler.start();
    // Create isolated API Router
    const apiRouter = express_1.default.Router();
    // 1. Overview KPIs Endpoint
    apiRouter.get('/stats/overview', async (_req, res) => {
        try {
            const totalProjects = await projectRepo.countProjects();
            const latestRun = await runRepo.getLatestCompletedRun();
            const latestTimestamp = await projectRepo.getLatestSuccessfulCollectionTimestamp();
            const avgStmt = db.prepare(`
        SELECT AVG(bids_count) as avg_bids, AVG(budget_avg_usd) as avg_budget
        FROM project_observations
      `).get();
            res.json({
                totalProjects,
                totalObservations: totalProjects,
                averageBids: avgStmt.avg_bids ? Math.round(avgStmt.avg_bids) : 0,
                averageBudgetUsd: avgStmt.avg_budget ? Math.round(avgStmt.avg_budget) : 0,
                lastCollectionAt: latestTimestamp ? latestTimestamp.toISOString() : null,
                lastCollectionAtFormatted: (0, dateUtils_1.formatDateRiyadh)(latestTimestamp),
                timezone: dateUtils_1.RIYADH_TIMEZONE,
                locale: dateUtils_1.RIYADH_LOCALE,
                isRunning: DailyCollectionUseCase_1.DailyCollectionUseCase.isRunning(),
                latestRun,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 2. Taxonomy API Endpoint (GET /api/taxonomy)
    apiRouter.get('/taxonomy', async (_req, res) => {
        try {
            const dimensions = await taxonomyRepo.getAllDimensions();
            const terms = await taxonomyRepo.getAllTerms();
            const skillMappings = await taxonomyRepo.getAllSkillMappings();
            res.json({
                dimensions,
                terms,
                skillMappings,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 3. Trigger Reclassification API (POST /api/taxonomy/reclassify)
    apiRouter.post('/taxonomy/reclassify', async (_req, res) => {
        try {
            const classifier = new RuleBasedClassifierService_1.RuleBasedClassifierService(taxonomyRepo, db);
            const projects = await projectRepo.findProjects({ limit: 500 });
            let classifiedCount = 0;
            for (const p of projects) {
                const rawPayload = await projectRepo.getLatestRawPayloadByProjectId(p.id);
                const metadata = rawPayload?.rawMetadata || {};
                const skills = metadata.skillsTagsRaw || [];
                const clientName = metadata.clientNameRaw || '';
                await classifier.classifyProject(p, skills, clientName);
                classifiedCount++;
            }
            res.json({
                success: true,
                message: `تم تصنيف وشهر ${classifiedCount} مشروع بنجاح وفق محرك Taxonomy & FTS`,
                classifiedCount,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // 4. Trigger Smart Refresh Action Endpoint (POST /api/projects/:id/refresh)
    apiRouter.post('/projects/:id/refresh', async (req, res) => {
        try {
            const projectId = req.params.id;
            const result = await getAndRefreshUseCase.execute({
                sourceProjectId: projectId,
                forceRefresh: true,
            });
            // Auto classify after refresh
            if (result.project) {
                const classifier = new RuleBasedClassifierService_1.RuleBasedClassifierService(taxonomyRepo, db);
                const rawMeta = result.rawPayload?.rawMetadata || {};
                await classifier.classifyProject(result.project, rawMeta.skillsTagsRaw || [], rawMeta.clientNameRaw);
            }
            res.json(result);
        }
        catch (err) {
            console.error('[API Error /projects/:id/refresh]:', err);
            res.status(500).json({ error: err.message });
        }
    });
    // 5. Specific Project Detail Endpoint (GET /api/projects/:id)
    apiRouter.get('/projects/:id', async (req, res) => {
        try {
            const projectId = req.params.id;
            const forceRefresh = req.query.refresh === 'true';
            const result = await getAndRefreshUseCase.execute({
                sourceProjectId: projectId,
                forceRefresh,
            });
            res.json(result);
        }
        catch (err) {
            console.error('[API Error /projects/:id]:', err);
            res.status(500).json({ error: err.message });
        }
    });
    // 6. Phase 4C Expanded Project Search & Multi-Filter API (GET /api/projects)
    apiRouter.get('/projects', async (req, res) => {
        try {
            const criteria = {
                query: req.query.q || req.query.query || undefined,
                publishedFrom: req.query.publishedFrom ? new Date(req.query.publishedFrom) : undefined,
                publishedTo: req.query.publishedTo ? new Date(req.query.publishedTo) : undefined,
                datePreset: req.query.datePreset || undefined,
                budgetMin: req.query.budgetMin ? parseFloat(req.query.budgetMin) : undefined,
                budgetMax: req.query.budgetMax ? parseFloat(req.query.budgetMax) : undefined,
                budgetType: req.query.budgetType || undefined,
                bidsFrom: req.query.bidsFrom ? parseInt(req.query.bidsFrom, 10) : undefined,
                bidsTo: req.query.bidsTo ? parseInt(req.query.bidsTo, 10) : undefined,
                bidsPreset: req.query.bidsPreset || undefined,
                status: req.query.status || undefined,
                executionDaysMin: req.query.executionDaysMin ? parseInt(req.query.executionDaysMin, 10) : undefined,
                executionDaysMax: req.query.executionDaysMax ? parseInt(req.query.executionDaysMax, 10) : undefined,
                skills: req.query.skills ? (typeof req.query.skills === 'string' ? req.query.skills.split(',') : req.query.skills) : undefined,
                skillsMatchMode: req.query.skillsMatchMode || 'any',
                domain: req.query.domain || undefined,
                serviceType: req.query.serviceType || undefined,
                projectType: req.query.projectType || undefined,
                industry: req.query.industry || undefined,
                workType: req.query.workType || undefined,
                clientId: req.query.clientId || undefined,
                clientName: req.query.clientName || undefined,
                competitionLevel: req.query.competitionLevel || undefined,
                completenessStatus: req.query.completenessStatus || undefined,
                sortBy: req.query.sortBy || 'published_at',
                sortOrder: req.query.sortOrder || 'desc',
                page: parseInt(req.query.page || '1', 10),
                limit: parseInt(req.query.limit || '15', 10),
            };
            const result = await projectRepo.searchProjects(criteria);
            res.json(result);
        }
        catch (err) {
            console.error('[API Error /projects search]:', err);
            res.status(500).json({ error: err.message });
        }
    });
    // 7. Trigger Live Incremental Collection API
    apiRouter.post('/collection/trigger', async (_req, res) => {
        try {
            const result = await dailyCollectionUseCase.execute(true);
            res.json({
                success: true,
                message: `تم جلب ${result.newProjectsCount} مشروع جديد وتحديث ${result.duplicateProjectsCount} ملاحظة!`,
                newProjectsCount: result.newProjectsCount,
                duplicateProjectsCount: result.duplicateProjectsCount,
                pagesProcessed: result.run.pagesProcessed,
                run: result.run,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // 8. Collection Runs History API
    apiRouter.get('/runs', async (_req, res) => {
        try {
            const runs = await runRepo.listRuns(20, 0);
            res.json(runs);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 9. Trigger Incomplete Projects Backfill Ingestion API
    apiRouter.post('/collection/backfill', async (_req, res) => {
        try {
            const backfillUseCase = new BackfillIncompleteProjectsUseCase_1.BackfillIncompleteProjectsUseCase(projectRepo, collector);
            const result = await backfillUseCase.execute();
            res.json({
                success: true,
                message: `تم معالجة ${result.processedCount} مشروع: نجاح ${result.successCount}، فشل ${result.failedCount}`,
                result,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // MUST MOUNT API ROUTER FIRST
    app.use('/api', apiRouter);
    // Route for Standalone Project Detail Page: /projects/:id
    app.get('/projects/:id', (req, res) => {
        res.send(getProjectDetailPageHtml(req.params.id));
    });
    // Root Web Dashboard Route
    app.get('/', (_req, res) => {
        res.send(getWebDashboardHtml());
    });
    // Fallback 404 handler
    app.use((_req, res) => {
        res.send(getWebDashboardHtml());
    });
    return app;
}
function getProjectDetailPageHtml(projectId) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تفاصيل المشروع - Mostaql Intelligence</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .card-dark { background-color: #1e293b; border-color: #334155; }
    .spinner { border: 2px solid rgba(255,255,255,0.1); border-left-color: #3b82f6; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body class="p-4 md:p-8 antialiased">
  <div class="max-w-6xl mx-auto space-y-6">

    <!-- Toast Alert -->
    <div id="toast" class="hidden fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 border transition">
      <div id="toast-spinner" class="spinner"></div>
      <span id="toast-message">جاري الاتصال بمستقل والتحديث...</span>
    </div>

    <!-- Navigation Header -->
    <div class="flex items-center justify-between">
      <a href="/" class="text-sm font-semibold text-blue-400 hover:underline flex items-center gap-1">
        ← العودة للوحة التحكم الرئيسية
      </a>
      <div class="flex items-center gap-2">
        <span id="completeness-badge" class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          مكتمل محلياً (Complete)
        </span>
        <span class="text-xs text-slate-400">توقيت الرياض GMT+3</span>
        <span class="text-xs text-slate-400">معرف المشروع: <code class="text-white font-mono">${projectId}</code></span>
      </div>
    </div>

    <!-- Update Notification Banner -->
    <div id="update-available-banner" class="hidden bg-blue-900/90 border border-blue-500 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4 transition">
      <div class="flex items-center gap-3">
        <span class="text-xl">🟢</span>
        <div>
          <h3 class="text-sm font-bold text-white">تم العثور على تحديثات جديدة لهذا المشروع في المصدر!</h3>
          <p class="text-xs text-blue-200 mt-0.5">تمت المزامنة والتحديث في قاعدة البيانات المحلية. انقر لتحديث العرض الحقيقي.</p>
        </div>
      </div>
      <button onclick="applyNewUpdates()" class="px-4 py-2 text-xs font-bold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow transition flex items-center gap-1.5 whitespace-nowrap">
        تحديث البيانات المعروضة 🔄
      </button>
    </div>

    <!-- Project Header Card -->
    <div class="card-dark border rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <span id="status-badge" class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              مفتوح
            </span>
          </div>
          <h1 id="project-title" class="text-2xl font-bold text-white mt-2 leading-snug">جاري التحميل...</h1>
        </div>

        <button id="refresh-btn" onclick="triggerSmartRefresh()" class="px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition flex items-center gap-2 shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          تحديث من المصدر (Smart Refresh)
        </button>
      </div>

      <!-- Attributes KPI Grid -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4 pt-2">
        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <span class="text-[11px] text-slate-400 block">الميزانية التقديرية</span>
          <span id="attr-budget" class="text-sm font-extrabold text-emerald-400 mt-1 block">...</span>
        </div>
        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <span class="text-[11px] text-slate-400 block">عدد العروض الحالية</span>
          <span id="attr-bids" class="text-sm font-extrabold text-blue-400 mt-1 block">...</span>
        </div>
        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <span class="text-[11px] text-slate-400 block">مدة التنفيذ</span>
          <span id="attr-duration" class="text-sm font-extrabold text-purple-400 mt-1 block">غير محددة</span>
        </div>
        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <span class="text-[11px] text-slate-400 block">تاريخ النشر (توقيت الرياض)</span>
          <span id="attr-published" class="text-xs font-semibold text-amber-300 mt-1 block">...</span>
        </div>
        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <span class="text-[11px] text-slate-400 block">حالة أحدث Sync</span>
          <span id="attr-sync-status" class="text-xs font-semibold text-slate-300 mt-1 block">Local Cached</span>
        </div>
        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <span class="text-[11px] text-slate-400 block">آخر مزامنة محلياً</span>
          <span id="last-sync-time" class="text-xs font-semibold text-slate-400 mt-1 block">...</span>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- Right Main Column -->
      <div class="md:col-span-2 space-y-6">
        
        <!-- Full Description Card -->
        <div class="card-dark border rounded-2xl p-6 shadow-xl space-y-4">
          <h2 class="text-lg font-bold text-white border-b border-slate-700 pb-3 flex items-center justify-between">
            <span>تفاصيل ووصف المشروع الكامل</span>
            <span class="text-xs font-normal text-slate-400">مستخرج من صفحة تفاصيل المصدر</span>
          </h2>
          <div id="project-description" class="text-sm text-slate-200 leading-relaxed whitespace-pre-line font-sans">
            جاري التحميل...
          </div>
        </div>

        <!-- Required Skills Card -->
        <div class="card-dark border rounded-2xl p-6 shadow-xl space-y-3">
          <h2 class="text-sm font-bold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
            <span>🏷️ المهارات والتقنيات المطلوبة</span>
          </h2>
          <div id="skills-container" class="flex flex-wrap gap-2 pt-1">
            <span class="text-xs text-slate-500">جاري تحميل المهارات...</span>
          </div>
        </div>

      </div>

      <!-- Left Sidebar Column -->
      <div class="space-y-6">
        
        <!-- Client Information Card -->
        <div class="card-dark border rounded-2xl p-6 shadow-xl space-y-3">
          <h2 class="text-sm font-bold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
            <span>👤 صاحب المشروع (Client Details)</span>
          </h2>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-slate-400">الاسم / التعريف:</span>
              <span id="client-name" class="font-bold text-white">...</span>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-slate-800">
              <span class="text-slate-400">الحساب الأصلي:</span>
              <a id="client-profile-link" href="#" target="_blank" class="text-blue-400 hover:underline">زيارة صفحة المستقل ↗</a>
            </div>
          </div>
        </div>

        <!-- Historical Observations Timeline Card -->
        <div class="card-dark border rounded-2xl p-6 shadow-xl space-y-4">
          <h2 class="text-sm font-bold text-white border-b border-slate-700 pb-3 flex items-center justify-between">
            <span>⏱️ السجل الزمني (Snapshots GMT+3)</span>
            <span class="text-[11px] font-normal text-slate-400">تغيرات البيانات</span>
          </h2>
          <div id="observations-timeline" class="space-y-3 text-xs">
            <!-- Timeline items -->
          </div>
        </div>

        <!-- Source & Metadata Link Card -->
        <div class="card-dark border rounded-2xl p-4 shadow-xl space-y-2 text-xs text-slate-400">
          <div class="flex justify-between items-center">
            <span>رابط المصدر الأصلي:</span>
            <a id="source-link" href="#" target="_blank" class="text-blue-400 font-semibold hover:underline">موقع مستقل ↗</a>
          </div>
          <div class="flex justify-between items-center pt-2 border-t border-slate-800">
            <span>تشفير المحتوى (Hash):</span>
            <span id="attr-hash" class="font-mono text-[10px] text-slate-500">...</span>
          </div>
        </div>

      </div>
    </div>

  </div>

  <script>
    const projectId = "${projectId}";
    const riyadhTzOptions = { timeZone: 'Asia/Riyadh' };

    function formatRiyadhDateTime(dateStr) {
      if (!dateStr) return 'غير محدد';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'غير محدد';
      return d.toLocaleString('ar-SA', { ...riyadhTzOptions, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatRiyadhTime(dateStr) {
      if (!dateStr) return 'غير محدد';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'غير محدد';
      return d.toLocaleTimeString('ar-SA', { ...riyadhTzOptions, hour: '2-digit', minute: '2-digit' });
    }

    function formatRiyadhDate(dateStr) {
      if (!dateStr) return 'غير محدد';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'غير محدد';
      return d.toLocaleDateString('ar-SA', { ...riyadhTzOptions, year: 'numeric', month: 'numeric', day: 'numeric' });
    }

    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      const msgEl = document.getElementById('toast-message');
      const spinner = document.getElementById('toast-spinner');
      toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 border transition ' +
        (isError ? 'bg-rose-900/90 text-rose-200 border-rose-700' : 'bg-slate-900/95 text-white border-blue-500');
      msgEl.innerText = msg;
      spinner.style.display = isError ? 'none' : 'block';
      toast.classList.remove('hidden');
    }

    function hideToast() {
      document.getElementById('toast').classList.add('hidden');
    }

    async function loadProjectDetails(forceRefresh = false) {
      try {
        const url = '/api/projects/' + projectId + (forceRefresh ? '?refresh=true' : '?refresh=false');
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          showToast('خطأ: ' + data.error, true);
          return;
        }

        const proj = data.project;
        const rawMeta = (data.rawPayload && data.rawPayload.rawMetadata) ? data.rawPayload.rawMetadata : {};

        document.getElementById('project-title').innerText = proj.title;
        document.getElementById('status-badge').innerText = proj.status;
        document.getElementById('completeness-badge').innerText = proj.completenessStatus === 'complete' ? 'مكتمل محلياً (Complete)' : 'الفهرس فقط (' + (proj.completenessStatus || 'غير مكتمل') + ')';
        document.getElementById('project-description').innerText = proj.descriptionRaw || 'لا يوجد وصف متاح';
        document.getElementById('source-link').href = proj.sourceUrl;
        document.getElementById('attr-published').innerText = formatRiyadhDateTime(proj.publishedAt);
        document.getElementById('last-sync-time').innerText = formatRiyadhDateTime(proj.lastSourceSyncAt);
        document.getElementById('attr-sync-status').innerText = data.refreshStatus || proj.lastSyncStatus || 'local_cached';
        document.getElementById('attr-hash').innerText = proj.normalizedContentHash ? proj.normalizedContentHash.substring(0, 16) + '...' : 'لا يوجد';

        // Client Info
        document.getElementById('client-name').innerText = rawMeta.clientNameRaw || 'غير معلن';
        if (rawMeta.clientProfileUrl) {
          document.getElementById('client-profile-link').href = rawMeta.clientProfileUrl;
        }

        // Skills Tags
        const skillsContainer = document.getElementById('skills-container');
        skillsContainer.innerHTML = '';
        const skills = rawMeta.skillsTagsRaw || [];
        if (skills.length === 0) {
          skillsContainer.innerHTML = '<span class="text-xs text-slate-500">لا توجد مهارات محددة</span>';
        } else {
          skills.forEach(skill => {
            const pill = document.createElement('span');
            pill.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20';
            pill.innerText = skill;
            skillsContainer.appendChild(pill);
          });
        }

        // Set budget, bids, duration from latest observation and metadata
        const obs = data.observations || [];
        const latestObs = obs.length > 0 ? obs[obs.length - 1] : null;
        if (latestObs) {
          document.getElementById('attr-bids').innerText = latestObs.bidsCount + ' عروض';
          
          let budgetText = 'حسب الاتفاق';
          if (latestObs.budgetMinUsd && latestObs.budgetMaxUsd) {
            budgetText = '$' + latestObs.budgetMinUsd + ' - $' + latestObs.budgetMaxUsd;
          } else if (latestObs.budgetAvgUsd) {
            budgetText = '$' + latestObs.budgetAvgUsd;
          }
          document.getElementById('attr-budget').innerText = budgetText;
        }

        if (rawMeta.executionTimeRaw) {
          document.getElementById('attr-duration').innerText = rawMeta.executionTimeRaw;
        } else if (rawMeta.executionDaysParsed) {
          document.getElementById('attr-duration').innerText = rawMeta.executionDaysParsed + ' أيام';
        }

        // Render timeline with Riyadh GMT+3 timezone
        const timeline = document.getElementById('observations-timeline');
        timeline.innerHTML = '';
        if (obs.length === 0) {
          timeline.innerHTML = '<div class="text-slate-500">لا توجد ملاحظات زمنية بعد</div>';
        } else {
          [...obs].reverse().forEach(o => {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm';
            
            let obsBudget = o.budgetAvgUsd ? '$' + o.budgetAvgUsd : 'حسب الاتفاق';
            if (o.budgetMinUsd && o.budgetMaxUsd) {
              obsBudget = '$' + o.budgetMinUsd + ' - $' + o.budgetMaxUsd;
            }

            item.innerHTML = \`
              <div class="flex justify-between font-bold text-slate-200 text-xs">
                <span>\${o.bidsCount} عروض (\${obsBudget})</span>
                <span class="text-[10px] font-normal text-amber-400">\${formatRiyadhTime(o.observedAt)}</span>
              </div>
              <div class="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                <span>الحالة: <strong class="text-emerald-400">\${o.status}</strong></span>
                <span class="text-[10px] text-slate-500">\${formatRiyadhDate(o.observedAt)}</span>
              </div>
            \`;
            timeline.appendChild(item);
          });
        }

      } catch (err) {
        showToast('فشل تحميل تفاصيل المشروع', true);
      }
    }

    async function autoCheckBackgroundUpdate() {
      try {
        const res = await fetch('/api/projects/' + projectId + '/refresh', { method: 'POST' });
        const data = await res.json();

        if (data.refreshStatus === 'success_updated') {
          document.getElementById('update-available-banner').classList.remove('hidden');
        } else if (data.refreshStatus === 'success_unchanged') {
          document.getElementById('attr-sync-status').innerText = 'محدث ومطابق للمصدر ✓';
        }
      } catch (err) {
        console.log('Background update check skipped:', err);
      }
    }

    async function applyNewUpdates() {
      document.getElementById('update-available-banner').classList.add('hidden');
      await loadProjectDetails(false);
      showToast('تم تحديث البيانات المعروضة بنجاح 🟢', false);
      setTimeout(hideToast, 3000);
    }

    async function triggerSmartRefresh() {
      const btn = document.getElementById('refresh-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div> جاري المزامنة...';
      showToast('جاري الاتصال بمستقل والتأكد من أحدث البيانات (Smart Refresh)...');

      try {
        const res = await fetch('/api/projects/' + projectId + '/refresh', { method: 'POST' });
        const data = await res.json();

        let msg = 'تمت المزامنة بنجاح!';
        let isErr = false;

        switch (data.refreshStatus) {
          case 'success_updated':
            msg = '🟢 تم اكتشاف وتحديث بيانات جديدة من المصدر بنجاح!';
            break;
          case 'success_unchanged':
            msg = 'ℹ️ لم تتغير بيانات المشروع في المصدر (تم تحديث وقت المزامنة، بدون تكرار السجل)';
            break;
          case 'created_from_source':
            msg = '⚡ تم جلب وحفظ البيانات من المصدر لأول مرة بنجاح!';
            break;
          case 'auth_failed':
            msg = '⚠️ تعذر تسجيل الدخول أو انتهاء الجلسة مع مستقل';
            isErr = true;
            break;
          case 'network_failed':
            msg = '⚠️ تعذر الاتصال بمستقل، تم الاحتفاظ بالبيانات المحلية الأخيرة';
            isErr = true;
            break;
          case 'parsing_failed':
            msg = '⚠️ تعذر تحليل بيانات صفحة المصدر، تم الاحتفاظ بالبيانات المحلية';
            isErr = true;
            break;
          default:
            msg = 'تمت المزامنة: ' + (data.refreshStatus || 'مكتمل');
        }

        showToast(msg, isErr);
        setTimeout(hideToast, 4000);
        await loadProjectDetails(false);
      } catch (err) {
        showToast('❌ خطأ في الاتصال بالخادم المحلي', true);
        setTimeout(hideToast, 4000);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> تحديث من المصدر (Smart Refresh)';
      }
    }

    window.onload = async () => {
      await loadProjectDetails(false);
      autoCheckBackgroundUpdate();
    };
  </script>
</body>
</html>`;
}
function getWebDashboardHtml() {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mostaql Market Intelligence Platform</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .card-dark { background-color: #1e293b; border-color: #334155; }
    .spinner { border: 2px solid rgba(255,255,255,0.1); border-left-color: #3b82f6; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body class="p-4 md:p-8 antialiased">
  <div class="max-w-7xl mx-auto space-y-6">

    <!-- Toast Alert -->
    <div id="toast" class="hidden fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 border transition">
      <div id="toast-spinner" class="spinner"></div>
      <span id="toast-message">جاري الاتصال بمستقل وجلب المشاريع الجديدة...</span>
    </div>

    <!-- Header -->
    <div class="card-dark border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ● Local Platform Active (Single Source of Truth)
          </span>
          <span class="text-xs text-amber-400 font-semibold">توقيت الرياض GMT+3 (ar-SA)</span>
        </div>
        <h1 class="text-2xl font-bold mt-2 text-white">منصة استخبارات سوق "مستقل" (Mostaql Intelligence)</h1>
        <p class="text-sm text-slate-400 mt-1">فكرة وهندسة عاطف عقل • محرك بحث متعدد الأبعاد، فلترة متقدمة وتصنيف تقني ذكي محلي بالكامل</p>
      </div>

      <div class="flex items-center gap-3">
        <button onclick="reclassifyAllProjects()" class="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 transition flex items-center gap-1.5">
          🔄 إعادة الفهرسة والتصنيف (Reclassify FTS)
        </button>
        <button id="trigger-btn" onclick="triggerLiveCollection()" class="px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          جلب المشاريع الجديدة من المصدر
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">إجمالي المشاريع في قاعدة البيانات</span>
        <div id="kpi-projects" class="text-3xl font-extrabold text-white mt-1">...</div>
        <span class="text-xs text-emerald-400 mt-1 block">Local Single Source of Truth</span>
      </div>

      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">متوسط العروض لكل مشروع</span>
        <div id="kpi-bids" class="text-3xl font-extrabold text-blue-400 mt-1">...</div>
        <span class="text-xs text-slate-400 mt-1 block">مؤشر المنافسة</span>
      </div>

      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">متوسط الميزانية التقديرية</span>
        <div id="kpi-budget" class="text-3xl font-extrabold text-emerald-400 mt-1">...</div>
        <span class="text-xs text-slate-400 mt-1 block">بالدولار الأمريكي</span>
      </div>

      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">تاريخ آخر تجميع (توقيت الرياض)</span>
        <div id="kpi-last-date" class="text-sm font-bold text-amber-400 mt-2">...</div>
        <span class="text-xs text-slate-400 mt-1 block">GMT+3 (ar-SA)</span>
      </div>
    </div>

    <!-- Quick Filters Panel -->
    <div class="card-dark border rounded-2xl p-5 shadow-xl space-y-4">
      
      <!-- Top Row: Search input + Apply / Clear -->
      <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex-1 w-full flex items-center gap-3">
          <div class="relative w-full">
            <input type="text" id="search-input" onkeyup="if(event.key==='Enter') applyFilters()" placeholder="البحث بالنص الكامل FTS (في العنوان، الوصف، المهارات، اسم العميل والتصنيفات)..." 
                   class="w-full bg-slate-900 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500">
            <span class="absolute right-3 top-2.5 text-slate-500">🔍</span>
          </div>
          <button onclick="applyFilters()" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-md transition whitespace-nowrap">
            تطبيق الفلاتر ⚡
          </button>
          <button onclick="clearFilters()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition whitespace-nowrap">
            إعادة ضبط
          </button>
        </div>
        <button onclick="toggleAdvancedFilters()" class="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap">
          <span id="adv-toggle-text">⚙️ الفلاتر المتقدمة (Advanced Filters) ▼</span>
        </button>
      </div>

      <!-- Quick Filter Options Bar -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 border-t border-slate-800 text-xs">
        
        <!-- Date Preset -->
        <div>
          <label class="block text-slate-400 mb-1 font-semibold">الفترة الزمنية</label>
          <select id="filter-date-preset" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2 focus:outline-none focus:border-blue-500">
            <option value="">كافة الأوقات</option>
            <option value="today">اليوم</option>
            <option value="last_3_days">آخر 3 أيام</option>
            <option value="last_7_days">آخر 7 أيام</option>
            <option value="last_30_days">آخر 30 يوم</option>
            <option value="last_90_days">آخر 90 يوم</option>
            <option value="this_month">هذا الشهر</option>
          </select>
        </div>

        <!-- Budget Range -->
        <div>
          <label class="block text-slate-400 mb-1 font-semibold">الميزانية ($)</label>
          <div class="flex gap-1">
            <input type="number" id="filter-budget-min" placeholder="الأدنى" onchange="applyFilters()" class="w-1/2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2 text-xs">
            <input type="number" id="filter-budget-max" placeholder="الأقصى" onchange="applyFilters()" class="w-1/2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2 text-xs">
          </div>
        </div>

        <!-- Bids Count Presets -->
        <div>
          <label class="block text-slate-400 mb-1 font-semibold">عدد العروض</label>
          <select id="filter-bids-preset" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2 focus:outline-none focus:border-blue-500">
            <option value="">جميع العروض</option>
            <option value="0">بدون عروض (0)</option>
            <option value="1-5">1 إلى 5 عروض</option>
            <option value="6-10">6 إلى 10 عروض</option>
            <option value="11-20">11 إلى 20 عرض</option>
            <option value="21-50">21 إلى 50 عرض</option>
            <option value="50+">أكثر من 50 عرض</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-slate-400 mb-1 font-semibold">حالة المشروع</label>
          <select id="filter-status" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2 focus:outline-none focus:border-blue-500">
            <option value="">جميع الحالات</option>
            <option value="مفتوح">مفتوح</option>
            <option value="قيد التنفيذ">قيد التنفيذ</option>
            <option value="مغلق">مغلق</option>
          </select>
        </div>

        <!-- Technology Multi Select & Match Mode -->
        <div class="col-span-2">
          <div class="flex justify-between items-center mb-1">
            <label class="text-slate-400 font-semibold">التقنيات (Technologies)</label>
            <div class="flex items-center gap-2 text-[11px]">
              <span class="text-slate-500">السلوك:</span>
              <label class="cursor-pointer text-blue-400"><input type="radio" name="skillsMatchMode" value="any" checked onchange="applyFilters()"> أي منها (Any)</label>
              <label class="cursor-pointer text-purple-400"><input type="radio" name="skillsMatchMode" value="all" onchange="applyFilters()"> جميعها (All)</label>
            </div>
          </div>
          <select id="filter-skills" multiple onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-1.5 h-16 focus:outline-none focus:border-blue-500 text-xs">
            <option value="laravel">Laravel</option>
            <option value="react">React</option>
            <option value="vue">Vue.js</option>
            <option value="nodejs">Node.js</option>
            <option value="python">Python</option>
            <option value="flutter">Flutter</option>
            <option value="wordpress">WordPress</option>
            <option value="php">PHP</option>
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
          </select>
        </div>

      </div>

      <!-- Advanced Multi-Dimension Filters Drawer -->
      <div id="advanced-filters-drawer" class="hidden pt-4 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-900/40 p-4 rounded-xl">
        
        <div>
          <label class="block text-slate-400 mb-1 font-semibold">المجال (Domain)</label>
          <select id="filter-domain" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="">جميع المجالات</option>
            <option value="software">برمجيات وتطوير (Software)</option>
            <option value="design">تصميم ووسائط (Design)</option>
            <option value="marketing">تسويق ومبيعات (Marketing)</option>
            <option value="writing">كتابة وترجمة (Writing)</option>
            <option value="consulting">أعمال واستشارات (Consulting)</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">نوع الخدمة (Service Type)</label>
          <select id="filter-service-type" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="">جميع الخدمات</option>
            <option value="development">تطوير وبرمجة</option>
            <option value="design">تصميم واجهات وتجربة UI/UX</option>
            <option value="maintenance">صيانة ودعم فني</option>
            <option value="integration">ربط وتكامل أنظمة</option>
            <option value="consulting">استشارات تقنية</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">نوع المشروع (Project Type)</label>
          <select id="filter-project-type" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="">جميع أنواع المشاريع</option>
            <option value="ecommerce">متجر إلكتروني (E-commerce)</option>
            <option value="mobile_app">تطبيق جوال (Mobile App)</option>
            <option value="web_app">تطبيق ويب (Web App)</option>
            <option value="erp">نظام ERP وإدارة</option>
            <option value="crm">نظام CRM</option>
            <option value="wordpress_site">موقع ووردبريس</option>
            <option value="api">واجهة API</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">طبيعة العمل (Work Type)</label>
          <select id="filter-work-type" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="">جميع أنواع العمل</option>
            <option value="new_dev">تطوير جديد من الصفر</option>
            <option value="modification">تعديل وتطوير ميزات</option>
            <option value="bug_fix">إصلاح أعطال ومشكلات</option>
            <option value="migration">نقل وتحويل نظام</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">الترتيب حسب (Sort By)</label>
          <select id="filter-sort-by" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="published_at">الأحدث نشرًا أولًا (Default)</option>
            <option value="budget">الميزانية التقديرية</option>
            <option value="bids_count">عدد العروض</option>
            <option value="updated_at">تاريخ آخر تحديث</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">اتجاه الترتيب (Order)</label>
          <select id="filter-sort-order" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="desc">تنازلي (الأعلى / الأحدث)</option>
            <option value="asc">تصاعدي (الأقل / الأقدم)</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">مستوى المنافسة (Competition)</label>
          <select id="filter-competition" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="">جميع المستويات</option>
            <option value="very_low">منخفضة جداً (0-2 عروض)</option>
            <option value="low">منخفضة (3-10 عروض)</option>
            <option value="medium">متوسطة (11-25 عرض)</option>
            <option value="high">مرتفعة (26-50 عرض)</option>
            <option value="very_high">مرتفعة جداً (+50 عرض)</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-semibold">حالة اكتمال البيانات</label>
          <select id="filter-completeness" onchange="applyFilters()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl p-2">
            <option value="">جميع البيانات</option>
            <option value="complete">بيانات تفصيلية مكتملة (Complete)</option>
            <option value="discovered">بيانات الفهرس فقط (Discovered)</option>
          </select>
        </div>

      </div>

    </div>

    <!-- Active Filters Tags Bar -->
    <div id="active-filters-tags" class="hidden flex flex-wrap items-center gap-2 text-xs">
      <span class="text-slate-400 font-bold">الفلاتر النشطة:</span>
      <div id="tags-container" class="flex flex-wrap gap-2"></div>
    </div>

    <!-- Projects Table Explorer -->
    <div class="card-dark border rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-white">مستكشف المشاريع الذكي (Project Explorer)</h2>
          <p class="text-xs text-slate-400">استعلام محلي محصن بالكامل - 0 Network Calls أثناء البحث والفلترة (توقيت الرياض GMT+3)</p>
        </div>
        <span id="projects-count-label" class="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full">
          جاري التحميل...
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-right text-sm border-collapse">
          <thead>
            <tr class="border-b border-slate-700 text-slate-400 bg-slate-900/50">
              <th class="p-3 font-semibold">المعرف</th>
              <th class="p-3 font-semibold">عنوان المشروع والتقنيات</th>
              <th class="p-3 font-semibold">تاريخ النشر (GMT+3)</th>
              <th class="p-3 font-semibold">العروض والمنافسة</th>
              <th class="p-3 font-semibold">الميزانية التقديرية</th>
              <th class="p-3 font-semibold">الحالة والاكتمال</th>
              <th class="p-3 font-semibold">الإجراء والتفاصيل</th>
            </tr>
          </thead>
          <tbody id="projects-table-body" class="divide-y divide-slate-800">
            <!-- Dynamic rows -->
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div class="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
        <button id="prev-page-btn" onclick="changePage(-1)" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 font-semibold">السابقة</button>
        <span id="pagination-label" class="font-bold text-slate-300">صفحة 1</span>
        <button id="next-page-btn" onclick="changePage(1)" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 font-semibold">التالية</button>
      </div>
    </div>

  </div>

  <script>
    let currentPage = 1;
    const riyadhTzOptions = { timeZone: 'Asia/Riyadh' };

    function formatRiyadhDate(dateStr) {
      if (!dateStr) return 'غير محدد';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'غير محدد';
      return d.toLocaleDateString('ar-SA', { ...riyadhTzOptions, year: 'numeric', month: 'numeric', day: 'numeric' });
    }

    function formatRiyadhDateTime(dateStr) {
      if (!dateStr) return 'غير محدد';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'غير محدد';
      return d.toLocaleString('ar-SA', { ...riyadhTzOptions, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function toggleAdvancedFilters() {
      const drawer = document.getElementById('advanced-filters-drawer');
      const toggleText = document.getElementById('adv-toggle-text');
      if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        toggleText.innerText = '⚙️ إخفاء الفلاتر المتقدمة ▲';
      } else {
        drawer.classList.add('hidden');
        toggleText.innerText = '⚙️ الفلاتر المتقدمة (Advanced Filters) ▼';
      }
    }

    function showToast(msg, isError = false) {
      const toast = document.getElementById('toast');
      const msgEl = document.getElementById('toast-message');
      const spinner = document.getElementById('toast-spinner');
      toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 border transition ' +
        (isError ? 'bg-rose-900/90 text-rose-200 border-rose-700' : 'bg-slate-900/95 text-white border-blue-500');
      msgEl.innerText = msg;
      spinner.style.display = isError ? 'none' : 'block';
      toast.classList.remove('hidden');
    }

    function hideToast() {
      document.getElementById('toast').classList.add('hidden');
    }

    async function triggerLiveCollection() {
      const btn = document.getElementById('trigger-btn');
      btn.disabled = true;
      btn.classList.add('opacity-50');
      showToast('جاري الاتصال بمستقل وجلب المشاريع الجديدة حتى اليوم...');

      try {
        const res = await fetch('/api/collection/trigger', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
          showToast(data.message, false);
          setTimeout(hideToast, 4000);
          await loadDashboardData();
        } else {
          showToast('خطأ أثناء الجمع: ' + (data.error || 'فشل الاتصال'), true);
          setTimeout(hideToast, 5000);
        }
      } catch (err) {
        showToast('خطأ في الاتصال بالخادم المحلي', true);
        setTimeout(hideToast, 5000);
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
      }
    }

    async function reclassifyAllProjects() {
      showToast('جاري إعادة تشغيل محرك التصنيف والفهرسة FTS...');
      try {
        const res = await fetch('/api/taxonomy/reclassify', { method: 'POST' });
        const data = await res.json();
        showToast(data.message, !data.success);
        setTimeout(hideToast, 4000);
        fetchProjects();
      } catch (err) {
        showToast('فشل إعادة التصنيف', true);
        setTimeout(hideToast, 4000);
      }
    }

    async function loadDashboardData() {
      try {
        const res = await fetch('/api/stats/overview');
        const data = await res.json();
        document.getElementById('kpi-projects').innerText = data.totalProjects.toLocaleString('ar-EG');
        document.getElementById('kpi-bids').innerText = data.averageBids + ' عروض';
        document.getElementById('kpi-budget').innerText = data.averageBudgetUsd > 0 ? '$' + data.averageBudgetUsd : 'غير محدد';
        document.getElementById('kpi-last-date').innerText = formatRiyadhDateTime(data.lastCollectionAt);
      } catch (err) {
        console.error('Error loading KPIs:', err);
      }
      loadFiltersFromUrl();
      fetchProjects();
    }

    function getSelectedSkills() {
      const select = document.getElementById('filter-skills');
      return Array.from(select.selectedOptions).map(opt => opt.value);
    }

    function applyFilters() {
      currentPage = 1;
      updateUrlState();
      fetchProjects();
    }

    function clearFilters() {
      document.getElementById('search-input').value = '';
      document.getElementById('filter-date-preset').value = '';
      document.getElementById('filter-budget-min').value = '';
      document.getElementById('filter-budget-max').value = '';
      document.getElementById('filter-bids-preset').value = '';
      document.getElementById('filter-status').value = '';
      document.getElementById('filter-domain').value = '';
      document.getElementById('filter-service-type').value = '';
      document.getElementById('filter-project-type').value = '';
      document.getElementById('filter-work-type').value = '';
      document.getElementById('filter-sort-by').value = 'published_at';
      document.getElementById('filter-sort-order').value = 'desc';
      document.getElementById('filter-competition').value = '';
      document.getElementById('filter-completeness').value = '';

      const skillsSelect = document.getElementById('filter-skills');
      for (let i = 0; i < skillsSelect.options.length; i++) {
        skillsSelect.options[i].selected = false;
      }

      applyFilters();
    }

    function updateUrlState() {
      const params = new URLSearchParams();
      const q = document.getElementById('search-input').value.trim();
      if (q) params.set('q', q);

      const datePreset = document.getElementById('filter-date-preset').value;
      if (datePreset) params.set('datePreset', datePreset);

      const bMin = document.getElementById('filter-budget-min').value;
      if (bMin) params.set('budgetMin', bMin);

      const bMax = document.getElementById('filter-budget-max').value;
      if (bMax) params.set('budgetMax', bMax);

      const bidsPreset = document.getElementById('filter-bids-preset').value;
      if (bidsPreset) params.set('bidsPreset', bidsPreset);

      const status = document.getElementById('filter-status').value;
      if (status) params.set('status', status);

      const skills = getSelectedSkills();
      if (skills.length > 0) {
        params.set('skills', skills.join(','));
        const matchMode = document.querySelector('input[name="skillsMatchMode"]:checked')?.value || 'any';
        params.set('skillsMatchMode', matchMode);
      }

      const domain = document.getElementById('filter-domain').value;
      if (domain) params.set('domain', domain);

      const serviceType = document.getElementById('filter-service-type').value;
      if (serviceType) params.set('serviceType', serviceType);

      const projectType = document.getElementById('filter-project-type').value;
      if (projectType) params.set('projectType', projectType);

      const workType = document.getElementById('filter-work-type').value;
      if (workType) params.set('workType', workType);

      const sortBy = document.getElementById('filter-sort-by').value;
      if (sortBy && sortBy !== 'published_at') params.set('sortBy', sortBy);

      const sortOrder = document.getElementById('filter-sort-order').value;
      if (sortOrder && sortOrder !== 'desc') params.set('sortOrder', sortOrder);

      const comp = document.getElementById('filter-competition').value;
      if (comp) params.set('competitionLevel', comp);

      const compStatus = document.getElementById('filter-completeness').value;
      if (compStatus) params.set('completenessStatus', compStatus);

      if (currentPage > 1) params.set('page', currentPage);

      const newRelativePathQuery = window.location.pathname + '?' + params.toString();
      history.pushState(null, '', newRelativePathQuery);
    }

    function loadFiltersFromUrl() {
      const params = new URLSearchParams(window.location.search);
      if (params.has('q')) document.getElementById('search-input').value = params.get('q');
      if (params.has('datePreset')) document.getElementById('filter-date-preset').value = params.get('datePreset');
      if (params.has('budgetMin')) document.getElementById('filter-budget-min').value = params.get('budgetMin');
      if (params.has('budgetMax')) document.getElementById('filter-budget-max').value = params.get('budgetMax');
      if (params.has('bidsPreset')) document.getElementById('filter-bids-preset').value = params.get('bidsPreset');
      if (params.has('status')) document.getElementById('filter-status').value = params.get('status');
      if (params.has('domain')) document.getElementById('filter-domain').value = params.get('domain');
      if (params.has('serviceType')) document.getElementById('filter-service-type').value = params.get('serviceType');
      if (params.has('projectType')) document.getElementById('filter-project-type').value = params.get('projectType');
      if (params.has('workType')) document.getElementById('filter-work-type').value = params.get('workType');
      if (params.has('sortBy')) document.getElementById('filter-sort-by').value = params.get('sortBy');
      if (params.has('sortOrder')) document.getElementById('filter-sort-order').value = params.get('sortOrder');
      if (params.has('competitionLevel')) document.getElementById('filter-competition').value = params.get('competitionLevel');
      if (params.has('completenessStatus')) document.getElementById('filter-completeness').value = params.get('completenessStatus');
      if (params.has('page')) currentPage = parseInt(params.get('page'), 10) || 1;

      if (params.has('skillsMatchMode')) {
        const radio = document.querySelector(\`input[name="skillsMatchMode"][value="\${params.get('skillsMatchMode')}"]\`);
        if (radio) radio.checked = true;
      }

      if (params.has('skills')) {
        const skillsArr = params.get('skills').split(',');
        const skillsSelect = document.getElementById('filter-skills');
        for (let i = 0; i < skillsSelect.options.length; i++) {
          if (skillsArr.includes(skillsSelect.options[i].value)) {
            skillsSelect.options[i].selected = true;
          }
        }
      }
    }

    async function fetchProjects() {
      const searchUrl = '/api/projects' + window.location.search;

      try {
        const res = await fetch(searchUrl);
        const data = await res.json();

        document.getElementById('projects-count-label').innerText = data.total.toLocaleString('ar-EG') + ' مشروع مطبق للمجال والفلترة';
        document.getElementById('pagination-label').innerText = 'صفحة ' + data.page + ' من ' + data.totalPages;

        document.getElementById('prev-page-btn').disabled = data.page <= 1;
        document.getElementById('next-page-btn').disabled = data.page >= data.totalPages;

        const tbody = document.getElementById('projects-table-body');
        tbody.innerHTML = '';

        if (data.items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500 font-semibold">لا توجد مشاريع مطابقة لفلاتر البحث الحالية في قاعدة البيانات المحلية</td></tr>';
          return;
        }

        data.items.forEach(p => {
          const row = document.createElement('tr');
          row.className = 'hover:bg-slate-800/60 transition border-b border-slate-800/50';

          const obs = p.latestObservation;
          let budgetStr = 'غير محدد';
          if (obs) {
            if (obs.budgetMinUsd && obs.budgetMaxUsd) budgetStr = '$' + obs.budgetMinUsd + ' - $' + obs.budgetMaxUsd;
            else if (obs.budgetAvgUsd) budgetStr = '$' + obs.budgetAvgUsd;
          }

          const bidsCount = obs ? obs.bidsCount : 0;
          let compBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          let compText = 'منافسة منخفضة جداً';

          if (bidsCount >= 50) { compBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20'; compText = 'منافسة مرتفعة جداً (+50)'; }
          else if (bidsCount >= 26) { compBadgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20'; compText = 'منافسة مرتفعة'; }
          else if (bidsCount >= 11) { compBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20'; compText = 'منافسة متوسطة'; }
          else if (bidsCount >= 3) { compBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20'; compText = 'منافسة منخفضة'; }

          const skillsPills = (p.skills || []).slice(0, 3).map(s => \`<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">\${s}</span>\`).join(' ');

          row.innerHTML = \`
            <td class="p-3 font-mono text-xs text-slate-400">\${p.sourceProjectId}</td>
            <td class="p-3 font-semibold text-white max-w-xs">
              <a href="/projects/\${p.sourceProjectId}" class="hover:text-blue-400 transition leading-snug block">\${p.title}</a>
              <div class="flex flex-wrap gap-1 mt-1">\${skillsPills}</div>
            </td>
            <td class="p-3 text-xs text-amber-300">\${formatRiyadhDate(p.publishedAt)}</td>
            <td class="p-3 text-xs">
              <span class="font-bold text-slate-200 block">\${bidsCount} عروض</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] border mt-1 inline-block \${compBadgeClass}">\${compText}</span>
            </td>
            <td class="p-3 font-bold text-emerald-400 text-xs">\${budgetStr}</td>
            <td class="p-3 text-xs">
              <span class="px-2 py-1 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 font-semibold">\${p.status}</span>
            </td>
            <td class="p-3 text-xs">
              <a href="/projects/\${p.sourceProjectId}" class="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition font-bold inline-flex items-center gap-1">
                التفاصيل ↗
              </a>
            </td>
          \`;
          tbody.appendChild(row);
        });

      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    }

    function changePage(delta) {
      currentPage += delta;
      updateUrlState();
      fetchProjects();
    }

    window.onload = () => {
      loadDashboardData();
    };
  </script>
</body>
</html>`;
}
//# sourceMappingURL=server.js.map