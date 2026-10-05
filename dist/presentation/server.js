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
const MostaqlHtmlCollectorAdapter_1 = require("../infrastructure/collectors/MostaqlHtmlCollectorAdapter");
const ProcessCollectionItemUseCase_1 = require("../application/use-cases/ProcessCollectionItemUseCase");
const DailyCollectionUseCase_1 = require("../application/use-cases/DailyCollectionUseCase");
const DailyScheduler_1 = require("../application/schedulers/DailyScheduler");
const GetAndRefreshProjectUseCase_1 = require("../application/use-cases/GetAndRefreshProjectUseCase");
const BackfillIncompleteProjectsUseCase_1 = require("../application/use-cases/BackfillIncompleteProjectsUseCase");
function createServer(dbPath) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const appDb = new Database_1.AppDatabase(dbPath);
    const db = appDb.getRawConnection();
    const projectRepo = new SqliteProjectRepository_1.SqliteProjectRepository(db);
    const runRepo = new SqliteCollectionRunRepository_1.SqliteCollectionRunRepository(db);
    const collector = new MostaqlHtmlCollectorAdapter_1.MostaqlHtmlCollectorAdapter({ minDelayMs: 1000, maxDelayMs: 1500 });
    const processItemUseCase = new ProcessCollectionItemUseCase_1.ProcessCollectionItemUseCase(projectRepo);
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
                isRunning: DailyCollectionUseCase_1.DailyCollectionUseCase.isRunning(),
                latestRun,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 2. Trigger Smart Refresh Action Endpoint (POST /api/projects/:id/refresh)
    apiRouter.post('/projects/:id/refresh', async (req, res) => {
        try {
            const projectId = req.params.id;
            const result = await getAndRefreshUseCase.execute({
                sourceProjectId: projectId,
                forceRefresh: true,
            });
            res.json(result);
        }
        catch (err) {
            console.error('[API Error /projects/:id/refresh]:', err);
            res.status(500).json({ error: err.message });
        }
    });
    // 3. Specific Project Detail & Smart Refresh Endpoint (GET /api/projects/:id)
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
    // 4. Project Explorer Search & Filter API (GET /api/projects)
    apiRouter.get('/projects', async (req, res) => {
        try {
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '15', 10);
            const offset = (page - 1) * limit;
            const q = req.query.q || '';
            const status = req.query.status || '';
            let sql = `
        SELECT p.id, p.source_project_id, p.title, p.source_url, p.published_at, p.first_seen_at, p.last_seen_at, p.status,
               o.bids_count, o.budget_min_usd, o.budget_max_usd, o.budget_avg_usd
        FROM projects p
        LEFT JOIN project_observations o ON o.id = (
          SELECT o2.id FROM project_observations o2
          WHERE o2.project_id = p.id
          ORDER BY o2.observed_at DESC, o2.id DESC
          LIMIT 1
        )
        WHERE 1=1
      `;
            const params = [];
            if (q) {
                sql += ` AND (p.title LIKE ? OR p.description_raw LIKE ? OR p.source_project_id LIKE ?)`;
                params.push(`%${q}%`, `%${q}%`, `%${q}%`);
            }
            if (status) {
                sql += ` AND p.status = ?`;
                params.push(status);
            }
            sql += ` ORDER BY p.published_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);
            const rows = db.prepare(sql).all(...params);
            let countSql = `SELECT COUNT(*) as total FROM projects p WHERE 1=1`;
            const countParams = [];
            if (q) {
                countSql += ` AND (p.title LIKE ? OR p.description_raw LIKE ? OR p.source_project_id LIKE ?)`;
                countParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
            }
            if (status) {
                countSql += ` AND p.status = ?`;
                countParams.push(status);
            }
            const totalRow = db.prepare(countSql).get(...countParams);
            res.json({
                page,
                limit,
                total: totalRow.total,
                totalPages: Math.ceil(totalRow.total / limit) || 1,
                items: rows,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 5. Trigger Live Incremental Collection API
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
    // 6. Collection Runs History API
    apiRouter.get('/runs', async (_req, res) => {
        try {
            const runs = await runRepo.listRuns(20, 0);
            res.json(runs);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 7. Trigger Incomplete Projects Backfill Ingestion API
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
        res.status(404).send(getWebDashboardHtml());
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

      <!-- Attributes KPI Grid (6 Columns) -->
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
          <span class="text-[11px] text-slate-400 block">تاريخ النشر الحقيقي</span>
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

    <!-- Main Content Grid (Description + Skills vs Sidebar) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- Right Main Column (Description & Required Skills) -->
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

      <!-- Left Sidebar Column (Client Info + Historical Observations Timeline) -->
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
            <span>⏱️ السجل الزمني (Snapshots)</span>
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
        document.getElementById('attr-published').innerText = proj.publishedAt ? new Date(proj.publishedAt).toLocaleString('ar-EG') : 'غير محدد';
        document.getElementById('last-sync-time').innerText = proj.lastSourceSyncAt ? new Date(proj.lastSourceSyncAt).toLocaleString('ar-EG') : 'الآن';
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

        // Render timeline
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
                <span class="text-[10px] font-normal text-amber-400">\${new Date(o.observedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                <span>الحالة: <strong class="text-emerald-400">\${o.status}</strong></span>
                <span class="text-[10px] text-slate-500">\${new Date(o.observedAt).toLocaleDateString('ar-EG')}</span>
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
      // Step 1: Render Local DB immediately (Progressive Local-First)
      await loadProjectDetails(false);
      // Step 2: Automatically check Mostaql source in background
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

    <!-- Live Toast Alert -->
    <div id="toast" class="hidden fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 border transition">
      <div id="toast-spinner" class="spinner"></div>
      <span id="toast-message">جاري الاتصال بمستقل وجلب المشاريع الجديدة...</span>
    </div>

    <!-- Header -->
    <div class="card-dark border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ● Local Platform Active (http://localhost:3000)
          </span>
          <span class="text-xs text-slate-400">Phase 4A Smart Refresh Active</span>
        </div>
        <h1 class="text-2xl font-bold mt-2 text-white">منصة استخبارات سوق "مستقل" (Mostaql Intelligence)</h1>
        <p class="text-sm text-slate-400 mt-1">تطبيق محلي لجمع وتحليل الطلب والميزانيات والمنافسة والمستجدات التاريخية واليومية</p>
      </div>

      <div class="flex items-center gap-3">
        <button id="trigger-btn" onclick="triggerLiveCollection()" class="px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          جلب المشاريع الجديدة الآن
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">إجمالي المشاريع في الـ DB</span>
        <div id="kpi-projects" class="text-3xl font-extrabold text-white mt-1">...</div>
        <span class="text-xs text-emerald-400 mt-1 block">محدثة لحظياً</span>
      </div>

      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">متوسط عدد العروض للمشروع</span>
        <div id="kpi-bids" class="text-3xl font-extrabold text-blue-400 mt-1">...</div>
        <span class="text-xs text-slate-400 mt-1 block">مؤشر كثافة المنافسة</span>
      </div>

      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">متوسط الميزانية التقديرية</span>
        <div id="kpi-budget" class="text-3xl font-extrabold text-emerald-400 mt-1">...</div>
        <span class="text-xs text-slate-400 mt-1 block">بالدولار الأمريكي</span>
      </div>

      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">تاريخ أحدث مشروع مجمع</span>
        <div id="kpi-last-date" class="text-sm font-bold text-amber-400 mt-2">...</div>
        <span class="text-xs text-slate-400 mt-1 block">Daily Cutoff Boundary</span>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="card-dark border rounded-2xl p-4 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex-1 w-full flex items-center gap-3">
        <input type="text" id="search-input" onkeyup="if(event.key==='Enter') fetchProjects()" placeholder="ابحث في عنوان أو وصف المشروع (مثال: ERP, Laravel, تطبيق جوال, متجر)..." 
               class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500">
        <button onclick="fetchProjects()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition">
          بحث
        </button>
      </div>

      <div class="flex items-center gap-3 w-full md:w-auto">
        <select id="status-filter" onchange="fetchProjects()" class="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
          <option value="">جميع الحالات</option>
          <option value="مفتوح">مفتوح</option>
          <option value="قيد التنفيذ">قيد التنفيذ</option>
          <option value="مغلق">مغلق</option>
        </select>
      </div>
    </div>

    <!-- Projects Table Explorer -->
    <div class="card-dark border rounded-2xl p-6 shadow-lg space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-white">مستكشف المشاريع (Project Explorer)</h2>
        <span id="projects-count-label" class="text-xs text-slate-400">جاري التحميل...</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-right text-sm border-collapse">
          <thead>
            <tr class="border-b border-slate-700 text-slate-400 bg-slate-900/50">
              <th class="p-3 font-semibold">المعرف</th>
              <th class="p-3 font-semibold">عنوان المشروع</th>
              <th class="p-3 font-semibold">تاريخ النشر الحقيقي</th>
              <th class="p-3 font-semibold">عدد العروض</th>
              <th class="p-3 font-semibold">الميزانية</th>
              <th class="p-3 font-semibold">الحالة</th>
              <th class="p-3 font-semibold">التفاصيل والمصدر</th>
            </tr>
          </thead>
          <tbody id="projects-table-body" class="divide-y divide-slate-800">
            <!-- Dynamic rows -->
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div class="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
        <button id="prev-page-btn" onclick="changePage(-1)" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40">السابقة</button>
        <span id="pagination-label">صفحة 1</span>
        <button id="next-page-btn" onclick="changePage(1)" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40">التالية</button>
      </div>
    </div>

  </div>

  <script>
    let currentPage = 1;

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

    async function loadDashboardData() {
      try {
        const res = await fetch('/api/stats/overview');
        const data = await res.json();
        document.getElementById('kpi-projects').innerText = data.totalProjects.toLocaleString('ar-EG');
        document.getElementById('kpi-bids').innerText = data.averageBids + ' عروض';
        document.getElementById('kpi-budget').innerText = data.averageBudgetUsd > 0 ? '$' + data.averageBudgetUsd : 'غير محدد';
        document.getElementById('kpi-last-date').innerText = data.lastCollectionAt ? new Date(data.lastCollectionAt).toLocaleString('ar-EG') : 'غير محدد';
      } catch (err) {
        console.error('Error loading KPIs:', err);
      }
      fetchProjects();
    }

    async function fetchProjects() {
      const q = document.getElementById('search-input').value;
      const status = document.getElementById('status-filter').value;
      const url = '/api/projects?page=' + currentPage + '&limit=12&q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(status);

      try {
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('projects-count-label').innerText = 'عرض ' + data.items.length + ' من أصل ' + data.total.toLocaleString('ar-EG') + ' مشروع';
        document.getElementById('pagination-label').innerText = 'صفحة ' + data.page + ' من ' + data.totalPages;

        document.getElementById('prev-page-btn').disabled = data.page <= 1;
        document.getElementById('next-page-btn').disabled = data.page >= data.totalPages;

        const tbody = document.getElementById('projects-table-body');
        tbody.innerHTML = '';

        if (data.items.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500">لا توجد مشاريع مطابقة للبحث</td></tr>';
          return;
        }

        data.items.forEach(item => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-800/50 transition';

          const publishedDate = item.published_at ? new Date(item.published_at).toLocaleString('ar-EG') : 'NULL';

          tr.innerHTML = \`
            <td class="p-3 font-mono text-xs text-slate-400">\${item.source_project_id}</td>
            <td class="p-3 font-medium text-white">\${item.title}</td>
            <td class="p-3 text-amber-300 text-xs font-semibold">\${publishedDate}</td>
            <td class="p-3 font-semibold text-blue-400">\${item.bids_count} عروض</td>
            <td class="p-3 text-emerald-400">\${item.budget_avg_usd ? '$' + item.budget_avg_usd : 'حسب الاتفاق'}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">\${item.status}</span></td>
            <td class="p-3 flex items-center gap-3">
              <a href="/projects/\${item.source_project_id}" class="text-xs text-blue-400 font-semibold hover:underline bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                التفاصيل 📄
              </a>
              <a href="\${item.source_url}" target="_blank" class="text-xs text-slate-400 hover:underline">
                مستقل ↗
              </a>
            </td>
          \`;
          tbody.appendChild(tr);
        });

      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    }

    function changePage(delta) {
      currentPage += delta;
      if (currentPage < 1) currentPage = 1;
      fetchProjects();
    }

    window.onload = loadDashboardData;
  </script>
</body>
</html>`;
}
if (require.main === module || process.argv[1]?.includes('server')) {
    const PORT = process.env.PORT || 3000;
    const app = createServer();
    app.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(`Mostaql Market Intelligence Web Server Running!`);
        console.log(`Open in Browser: http://localhost:${PORT}`);
        console.log(`==================================================`);
    });
}
//# sourceMappingURL=server.js.map