# نموذج البيانات ومواصفات الجداول (Data Model & ERD)

## 1. مخطط الكيانات والعلاقات المنطقي (Logical ERD)

```mermaid
erDiagram
    COLLECTION_RUNS ||--o{ COLLECTION_ITEMS : contains
    PROJECTS ||--o{ PROJECT_OBSERVATIONS : has
    PROJECTS ||--o{ RAW_PAYLOADS : stores
    PROJECTS ||--o{ PROJECT_CLASSIFICATIONS : receives
    PROJECT_CLASSIFICATIONS }|--|| TAXONOMY_TERMS : points_to
    PROJECT_CLASSIFICATIONS ||--o| CLASSIFICATION_REVIEWS : reviewed_by
    CLIENTS ||--o{ PROJECTS : publishes

    PROJECTS {
        string id PK
        string source_project_id UK
        string title
        string source_url
        datetime published_at
        datetime first_seen_at
        datetime last_seen_at
        string status
    }

    PROJECT_OBSERVATIONS {
        string id PK
        string project_id FK
        datetime observed_at
        int bids_count
        float budget_min
        float budget_max
        string status
        string collection_run_id FK
    }

    RAW_PAYLOADS {
        string id PK
        string project_id FK
        string raw_html
        json raw_metadata
        datetime created_at
    }

    TAXONOMY_TERMS {
        string id PK
        string dimension "Domain, ProductType, Tech, Service, Industry"
        string code UK
        string name_ar
        string name_en
        string parent_id FK
    }

    PROJECT_CLASSIFICATIONS {
        string id PK
        string project_id FK
        string taxonomy_term_id FK
        float confidence_score
        string classified_by "system | human"
        datetime classified_at
    }

    CLASSIFICATION_REVIEWS {
        string id PK
        string classification_id FK
        string original_term_id FK
        string reviewed_term_id FK
        string reviewer_note
        datetime reviewed_at
    }

    COLLECTION_RUNS {
        string id PK
        string type "historical | daily"
        string status "running | completed | failed"
        datetime started_at
        datetime finished_at
        int pages_processed
        int projects_found
        int new_projects_count
        int duplicate_projects_count
        int error_count
        string error_log
    }

    CLIENTS {
        string id PK
        string source_client_id
        string name
        string profile_url
    }
```

---

## 2. مبررات النموذج الكياني (Entity Rationale)

* **الفصل بين `PROJECTS` و `PROJECT_OBSERVATIONS`:**
  المشروع بصفته كيانًا له هوية ثابتة برقم `source_project_id` ومعلومات أساسية (العنوان، الرابط، تاريخ النشر الأول). أما الملاحظات الزمنيّة (`PROJECT_OBSERVATIONS`) فتتبع رصد تطور عدد العروض والحالة بمرور الوقت دون مسح السجل السابق.

* **جدول `RAW_PAYLOADS` المستقل:**
  ضمان استرجاع كامل الاستجابة الخام لتفادي فقدان أي attribute جديد يتم التعرف عليه لاحقاً.

* **جدول `TAXONOMY_TERMS` متعدد الأبعاد:**
  عدم ربط المشاريع بـ `category` و `sub_category` تقليديتين فقط، بل دعم مصطلحات مصفوفة عبر أبعاد مختلفة (Domain, Product Type, Tech Stack, Service, Industry).

* **حفظ تتبع المراجعة `CLASSIFICATION_REVIEWS`:**
  الاحتفاظ بالنتيجة التي وصل لها الذكاء الاصطناعي/النظام القواعدي مقترنة بتعديلات المستخدم البشري لتدريب وإصلاح الخوارزميات لاحقًا بدون ضياع التاريخ.
