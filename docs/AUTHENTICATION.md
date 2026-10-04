# وثيقة استراتيجية وإدارة الجلسات المصادق عليها (Authentication Architecture)

## 1. نتائج دراسة المصدر والإجابة على الأسئلة الجوهرية

1. **هل تصفح المشاريع يستلزم التسجيل والـ Authentication؟**
   * **النتيجة:** تصفح القوائم العامة وحصول التفاصيل الأساسية للمشاريع متاح علنًا لطلبات الـ Guest HTTP GET.
   * **لكن:** بعض الإجراءات الدقيقة وتفاصيل التواصل والوصول عند تفعيل حماية الحسابات تطلب جلسة مصادق عليها (`hsoub_session`).
2. **نوع الجلسة وآلية المصادقة:**
   * تتم إدارة الجلسة بواسطة كعكات الجلسة (`hsoub_session`, `remember_me`, `_hsoub_session`) الصادرة من Hsoub Single-Sign-On (SSO).
3. **آلية الحماية والـ CSRF:**
   * توجد حماية CSRF في استمارات وإجراءات الموقع عبر الوسوم والتتبع، ولكن لعمليات الـ Read-Only لا يلزم إرسال CSRF token طالما يتم الالتزام بـ GET requests.

---

## 2. المعمارية المقترحة لإدارة الجلسة (Authentication Architecture)

اقترحنا المعمارية المزدوجة الهجينة (**Hybrid HTTP-First with Cookie Provider Adapter**):

```
                               ┌────────────────────────────────┐
                               │     Local Configuration        │
                               │ (.env / local data/session)    │
                               └───────────────┬────────────────┘
                                               │ Cookie injection
                                               ▼
┌──────────────────────────┐       ┌────────────────────────────┐       ┌──────────────────┐
│   CollectionJobRunner    │ ───►  │ Authenticated HTTP Client  │ ───►  │   Mostaql.com    │
│  (Worker & Orchestrator) │       │   (Header & Cookie Inject) │       │   SSR Server     │
└──────────────────────────┘       └───────────────┬────────────┘       └──────────────────┘
                                                   │
                                     Failure / 401 │ 403 / Login Redirect
                                                   ▼
                                   ┌────────────────────────────┐
                                   │  Session Error Classifier  │
                                   └───────────────┬────────────┘
                                                   │
                                                   ▼
                                   ┌────────────────────────────┐
                                   │ Safe Interruption & Alert  │
                                   └────────────────────────────┘
```

### سبب الاختيار والـ Trade-offs:
1. **HTTP Client First (تفضيل خفيف ورعاة أداء):**
   * *الأداء:* أسرع بـ 50 ضعفًا مقارنة بتشغيل متصفح كلي.
   * *استهلاك الموارد:* لا يستهلك ذاكرة RAM كمتصفحات Chrome/Playwright.
2. **Playwright/Browser Fallback Adapter (طبقة احتياطية عند الحاجة المستقبليّة):**
   * يتم الاحتفاظ بتصميم `ICollectorAdapter` كـ Clean Interface، بحيث يمكن تبديل الخادم التكتيكي بـ `PlaywrightCollectorAdapter` مستقبلياً دون المساس بكود الـ Domain أو قواعد البيانات إذا فرض الموقع تحدي JavaScript معقد.

---

## 3. التعامل مع أخطاء الجلسات (Session Error Taxonomy & Handling)

يقوم محرك استخراج البيانات بتصنيف الاستجابات بدقة قبل أي عملية parsing:

| الحالة (Error Case) | المؤشر والاستجابة (Detection Signal) | الإجراء المتخذ في النظام (System Action) |
| :--- | :--- | :--- |
| **Session Expired / Auth Required** | استجابة HTTP 401 / 403 أو التوجيه لرابط يطابق `/login?t=...` | إطلاق استثناء `MostaqlAuthExpiredError` وتوقيف تشغيل `CollectionRun` بأمان وتسجيل الحالة بـ `failed` وإبلاغ المستخدم. |
| **Network Failure** | انقطاع الاتصال (Fetch Failed / ECONNREFUSED) | إعادة المحاولة مرتين (Retry Strategy) مع تأخير عشوائي، وإذا استمر الفشل يتم تسجيل الخطأ ومتابعة الصفحات دون إتلاف البيانات المخزنة. |
| **HTML Parsing Error** | صفحة 200 OK لكن بدون هيكل `tr.project-row` أو تغير فجائي بالوسوم | إطلاق استثناء `MostaqlParsingError` وتجميد السجل مع الاحتفاظ بـ Raw HTML للتصحيح المستقبلي. |
| **Cloudflare Challenge** | الاستجابة تحتوي على نص `Just a moment...` أو كود 429 | إيقاف عملية الجمع تلقائياً لتجنب الحظر، وتنبيه المستخدم لتحديث الـ Cookie. |

---

## 4. الاعتبارات الأمنية لحفظ بيانات الدخول (Security Guidelines)

1. **حظر كامل لاستضافة كلمة السر:** ممنوع منعاً باتاً تخزين Username أو Password داخل السورس كود أو قواعد البيانات أو ملفات Git.
2. **إدارة الكعكات المحلية (Local Cookie Store):**
   * يتم قراءة كعكة الجلسة خيارياً من متغير البيئة `MOSTAQL_SESSION_COOKIE` أو ملف محلي خفي `data/session.json`.
   * يتم إدراج `data/session.json` و `.env` في ملف `.gitignore` لمنع أي تسريب.
