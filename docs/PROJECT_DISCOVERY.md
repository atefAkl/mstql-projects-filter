# وثيقة اكتشاف وتخطيط المشروع: Mostaql Market Intelligence Platform

---

## 1. فهم المشروع (Project Understanding)

نظام **Mostaql Market Intelligence Platform** ليس مجرد تطبيق CRUD تقليدي لعرض مشاريع "مستقل"، بل هو **نظام تحليل استخبارات السوق (Market Intelligence System for Freelance Project Demand)**.

الهدف الجوهري للنظام هو تحويل بيانات المشاريع المنشورة على منصة مستقل (التاريخية والمتجددة يوميًا) إلى بيانات مهيكلة وقابلة للتحليل الاستكشافي والزمني، بهدف:
* فهم اتجاهات الطلب في السوق العربي للمشاريع الحرة.
* اكتشاف التقنيات والخدمات الناشئة والأكثر طلبًا.
* تحليل مستوى المنافسة ونطاقات الميزانيات الاقتصادية لكل مجال.
* إتاحة اتخاذ قرارات مبنية على بيانات موثوقة لتوجيه قدرات الفريق والخدمات البرمجية المقدمة.

---

## 2. الأهداف الرئيسية (Core Objectives)

1. **الجمع المستقر وغير المكرر (Reliable & Deduplicated Collection):** جمع المشاريع التاريخية (آخر 30 يومًا) واليومية من منصة مستقل، مع الفصل التام بين هوية المشروع (`Project`) والملاحظات الزمنية المتكررة (`Project Observation`).
2. **المعمارية الفصلية المرنة (Local-First Decoupled Architecture):** فصل طبقة جمع البيانات (`Collector Layer`) عن طبقة النطاق والتحليلات (`Domain/Analytics Layer`)، مع دعم تشغيل التطبيق بالكامل محليًا (Local-First).
3. **التصنيف الديناميكي متعدد الأبعاد (Dynamic Multi-Dimensional Taxonomy):** إمكانية تصنيف المشروع عبر أبعاد مختلفة (التقنية، نوع المنتج، مجال الأعمال، طبيعة الخدمة، القطاع الصناعي) دون الاعتماد على تصنيف أحادي ثابت.
4. **محرك التحليل والاتجاهات (Trend & Opportunity Engine):** قياس معدلات النمو (`Growth Rate`)، حصة الطلب (`Demand Share`)، كثافة المنافسة (`Competition`)، وحساب مؤشر الفرصة (`Opportunity Score`).
5. **الفصل المنهجي للحالات (Raw vs Normalized vs Classified vs Analytical):** الحفاظ على البيانات الخام لمواجهة أي تغييرات مستقبليّة بدون الحاجة لإعادة الجمع.

---

## 3. المستخدم المستهدف (Target User)

* **صناع القرار وقادة الفرق البرمجية (Engineering Leads & Founders):** لتحديد المجال التقني والتكنولوجي الأكثر جدارة بالاستثمار.
* **مهندسو المنتجات والحلول (Product Architects & Business Analysts):** لاكتشاف مشاكل الأعمال المتكررة لدى العملاء وتحويلها إلى منتجات جاهزة (SaaS / ERP Modules).
* **المستقلون والشركات البرمجية الناشئة (Agencies & Senior Freelancers):** لتقييم تسعير المشاريع ومستويات المنافسة وتوقيت تقديم العروض.

---

## 4. حالات الاستخدام الرئيسية (Use Cases)

1. **الجمع التاريخي واليوميات (Historical Backfill & Daily Auto-Collection):**
   * تشغيل جمع تاريخي لآخر 30 يومًا بضغطة زر.
   * جدولة زمنية تلقائية يومية عند الساعة `00:00:01` لجمع الجديد فقط.
2. **استكشاف وتحليل المشاريع (Project Exploration & Filter):**
   * البحث المتقدم وتصفية المشاريع بحسب التقنيات، الميزانيات، عدد العروض، حالة المشروع، ومستوى ثقة التصنيف.
3. **إدارة التصنيفات والمراجعة البشرية (Taxonomy Management & Human Review):**
   * استعراض الاقتراحات الآلية لتصنيف المشروع، وتعديلها أو اعتمادها بشريًا مع الاحتفاظ بنتيجة النظام الأصلية.
4. **لوحة تحكم اتجاهات السوق (Market Intelligence Dashboard):**
   * عرض مؤشرات KPI للطلب، ورسوم بيانية للنمو عبر الزمن، ومصفوفة الفرص (Opportunity Matrix: Demand vs Competition vs Budget).
5. **مراقبة عمليات الجمع (Collection Run Monitoring):**
   * متابعة حالة كل تشغيلة جمع، عدد الصفحات، المشاريع الجديدة، المكررة، والأخطاء إن وجدت.

---

## 5. البيانات التي يجب جمعها (Raw Data to Collect)

| الحقل | الوصف | مثال |
| :--- | :--- | :--- |
| `source_project_id` | المعرف الأصلي من موقع مستقل | `1124567` |
| `source_url` | رابط صفحة المشروع | `https://mostaql.com/project/1124567-...` |
| `title` | عنوان المشروع | `تطوير نظام إدارة مخازن باستخدام Laravel` |
| `description_raw` | نص الوصف الكامل بالـ HTML / Text | `نبحث عن مبرمج خبير لبناء WMS...` |
| `published_at_raw` | تاريخ النشر كما ظهر بالموقع | `منذ ساعتين` / `2026-10-04` |
| `budget_raw` | الميزانية المحددة خام | `$500 - $1000` |
| `bids_count_raw` | عدد العروض المقدمة وقت الجمع | `14` |
| `execution_time_raw` | مدة التنفيذ الخام | `15 يوم` |
| `client_name_raw` | اسم صاحب المشروع | `أحمد م.` |
| `client_profile_url` | رابط حساب صاحب المشروع | `https://mostaql.com/u/ahmed_m` |
| `status_raw` | حالة المشروع خام | `مفتوح` / `مغلق` / `قيد التنفيذ` |
| `skills_tags_raw` | المهارت المرفقة من الموقع | `["Laravel", "PHP", "MySQL"]` |
| `raw_payload` | كائن JSON يحتوي كل الـ HTML/Data المكتشفة | `{ ... }` |

---

## 6. البيانات التي يجب اشتقاقها (Derived Data)

* **Normalized Values:**
  * `budget_min_usd`, `budget_max_usd`, `budget_avg_usd`
  * `bids_count` (Integer)
  * `execution_days` (Integer)
  * `published_at` (DateTime ISO UTC)
* **Classified Data (Multi-Dimensional):**
  * `domain`: Business Software, Mobile, Design, Marketing...
  * `product_type`: ERP, CRM, WMS, POS, E-Commerce...
  * `technologies`: Laravel, React, Flutter, Node.js...
  * `services`: Full Development, Bug Fixing, API Integration...
  * `industry`: Logistics, Retail, Healthcare, Education...
* **Analytical Metrics:**
  * `Demand Volume` & `Demand Share`
  * `Growth Rate` (WoW, MoM)
  * `Average Competition (Bids)` & `Average Budget`
  * `Opportunity Score` = \(f(\text{Demand}, \text{Growth}, \text{Budget}, \text{Competition})\)

---

## 7. دورة حياة المشروع داخل النظام (Project Lifecycle)

```
[Mostaql Source HTML]
         │
         ▼ (Fetch & Parse)
[Collection Item (Raw Snapshot)] ── Deduplication Check by source_project_id
         │
         ├───► If New: Create `Project` record + Create initial `ProjectObservation`
         └───► If Existing: Create new `ProjectObservation` (Track changes in bids/status)
         │
         ▼
[Normalization Engine] (Clean Budget, Dates, Status)
         │
         ▼
[Automated Classification Engine] (Multi-dimensional Rules/Patterns -> Confidence Score)
         │
         ▼
[Human Review Layer] (Optional override by User without losing Automated Scores)
         │
         ▼
[Analytics Aggregator Engine] (Update Trends, KPIs, Opportunity Matrix)
```

---

## 8. آلية الجمع التاريخي (Historical Backfill Mechanism)

* **الشرط:** استمرار الـ Pagination تنازليًا من أحدث مشروع إلى أول مشروع يقل تاريخ نشره عن (اليوم - 30 يومًا).
* **إستراتيجية التوقف:** لا نعتمد على عدد الصفحات أو عدد المشاريع بل نعتمد بشكل صريح على `project.published_at < TargetCutoffDate`.
* **المرونة:** تشغيل العملية داخل خلفية النظام (`Worker/Job`) مع التحديث اللحظي لـ `CollectionRun` بالتقدم والأخطاء.

---

## 9. آلية الجمع اليومي (Daily Collection Mechanism)

* **الميعاد:** جدولة عملية خفيفة جدًا تلقائيًا عند `00:00:01` يوميًا.
* **النطاق:** قراءة الصفحات الأولى فقط متسلسلة حتى الوصول إلى مشروع تم جمعه سابقًا وموجود في قاعدة البيانات بحالة مكتملة ومؤرخة بعد `last_successful_collection_at`.
* **إدارة الملاحظات (Observations):** المشاريع الموجودة سابقًا والتي تم المرور عليها يُسجل لها Observation جديد لتتبع التغير في عدد العروض والحالة.

---

## 10. نظام التصنيف الديناميكي (Dynamic Multi-Dimensional Taxonomy)

عدم تقييد النظام بتصنيف شجري أحادي، بل توفير الهيكل التالي:

1. **Category Dimensions (أبعاد التصنيف):**
   * **Domain:** المجال العام.
   * **Product Type:** نوع المنتج.
   * **Technology Stack:** التقنيات المستخدمة.
   * **Service Category:** نوع الخدمة.
   * **Industry:** القطاع الأكاديمي/التجاري.
2. **Rule-Based Engine (المرحلة الأولى):** مطابقة الأنماط (Pattern Matching & Keywords Extraction) على العنوان، الوصف، والوسوم، مع احتساب `confidence_score` لكل بُعد.
3. **Human Review & Feedback:** توفير واجهة تتيح قبول التصنيف الآلي أو تعديله يدوياً وتسجيل ذلك بجدول `classification_reviews`.

---

## 11. نظام تحليل الاتجاهات (Trend Engine)

حساب المؤشرات عبر شريحة زمنية قابلة للتخصيص (Daily, Weekly, Monthly, Quarterly):

* **Demand Share %:** \( \frac{\text{مشاريع التقنية A في الفترة}}{\text{إجمالي المشاريع في الفترة}} \times 100 \)
* **Growth Rate %:** \( \frac{\text{مشاريع الفترة الحالية} - \text{مشاريع الفترة السابقة}}{\text{مشاريع الفترة السابقة}} \times 100 \)
* **Opportunity Score:**
  \[
  \text{Score} = (w_1 \cdot \text{DemandShare}) + (w_2 \cdot \text{GrowthRate}) + (w_3 \cdot \text{NormalizedBudget}) - (w_4 \cdot \text{NormalizedBids})
  \]
  *(حيث الأوزان \(w_1..w_4\) قابلة للتعديل من الإعدادات).*

---

## 12. المخاطر التقنية وتدابير المواجهة (Technical Risks & Mitigations)

| الخطر التقني | تأثيره | تدابير المواجهة المعمارية |
| :--- | :--- | :--- |
| تغيير هيكل HTML لموقع مستقل | فشل الـ Parser وتوقف الجمع | فصل `Collector Source Adapter` عن باقي النظام مع تسجيل محتوى RAW وإطلاق تنبيه فشل الـ Parsing دون إيقاف باقي النظام |
| حظر HTTP Requests / IP Rate Limit | توقف عملية الجمع | استخدام Rate Limiter مع حزم Delay عشوائية وتأخير محاكي للبشر واحترام سياسات الوصول |
| بيانات مفقودة أو ناقصة في المشروع | خطأ في المعالجة | السماح بقيم `NULL` والتأكد من عدم افتراض أي قيمة وهمية وتوثيق مصدر الحقل المفقود |
| تعليق عملية الجمع التاريخي الكبيرة | ضياع التقدم | حفظ البيانات صفحة بصفحة وإمكانية استئناف التشغيلة من حيث توقفت (`Resumeable Collection Runs`) |

---

## 13. القرارات المعمارية المقترحة (Proposed Architecture Decisions)

1. **Backend Stack:** Node.js + TypeScript + NestJS (أو Express مع Clean Architecture) لضمان الفصل التام والتوسع المعماري.
2. **Database:** SQLite عبر Prisma ORM أو Kysely/TypeORM في المرحلة الأولى، مع تصميم جداول حرة ومستقلة تتيح الانتقال إلى PostgreSQL دون تغيير كود الـ Domain.
3. **Frontend Stack:** React + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts/Chart.js، مع دعم كامل للغة العربية والـ RTL.
4. **Architecture Layers:**
   * `Presentation (API & UI)`
   * `Application (Use Cases & Schedulers)`
   * `Domain (Entities, Taxonomy, Trend Calculations)`
   * `Infrastructure (Database Repositories, Collectors, HTTP Clients)`

---

## 14. نطاق المرحلة الأولى (Out of Scope for Phase 1)

1. **عدم الاعتماد على الذكاء الاصطناعي (No Mandatory AI/LLM):** الاعتماد على التصنيف المستند للنعوت والأنماط القواعدية (Rule-Based) مع تجهيز البنية للـ LLM مستقبلاً.
2. **عدم بناء حسابات مستخدمين متعددة (No Multi-Tenancy / Auth):** التطبيق Local Web App شخصي/فريقي.
3. **عدم تضمين خوارزميات Team Fit المتقدمة في النواة:** النواة تركز على بيانات ومؤشرات السوق فقط، وتترك أي مطابقة مع مهارات الفريق كطبقة تحليلية منفصلة لاحقًا.

---
