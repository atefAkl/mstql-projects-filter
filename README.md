# منصة تحليل واستخبارات سوق مستقل (Mostaql Market Intelligence Platform)

> **إشعار الملكية والتطوير:**
> **هذا التطبيق فكرة وهندسة وتنفيذ عاطف عقل بمساعدة أنتيجرافيتي (Antigravity) كمساعد ذكاء اصطناعي في كتابة الكود.**

---

## 📌 عن المشروع (Overview)

منصة محليّة متكاملة لجمع وتتبع وتحليل مشاريع منصة **مستقل (Mostaql)** وتوفير استخبارات سوق دقيقة للمستقلين وأصحاب الأعمال.

تعتمد المنصة على نمط **Local-First Architecture**؛ حيث يُعد محرك قاعدة البيانات المحلي المصدر الوحيد للمعلومات (Single Source of Truth) أثناء عمليات التصفح، البحث، الفلترة، والإحصائيات، بينما تظل منصة "مستقل" هي مصدر البيانات الخارجي (External Source of Origin) الذي تتم مزامنته عبر آليات الجمع السريعة والمتدرجة.

---

## 🏗️ البنية المعمارية والقواعد الأساسية (Architecture & Core Principles)

1. **مصدر الحقيقة المحلي (Single Source of Truth):**
   - كافة طلبات الواجهة (Project Explorer، الفلترة، التصفح، التفاصيل) تُعرض فورًا من قاعدة البيانات المحلية (SQLite WAL Mode).
   - لا توجد طلبات جلب حية (Remote Reads) تمنع أو تعطل تصفح المستخدم أثناء البحث والفلترة.

2. **هوية المشروع الموحدة (Canonical Project Identity):**
   - هوية المشروع تعتمد حصرًا على `source_project_id` الفريد الصادر من منصة مستقل.
   - لا يمكن تكرار المشروع في النظام مهما تكررت عمليات التجميع أو التحديث.

3. **آلية التحديث والتتبع الذكي (Progressive Refresh & Observation Snapshots):**
   - تستخدم المنصة آلية التشفير الثنائي SHA-256 لحفظ المحتوى خامًا ومحسّنًا (`rawContentHash` vs `normalizedContentHash`).
   - يُنشأ سجل تغيير تاريخي (Observation) فقط عند اكتشاف تغييرات حقيقية في جوهر بيانات المشروع، مما يمنع التضخم غير المبرر لقاعدة البيانات.

4. **التحديث التدريجي السلس (Progressive Local-First Refresh):**
   - عند دخول المستخدم لصفحة مشروع `/projects/{source_project_id}`، تُعرض البيانات المخزنة محليًا **فورًا**.
   - يتم إطلاق فحص خلفي للمصدر في الخفاء، وفي حال وجود بيانات حديثة، يظهر شريط تنبيه غير مزعج للمستخدم لتحديث الصفحة دون تغيير مفاجئ في الواجهة (No Layout Shift).

5. **محرك التصنيف والبحث النصي (Taxonomy & FTS Engine):**
   - نمط تصنيف متعدد الأبعاد (7 أبعاد: `domain`, `service_type`, `project_type`, `industry`, `work_type`, `technology`, `skill`).
   - توحيد المهارات والتقنيات (Skill Normalization) لدمج الصيغ المختلفة (مثل: `لارافيل` و `Laravel Framework` $\rightarrow$ `Laravel`).
   - محرك بحث نصي كامل **SQLite FTS5** مع دعم الفلترة المركبة وتوقيت الرياض (Asia/Riyadh - GMT+3).

---

## 🚀 كيفية التثبيت والتشغيل (Installation & Setup)

### المتطلبات الأساسية (Prerequisites)
- **Node.js**: الإصدار 18.x أو أحدث.
- **npm**: v9 أو أحدث.

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. بناء المشروع (Build TypeScript)
```bash
npm run build
```

### 3. تشغيل خادم التطبيق والواجهة (Start Web Server & UI)
```bash
npm run server
```
- سيعمل التطبيق على الرابط المحلي: **`http://localhost:3000`**
- يتيح لك الرابط تصفح كافة المشاريع، الفلترة المتقدمة، العرض التفصيلي للمشاريع، وإجراء التحديثات اليدوية والآلية بتوقيت الرياض GMT+3.

---

## 🛠️ أوامر التشغيل والتحكم (Scripts & Commands)

| الأمر (Command) | الوصف (Description) |
| :--- | :--- |
| `npm run server` | تشغيل خادم Express مع الواجهة التفاعلية على المنفذ `3000`. |
| `npm run dev` | تشغيل جامع البيانات اليومي الذكي (Incremental Daily Collector) في بيئة التطوير. |
| `npm test` | تشغيل حزمة الاختبارات الشاملة (49 اختبارًا متكاملاً عبر Vitest). |
| `npm run build` | ترجمة كود TypeScript إلى JavaScript داخل مجلد `dist/`. |

---

## 🔌 واجهات برمجة التطبيقات والخدمات (API Endpoints)

### 📊 تصفح واستعلام المشاريع والفلترة المتقدمة
- `GET /api/projects`: استعلام عن المشاريع المحفوظة مع دعم كامل للفلترة المتقدمة (FTS Text Search، التصنيف متعدد المحاور، الميزانية، مدة التنفيذ، عدد العروض، سلوك التقنيات Match Any/All، وتاريخ النشر بتوقيت الرياض).
- `GET /api/projects/:id`: جلب البيانات الكاملة للمشروع محليًا مع إطلاق فحص الخلفية للتحديث.
- `GET /api/taxonomy`: استرجاع جميع أبعاد ومصطلحات وقواعد توحيد التصنيف المتاحة في النظام.

### 🔄 عمليات الجمع والمزامنة والتصنيف
- `POST /api/projects/:id/refresh`: طلب تحديث يدوي للمشروع المحدد مباشرة من المصدر.
- `POST /api/collector/daily`: إطلاق تشغيل جامع البيانات اليومي (Incremental Daily Collector).
- `POST /api/collector/backfill`: إطلاق طابور استكمال بيانات المشاريع غير المكتملة (Backfill Incomplete Projects).
- `POST /api/taxonomy/reclassify`: إطلاق عملية إعادة تصنيف وفهرسة كافة المشاريع محلياً.

---

## 📂 الهيكل التنظيمي للمشروع (Project Structure)

```text
mostaql.monitor/
├── src/
│   ├── core/                    # Clean Architecture Domain Entities & Interfaces
│   │   ├── entities/            # Project, ProjectObservation, RawPayload, Taxonomy, etc.
│   │   └── interfaces/          # Repositories & Collector Contracts
│   ├── application/             # Use Cases & Orchestration Logic
│   │   ├── services/            # SkillNormalizerService, RuleBasedClassifierService
│   │   ├── use-cases/           # DailyCollection, GetAndRefresh, BackfillIncomplete, etc.
│   │   └── schedulers/          # Daily & Cron Schedulers
│   ├── infrastructure/          # External Integrations & Storage
│   │   ├── collectors/          # Mostaql HTML Parser & Adapters
│   │   ├── database/            # SQLite Connection, Schema Migrations & FTS5
│   │   └── repositories/        # SqliteProjectRepository & SqliteTaxonomyRepository
│   ├── presentation/            # Express Server, REST APIs & Web UI
│   └── shared/                  # Utilities, Hashing, DateUtils (Riyadh GMT+3), Configs
├── tests/                       # Automated Test Suites (Phases 1 - 4C)
├── data/                        # Local SQLite Database Storage
├── dist/                        # Compiled Production JavaScript Output
├── package.json
└── README.md
```

---

## 🧪 الاختبارات والجودة (Testing & Quality Assurance)

تم تطوير النظام وفق منهجية TDD والتأكد من تغطية كافة حالات الاستخدام عبر **49 اختبارًا برمجياً متكاملاً**:
```bash
npm test
```

---

## 📜 الترخيص والملكية ورسائل الإيداع (License & Git Guidelines)

- **الفكرة والهندسة والتنفيذ:** عاطف عقل (Atef Akl)
- **مساعد الذكاء الاصطناعي:** أنتيجرافيتي (Antigravity AI Assistant)
- **لغة التوثيق ورسائل الإيداع (Git Commits):** يتم كتابة جميع رسائل الإيداع والتسليم (Git Commits) باللغة العربية المباشرة والدقيقة.
- جميع الحقوق محفوظة © 2026.
