# وثيقة كشف واستكشاف المصدر (Source Discovery)

## 1. مصدر البيانات ومسار العناوين (Data Source & URLs)

المصدر الرئيسي لبيانات المشاريع هو منصة "مستقل" (Mostaql).

* **عنوان القائمة الرئيسية (Projects Listing):** `https://mostaql.com/projects`
* **نمط التصفح والصفحات (Pagination):** `https://mostaql.com/projects?page={N}` (حيث `N` يبدأ من 1).
* **عنوان صفحة تفاصيل المشروع (Project Detail URL):**
  `https://mostaql.com/project/{source_project_id}-{slug}`
  *مثال:* `https://mostaql.com/project/1282790-%D8%A7%D8%B3%D8%AA%D8%B4%D8%A7%D8%B1%D8%A7%D8%AA-%D8%AA%D8%B3%D9%88%D9%8A%D9%82%D9%8A%D8%A9`

---

## 2. سلوك الصفحات وحزمة النتائج (Pagination & Ordering)

1. **الترتيب الزمني (Reverse-Chronological Ordering):**
   * تظهر المشاريع الأحدث نشرًا في أعلى الصفحة الأولى (`page=1`).
   * تنخفض الأرقام التعريفية للمشاريع (`source_project_id`) والتوارخ كلما تقدمنا في الصفحات (`page=2, page=3, ...`).
2. **سعة الصفحة (Items Per Page):**
   * تحتوي كل صفحة قائمة على **25 مشروعًا**.
3. **اكتشاف نهاية النتائج (End of Results Detection):**
   * وجود عنصر التحكم بالصفحات أو توقف وجود `tr.project-row` في الاستجابة أو الوصول لصفحة فارغة.
4. **حد التوقف الزمني (Time Boundary vs Deduplication):**
   * **Time Boundary (`last_collection_boundary`):** يتم استخدام تاريخ النشر الأصلي `published_at` للمشروع للتحقق مما إذا كان أقدم من الحد المطلوب والتوقف عن إرسال طلبات صفحات جديدة.
   * **Deduplication (`source_project_id`):** عند المرور على مشروع موجود مسبقًا برقم `source_project_id` قبل التوقف الزمني، يتم تحديث `last_seen_at` وإضافة قراءة جديدة `ProjectObservation` دون إنشاء سجل `Project` مكرر.

---

## 3. آلية المعالجة واستخراج البيانات (Parsing Strategy)

تعتمد المنصة على خوادم تقدم HTML جاهز مسبق الصنع (Server-Side Rendered - SSR)، مما يلغي الحاجة لانتظار تشغيل سيناريوهات JavaScript معقدة في المتصفح.

### العناصر الرئيسية في قائمة المشاريع (`tr.project-row`):
* `source_project_id`: يُستخرج من رابط `a.details-url` أو `href="/project/{id}-..."`.
* `title`: العنوان العربي الظاهر في الوسم `h2 a`.
* `published_at`: يُستخرج مباشرة وبشكل موثوق من الخاصية `datetime="YYYY-MM-DD HH:mm:ss"` داخل الوسم `<time itemprop="datePublished">`.
* `bids_count`: يُستخرج من نص العروض (`عرض واحد`, `5 عروض`, `12 عرضًا`, `أضف أول عرض` -> 0).
* `client_name`: يُستخرج من الوسم `<bdi>` بجانب أيقونة المستخدم `fa-user`.
* `description`: الجزء التمهيدي المنشور في `.project__brief`.

### العناصر الإضافية في صفحة التفاصيل (`id="project-meta-panel"`):
* `status`: حالة المشروع (`مفتوح`, `قيد التنفيذ`, `مغلق`, `مكتمل`).
* `budget`: نطاق الميزانية المحددة بالدولار (مثال: `$100.00 - $250.00`).
* `execution_time`: مدة التنفيذ بالأيام (مثال: `10 أيام`).
* `skills/tags`: مصفوفة الوسوم والمهارات المرفقة في قائمة `ul.skills`.

---

## 4. المخاطر والقيود التقنية (Technical Risks)

1. **تغيير تصميم HTML لموقع مستقل:**
   * *المخاطرة:* فشل محرك الـ Regex/DOM Parser.
   * *التدبير:* الاحتفاظ بالصفحة الخام بجدول `raw_payloads` وفصل الـ Parser في طبقة مستقلة تطلق `ParsingException` دون تدمير البيانات المخزنة مسبقاً.
2. **الحظر أو تقييد المعدل (Rate Limiting / Cloudflare Anti-Bot):**
   * *المخاطرة:* حظر طلبات HTTP المتكررة من نفس الـ IP.
   * *التدبير:* استخدام ممر تباطؤ عشوائي (`Randomized Delay 1000ms - 2500ms`) بين الصفحات، وتضمين `User-Agent` مطابق للمتصفحات الحديثة، وتوفير إمكانية استخدام Session Cookies مصرح بها.
