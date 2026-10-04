# نظام التصنيف والتخريط الديناميكي (Dynamic Taxonomy Specification)

## 1. الأبعاد الخمسة للتصنيف (Five Taxonomy Dimensions)

يسمح النظام بتصنيف كل مشروع برمجيات عبر أبعاد منفصلة بدلاً من التصنيف الشجري الأحادي التقليدي:

1. **التقنيات (Technology Stack):**
   * *أمثلة:* `Laravel`, `React.js`, `Flutter`, `Node.js`, `Python`, `WordPress`, `Docker`, `Vue.js`.
2. **نوع المنتج (Product Type):**
   * *أمثلة:* `ERP`, `CRM`, `WMS (Warehouse)`, `POS (Point of Sale)`, `SaaS Platform`, `E-Commerce Store`, `Mobile App`.
3. **مجال الأعمال (Domain):**
   * *أمثلة:* `Business Software`, `Mobile Solutions`, `Web Engineering`, `Cybersecurity`, `Data & AI`, `DevOps`.
4. **نوع الخدمة (Service Category):**
   * *أمثلة:* `Full Product Development`, `Bug Fixing / Refactoring`, `API Integration`, `UI/UX Design`, `Consulting`.
5. **القطاع (Industry Focus):**
   * *أمثلة:* `Logistics & Supply Chain`, `Healthcare`, `Real Estate`, `Fintech`, `Education`, `Retail`.

---

## 2. محرك التصنيف القوائمي الآلي (Automated Classification Pipeline)

1. **الجمع والنص الخاضع للتحليل:** دمج `title` + `description` + `skills_tags`.
2. **مطابقة الأنماط والكلمات المفتاحية (Pattern Matching):**
   * تطبيق مصفوفة مفردات ومصطلحات مرادفة (`Keyword & Regex Synonyms`).
3. **احتساب درجة الثقة (`confidence_score`):**
   * تطابق وسم صريح ومباشر: `0.95 - 1.0`
   * تطابق عنوان المشروع: `0.85 - 0.94`
   * تطابق سياقي داخل الوصف: `0.60 - 0.84`
4. **المراجعة والتعديل البشري (Human Override):**
   * يمكن للمستخدم قبول النتيجة أو تغييرها، ويسجل النظام ذلك في جدول المراجعات البشرية دون مسح التصنيف الآلي.
