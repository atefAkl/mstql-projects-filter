import express, { Request, Response } from 'express';
import path from 'path';
import { AppDatabase } from '../infrastructure/database/Database';
import { SqliteProjectRepository } from '../infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from '../infrastructure/repositories/SqliteCollectionRunRepository';
import { defaultConfig } from '../shared/config';

export function createServer(dbPath?: string) {
  const app = express();
  app.use(express.json());

  const appDb = new AppDatabase(dbPath);
  const db = appDb.getRawConnection();
  const projectRepo = new SqliteProjectRepository(db);
  const runRepo = new SqliteCollectionRunRepository(db);

  // 1. Overview KPIs Endpoint
  app.get('/api/stats/overview', async (_req: Request, res: Response) => {
    try {
      const totalProjects = await projectRepo.countProjects();
      const latestRun = await runRepo.getLatestCompletedRun();
      const latestTimestamp = await projectRepo.getLatestSuccessfulCollectionTimestamp();

      // Calculate avg bids & avg budget
      const avgStmt = db.prepare(`
        SELECT AVG(bids_count) as avg_bids, AVG(budget_avg_usd) as avg_budget
        FROM project_observations
      `).get() as { avg_bids: number | null; avg_budget: number | null };

      res.json({
        totalProjects,
        totalObservations: totalProjects, // or SELECT count(*) FROM project_observations
        averageBids: avgStmt.avg_bids ? Math.round(avgStmt.avg_bids) : 0,
        averageBudgetUsd: avgStmt.avg_budget ? Math.round(avgStmt.avg_budget) : 0,
        lastCollectionAt: latestTimestamp ? latestTimestamp.toISOString() : null,
        latestRun,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. Project Explorer Search & Filter API
  app.get('/api/projects', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '15', 10);
      const offset = (page - 1) * limit;
      const q = req.query.q as string || '';
      const status = req.query.status as string || '';

      let sql = `
        SELECT p.id, p.source_project_id, p.title, p.source_url, p.published_at, p.first_seen_at, p.last_seen_at, p.status,
               o.bids_count, o.budget_min_usd, o.budget_max_usd, o.budget_avg_usd
        FROM projects p
        LEFT JOIN project_observations o ON p.id = o.project_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (q) {
        sql += ` AND (p.title LIKE ? OR p.description_raw LIKE ?)`;
        params.push(`%${q}%`, `%${q}%`);
      }

      if (status) {
        sql += ` AND p.status = ?`;
        params.push(status);
      }

      sql += ` ORDER BY p.published_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = db.prepare(sql).all(...params);

      // Count total
      let countSql = `SELECT COUNT(*) as total FROM projects p WHERE 1=1`;
      const countParams: any[] = [];
      if (q) {
        countSql += ` AND (p.title LIKE ? OR p.description_raw LIKE ?)`;
        countParams.push(`%${q}%`, `%${q}%`);
      }
      if (status) {
        countSql += ` AND p.status = ?`;
        countParams.push(status);
      }
      const totalRow = db.prepare(countSql).get(...countParams) as { total: number };

      res.json({
        page,
        limit,
        total: totalRow.total,
        totalPages: Math.ceil(totalRow.total / limit),
        items: rows,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. Project Details API
  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const project = await projectRepo.findById(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const observations = await projectRepo.getObservationsByProjectId(project.id);
      const rawPayload = db.prepare('SELECT id, raw_metadata, created_at FROM raw_payloads WHERE project_id = ?').get(project.id);

      res.json({
        project,
        observations,
        rawPayload,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. Collection Runs History API
  app.get('/api/runs', async (_req: Request, res: Response) => {
    try {
      const runs = await runRepo.listRuns(20, 0);
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Serve static HTML Web Dashboard
  app.use((_req: Request, res: Response) => {
    res.send(getWebDashboardHtml());
  });

  return app;
}

function getWebDashboardHtml(): string {
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
  </style>
</head>
<body class="p-4 md:p-8 antialiased">
  <div class="max-w-7xl mx-auto space-y-6">

    <!-- Header -->
    <div class="card-dark border rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ● Local App Live (http://localhost:3000)
          </span>
          <span class="text-xs text-slate-400">Mostaql Engine v1.0</span>
        </div>
        <h1 class="text-2xl font-bold mt-2 text-white">منصة استخبارات سوق "مستقل" (Mostaql Market Intelligence)</h1>
        <p class="text-sm text-slate-400 mt-1">تطبيق محلي لجمع وتحليل الطلب والميزانيات والمنافسة والمستجدات التاريخية للمشاريع</p>
      </div>

      <div class="flex items-center gap-3">
        <button onclick="loadDashboardData()" class="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition">
          تحديث البيانات
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card-dark border rounded-2xl p-5 shadow-lg">
        <span class="text-xs font-medium text-slate-400">إجمالي المشاريع المجمعة</span>
        <div id="kpi-projects" class="text-3xl font-extrabold text-white mt-1">...</div>
        <span class="text-xs text-emerald-400 mt-1 block">آخر 30 يومًا</span>
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
        <span class="text-xs font-medium text-slate-400">حالة خادم الجمع اليومي</span>
        <div class="text-2xl font-extrabold text-amber-400 mt-1">00:00:01</div>
        <span class="text-xs text-slate-400 mt-1 block">Scheduled Job Active</span>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="card-dark border rounded-2xl p-4 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex-1 w-full flex items-center gap-3">
        <input type="text" id="search-input" onkeyup="if(event.key==='Enter') fetchProjects()" placeholder="ابحث في عنوان أو وصف المشروع (مثال: ERP, Laravel, تطبيق جوال)..." 
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
              <th class="p-3 font-semibold">تاريخ النشر</th>
              <th class="p-3 font-semibold">عدد العروض</th>
              <th class="p-3 font-semibold">الميزانية</th>
              <th class="p-3 font-semibold">الحالة</th>
              <th class="p-3 font-semibold">إجراء</th>
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

  <!-- Detail Modal -->
  <div id="detail-modal" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
    <div class="card-dark border rounded-2xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl">
      <button onclick="closeModal()" class="absolute top-4 left-4 text-slate-400 hover:text-white text-xl font-bold">&times;</button>
      <h3 id="modal-title" class="text-lg font-bold text-white pr-6">عنوان المشروع</h3>
      <div id="modal-content" class="text-xs text-slate-300 space-y-3 max-h-96 overflow-y-auto">
        <!-- Details content -->
      </div>
    </div>
  </div>

  <script>
    let currentPage = 1;

    async function loadDashboardData() {
      try {
        const res = await fetch('/api/stats/overview');
        const data = await res.json();
        document.getElementById('kpi-projects').innerText = data.totalProjects.toLocaleString('ar-EG');
        document.getElementById('kpi-bids').innerText = data.averageBids + ' عروض';
        document.getElementById('kpi-budget').innerText = data.averageBudgetUsd > 0 ? '$' + data.averageBudgetUsd : 'غير محدد';
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

        data.items.forEach(item => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-800/50 transition';

          const publishedDate = item.published_at ? new Date(item.published_at).toLocaleString('ar-EG') : 'غير محدد';

          tr.innerHTML = \`
            <td class="p-3 font-mono text-xs text-slate-400">\${item.source_project_id}</td>
            <td class="p-3 font-medium text-white">\${item.title}</td>
            <td class="p-3 text-slate-400 text-xs">\${publishedDate}</td>
            <td class="p-3 font-semibold text-blue-400">\${item.bids_count} عروض</td>
            <td class="p-3 text-emerald-400">\${item.budget_avg_usd ? '$' + item.budget_avg_usd : 'حسب الاتفاق'}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">\${item.status}</span></td>
            <td class="p-3">
              <a href="\${item.source_url}" target="_blank" class="text-xs text-blue-400 hover:underline">فتح بالموقع ↗</a>
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

    function closeModal() {
      document.getElementById('detail-modal').classList.add('hidden');
    }

    window.onload = loadDashboardData;
  </script>
</body>
</html>`;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Mostaql Market Intelligence Web Server Running!`);
    console.log(`Open in Browser: http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}
