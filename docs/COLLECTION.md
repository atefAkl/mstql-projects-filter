# مواصفات وآلية جمع البيانات (Collection System Specification)

## 1. مسار عملية الجمع (Collection Flow Architecture)

```mermaid
sequenceDiagram
    participant Scheduler as Scheduler / Manual Trigger
    participant JobRunner as Collection Job Runner
    participant Collector as Mostaql HTML Adapter
    participant Parser as HTML Parser & Normalizer
    participant DB as System Database Repository

    Scheduler->>JobRunner: Start Collection (Type: Historical / Daily)
    JobRunner->>DB: Create CollectionRun (status: RUNNING)
    
    loop Pagination Loop
        JobRunner->>Collector: Fetch Page (Page Number N)
        Collector-->>JobRunner: Raw HTML Payload
        JobRunner->>Parser: Parse Projects List & Items
        Parser-->>JobRunner: Parsed Raw Items Array
        
        loop For Each Project Item
            JobRunner->>DB: Check Deduplication (source_project_id)
            alt Project is New
                JobRunner->>DB: Save Raw Payload
                JobRunner->>DB: Save New Project
                JobRunner->>DB: Save Initial Observation
            else Project Exists
                JobRunner->>DB: Save New Observation (Updates, Bids, Status)
            end
        end

        JobRunner->>JobRunner: Evaluate Cutoff Condition
        Note over JobRunner: Historical Stop: published_at < Today - 30 days<br/>Daily Stop: Reached previously indexed project
    end

    JobRunner->>DB: Update CollectionRun (status: COMPLETED, stats...)
```

---

## 2. قواعد منع التكرار وحساب الملاحظات (Deduplication & Observations Rules)

1. **المعرف الأساسي للمصدر (`source_project_id`):** يُسحب مباشرة من رابط صفحة المشروع (مثال: `https://mostaql.com/project/1145920` -> `1145920`).
2. **عند اكتشاف مشروع جديد:**
   * إنشاء سجّل بجدول `projects`.
   * حفظ الاستجابة كاملة بجدول `raw_payloads`.
   * حفظ السجل الزمني الأول بجدول `project_observations`.
3. **عند اكتشاف مشروع مكرر:**
   * عدم تعديل البيانات الأساسية الأولى التي لا تتغير.
   * إضافة سجل جديد بجدول `project_observations` إذا تغير عدد العروض أو ميزانية أو حالة المشروع.
   * تحديث `last_seen_at` بجدول `projects`.

---

## 3. التعامل مع الأخطاء واستعادتها (Fault Tolerance & Error Recovery)

* **تعليق الشبكة / الفشل الفردي:** لا تؤدي أي استجابة خاطئة لصفحة فردية إلى إيقاف العملية؛ يتم تسجيل الخطأ بجدول الـ Log ومتابعة الصفحات التالية.
* **الجدولة الآمنة (Re-entrant Protection):** يمنع النظام تشغيل عمليتي جمع متزامنتين في نفس الوقت عبر الـ `Lock Manager`.
