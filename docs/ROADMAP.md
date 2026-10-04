# خريطة الطريق ومراحل التنفيذ (Project Roadmap)

## Phase 1: Core Foundation & Domain Setup (الحالية)
- [x] وثائق المشروع والاكتشاف والمعمارية (Discovery, Architecture, ERD, Spec docs).
- [ ] إعداد مشروع Node.js + TypeScript وتثبيت الاعتماديات الأساسية.
- [ ] إعداد قاعدة البيانات SQLite والـ Relational Repositories.
- [ ] بناء كيانات النطاق الأساسية (Entities: Project, Observation, CollectionRun, RawPayload).
- [ ] بناء واجهة الجمع البرمجية الخالدة (Collector Abstractions & Interfaces).
- [ ] كتابة الاختبارات الأولية للنواة وقاعدة البيانات وإثبات عمل Phase 1.

## Phase 2: Historical Collector & Parsing Layer
- [ ] بناء `MostaqlHtmlCollectorAdapter` لقراءة واستخراج صفحات مستقل.
- [ ] بناء محرك منع التكرار (`DeduplicationService`).
- [ ] دعم آلية التجميع التاريخي (Historical Backfill 30 days) مع شرط التوقف الزمني.
- [ ] اختبار واختبارات الـ Unit & Integration للـ Pagination والتجميع التاريخي.

## Phase 3: Daily Collection & Scheduler Architecture
- [ ] بناء جدولة كتل الجمع اليومية التلقائية عند الساعة `00:00:01`.
- [ ] تتبع وتحديث الملاحظات (`ProjectObservations`).
- [ ] شاشة/API متابعة عمليات الجمع (`Collection Monitor`).

## Phase 4: Dynamic Taxonomy & Multi-Dimensional Classification
- [ ] جداول الأبعاد والمصطلحات.
- [ ] محرك القواعد الآلي وتصنيف الثقة (`Confidence Score`).
- [ ] واجهة واختبارات المراجعة البشرية والتعديل.

## Phase 5: Analytics & Trend Engine
- [ ] محرك التجميع الزمني ومجموعات الفترات (Daily, Weekly, Monthly).
- [ ] حساب معدلات النمو، حصة الطلب، الميزانيات، والمنافسة.
- [ ] حساب مؤشر الفرصة الخيارية (`Opportunity Score`).

## Phase 6: Market Intelligence Web UI Dashboard
- [ ] إعداد تطبيق React + Vite + TypeScript + Tailwind CSS RTL.
- [ ] تطوير بطاقات KPI، رسوم الاتجاهات البيانية، مصفوفة الفرص.
- [ ] مستكشف المشاريع المتقدم (`Project Explorer & Filters`).
- [ ] شاشة التفاصيل الكاملة والسجل التاريخي للـ Observations.
