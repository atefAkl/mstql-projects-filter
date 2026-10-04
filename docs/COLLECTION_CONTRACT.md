# وثيقة عقد البيانات والتحويل (Project Data Contract)

تحدد هذه الوثيقة العقد الصارم لاستخراج وتحويل كل حقل من مصادر منصة مستقل، مع تحديد أنواع البيانات الخام والمتطابقة، والحقول الإجبارية والاختيارية، وقواعد المعالجة والتسديد.

---

## 1. جدول مواصفات الحقول (Field Specification Table)

| اسم الحقل (Field) | المصدر في HTML | النوع الخام (Raw Type) | النوع المنظم (Normalized) | إجباري / اختياري | قاعدة المعالجة والتحويل (Parsing & Normalization Rule) | Validation / Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `source_project_id` | `href` / `URL` | String | String | **إجباري** | استخراج السلسلة الرقمية من الرابط باستخدام Regex: `/project\/(\d+)-/` | يجب أن يكون نصًا رقمياً غير فارغ، وإلا يرفض الكائن |
| `source_url` | `a.details-url` / `href` | String | String (URL) | **إجباري** | دمج الرابط النسبي مع الأصل إذا لزم الأمر: `https://mostaql.com/project/{id}-{slug}` | يجب أن يبدأ بـ `https://mostaql.com/project/` |
| `title` | `h2 a` | String (HTML) | String (Clean Text) | **إجباري** | إزالة أي وسوم HTML وتنظيف الفراغات الزائدة | نص غير فارغ |
| `description` | `.project__brief` / `#projectDetailsTab` | String (HTML/Text) | String (Text) | اختياري | إزالة وسم الخطوط والـ Scripts والاحتفاظ بالنص العربي الخام | إرجاع `NULL` إذا لم يوجد |
| `published_at` | `<time itemprop="datePublished">` | String (`datetime`) | Date (ISO UTC) | **إجباري** | قراءة الخاصية `datetime="2026-10-04 14:07:16"` وتحويلها لمجهول الزون UTC | تحويل صيغة `YYYY-MM-DD HH:mm:ss` لـ `Date`؛ Fallback هو `NULL` مع تسجيل Parse Issue |
| `budget_raw` | `data-type="project-budget_range"` | String | String | اختياري | استخراج النص كما هو (مثال: `$100.00 - $250.00`) | الاحتفاظ بالقيمة الخام |
| `budget_min_usd` | `data-type="project-budget_range"` | String | Float | اختياري | استخراج الحد الأدنى بالدولار من السلسلة الخام (مثال: `$100.00` -> `100.0`) | `NULL` إذا كانت الميزانية غير محددة |
| `budget_max_usd` | `data-type="project-budget_range"` | String | Float | اختياري | استخراج الحد الأقصى بالدولار من السلسلة الخام (مثال: `$250.00` -> `250.0`) | `NULL` |
| `budget_avg_usd` | `data-type="project-budget_range"` | String | Float | اختياري | حساب المتوسّط: `(budget_min + budget_max) / 2` | `NULL` |
| `bids_count` | `li.text-muted` / `div#project-bids` | String | Integer | **إجباري** | تحويل الكلمات العربية لأرقام (`أضف أول عرض` -> 0, `عرض واحد` -> 1, `عرضان` -> 2, `15 عرضًا` -> 15) | Default = 0 عند تعذر القراءة |
| `execution_time_raw`| `meta-row: مدة التنفيذ` | String | String | اختياري | استخراج النص الخام (مثال: `10 أيام`) | `NULL` |
| `execution_days` | `meta-row: مدة التنفيذ` | String | Integer | اختياري | استخراج الرقم الصحيح بـ Regex: `/(\d+)/` | `NULL` |
| `client_name` | `i.fa-user` / `.profile__name` | String | String | اختياري | استخراج النص داخل الوسم `<bdi>` | `NULL` |
| `client_profile_url`| `.profile-details a` | String | String (URL) | اختياري | استخراج الرابط المطابق لـ `https://mostaql.com/u/{username}` | `NULL` |
| `status` | `bdi.label-prj-open` / `meta-row` | String | String | **إجباري** | استخراج حالة المشروع (`مفتوح`, `قيد التنفيذ`, `مغلق`, `مكتمل`) | Default = `"مفتوح"` |
| `skills` | `ul.skills a.tag bdi` | Array<String> | Array<String> | اختياري | قراءة مصفوفة وسوم المهارات | مصفوفة فارغة `[]` عند الانعدام |

---

## 2. قواعد منع الفلترة المسبقة (No Pre-Filtering Policy)

* يتم **تسجيل وحفظ كل مشروع مكتشف** بغض النظر عن قيم الميزانية أو المهارات أو عدد العروض.
* يتم التعامل مع الحقول الاختيارية بحفظ `NULL` بدلاً من افتراض قيم وهمية.
* لا يتم مسح أو إلغاء أي مشروع مكرر برقم `source_project_id`؛ بل يتم حفظ الملاحظة الزمنيّة الجديدة بجدول `project_observations`.
