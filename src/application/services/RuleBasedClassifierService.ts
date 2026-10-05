import Database from 'better-sqlite3';
import { Project } from '../../core/entities/Project';
import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
import { ProjectClassification } from '../../core/entities/Taxonomy';
import { SkillNormalizerService } from './SkillNormalizerService';

export class RuleBasedClassifierService {
  private normalizer: SkillNormalizerService;

  constructor(
    private readonly taxonomyRepo: ITaxonomyRepository,
    private readonly db: Database.Database
  ) {
    this.normalizer = new SkillNormalizerService(taxonomyRepo);
  }

  public async classifyProject(project: Project, skillsTags: string[] = [], clientName?: string): Promise<void> {
    const termMatches = new Map<string, { termId: string; confidence: number; source: string }>();
    const allTerms = await this.taxonomyRepo.getAllTerms();
    const termMapByCode = new Map<string, string>();
    for (const t of allTerms) {
      termMapByCode.set(t.code, t.id);
    }

    const titleLower = project.title.toLowerCase();
    const descLower = (project.descriptionRaw || '').toLowerCase();
    const fullText = `${titleLower} ${descLower}`;

    // 1. Skill Normalization & Technology Classification
    const normalizedSkills = await this.normalizer.normalizeSkills(skillsTags);
    if (normalizedSkills.length > 0) {
      await this.taxonomyRepo.saveProjectSkills(
        project.id,
        normalizedSkills.map(s => ({ skillName: s.rawSkill, canonicalTermId: s.canonicalTermId }))
      );

      for (const s of normalizedSkills) {
        if (s.canonicalTermId) {
          termMatches.set(s.canonicalTermId, {
            termId: s.canonicalTermId,
            confidence: 1.0,
            source: 'source_skill'
          });
        }
      }
    }

    // Helper to add match if term exists
    const addMatch = (termCode: string, confidence: number = 0.9, source: string = 'rule_engine') => {
      const termId = termMapByCode.get(termCode);
      if (!termId) return;
      if (!termMatches.has(termId) || termMatches.get(termId)!.confidence < confidence) {
        termMatches.set(termId, { termId, confidence, source });
      }
    };

    // Helper for multi-phrase context matching
    const matchPhrases = (phrases: string[], termCode: string, confidence: number = 0.9) => {
      for (const phrase of phrases) {
        const pLower = phrase.toLowerCase();
        if (fullText.includes(pLower)) {
          addMatch(termCode, confidence);
          break;
        }
      }
    };

    // --- 2. DOMAIN CLASSIFICATION (Strict Context Evidence) ---
    // Software & Web Domain: Requires explicit software/web engineering terms or normalized tech skills
    const softwarePhrases = [
      'برمجة', 'تطوير موقع', 'تطوير تطبيق', 'موقع إلكتروني', 'موقع الكتروني', 'موقع ويب',
      'تطبيق ويب', 'تطبيق جوال', 'تطبيق هاتف', 'نظام ويب', 'كود برمجي', 'سورس كود',
      'laravel', 'react', 'flutter', 'python', 'nodejs', 'php', 'wordpress', 'mysql', 'api'
    ];
    if (softwarePhrases.some(p => fullText.includes(p))) {
      // Negative check: Exclude purely architectural/civil engineering design projects ("تخطيط هندسي لشقة")
      const isCivilEngineeringOnly = (fullText.includes('هندسي لشقة') || fullText.includes('تصميم معماري') || fullText.includes('تخطيط شقة')) &&
        !fullText.includes('برمجة') && !fullText.includes('موقع إلكتروني') && !fullText.includes('تطبيق');
      
      if (!isCivilEngineeringOnly) {
        addMatch('software', 0.9);
      }
    }

    // Design & Media Domain: Requires UI/UX, graphic design, logo, or video motion terms
    const designPhrases = [
      'تصميم واجهات', 'تصميم ui', 'تصميم ux', 'تصميم هوية', 'تصميم شعار', 'شعار متجر',
      'موشن جرافيك', 'تصميم جرافيك', 'تصميم بنرات', 'تصميم كتالوج', 'ui/ux', 'logo design'
    ];
    if (designPhrases.some(p => fullText.includes(p))) {
      addMatch('design', 0.9);
    }

    // Marketing & Sales Domain: Requires digital marketing, ads, SEO, social media management
    const marketingPhrases = [
      'تسويق إلكتروني', 'تسويق رقمي', 'حملة إعلانية', 'إعلانات ممولة', 'سيو', 'seo',
      'إدارة حسابات التواصل', 'تسويق المحتوى', 'إدارة التسويق', 'مبيعات'
    ];
    if (marketingPhrases.some(p => fullText.includes(p))) {
      addMatch('marketing', 0.9);
    }

    // Writing & Translation Domain: Requires content writing, copywriting, translation, proofreading
    const writingPhrases = [
      'كتابة محتوى', 'كتابة مقالات', 'ترجمة معتمدة', 'ترجمة مقال', 'تدقيق لغوي',
      'صياغة محتوى', 'تفريغ صوتي', 'copywriting', 'content writing', 'translation'
    ];
    if (writingPhrases.some(p => fullText.includes(p))) {
      addMatch('writing', 0.9);
    }

    // Engineering & Architecture Domain (e.g. Project 1282870)
    const engineeringPhrases = [
      'تخطيط هندسي', 'تصميم معماري', 'تصميم داخلي', 'أوتوكاد', 'autocad',
      'هندسة مدنية', 'تخطيط شقة', 'تصميم شقة', 'خارطة هندسية'
    ];
    if (engineeringPhrases.some(p => fullText.includes(p))) {
      addMatch('engineering', 0.9);
    }

    // Business & Consulting Domain: Requires explicit business/management/technical consulting
    const consultingPhrases = [
      'استشارات أعمال', 'استشارات تقنية', 'دراسة جدوى', 'خطة عمل تجارية',
      'استشارة إدارية', 'business consulting', 'technical consulting'
    ];
    if (consultingPhrases.some(p => fullText.includes(p))) {
      addMatch('consulting', 0.9);
    }


    // --- 3. SERVICE TYPE CLASSIFICATION ---
    // Development: Requires programming/building software
    const devPhrases = [
      'تطوير موقع', 'برمجة موقع', 'تطوير تطبيق', 'برمجة تطبيق', 'بناء منصة',
      'تطوير نظام', 'كتابة سكريبت', 'software development', 'web development'
    ];
    if (devPhrases.some(p => fullText.includes(p))) {
      addMatch('srv_development', 0.9);
    }

    // UI/UX Design Service
    const srvDesignPhrases = [
      'تصميم واجهات', 'تصميم ui', 'تصميم ux', 'واجهة مستخدم', 'تجربة مستخدم', 'ui/ux'
    ];
    if (srvDesignPhrases.some(p => fullText.includes(p))) {
      addMatch('srv_design', 0.9);
    }

    // Maintenance & Support Service
    const maintPhrases = [
      'صيانة موقع', 'صيانة تطبيق', 'دعم فني', 'إصلاح أعطال', 'حل مشكلة الكود',
      'تحديث موقع', 'تحديث نظام', 'bug fix', 'maintenance'
    ];
    if (maintPhrases.some(p => fullText.includes(p))) {
      addMatch('srv_maintenance', 0.9);
    }

    // Integration Service: Requires API integration, payment gateway, external system coupling
    const integrationPhrases = [
      'ربط api', 'تكامل أنظمة', 'ربط بوابة دفع', 'ربط متجر', 'ربط منصة', 'api integration'
    ];
    if (integrationPhrases.some(p => fullText.includes(p))) {
      addMatch('srv_integration', 0.9);
    }

    // Consulting Service
    const srvConsultingPhrases = [
      'استشارة تقنية', 'استشارة برمجية', 'تقييم معماري تقني', 'technical consulting'
    ];
    if (srvConsultingPhrases.some(p => fullText.includes(p))) {
      addMatch('srv_consulting', 0.9);
    }


    // --- 4. PROJECT TYPE CLASSIFICATION ---
    // E-commerce: Must be explicitly e-commerce store / platform
    const ecommercePhrases = [
      'متجر إلكتروني', 'متجر الكتروني', 'متاجر إلكترونية', 'سلة', 'زد',
      'woocommerce', 'shopify', 'e-commerce', 'ecommerce'
    ];
    if (ecommercePhrases.some(p => fullText.includes(p))) {
      addMatch('ecommerce', 0.9);
    }

    // Mobile App
    const mobilePhrases = [
      'تطبيق جوال', 'تطبيق هاتف', 'تطبيق اندرويد', 'تطبيق أندرويد', 'تطبيق ايفون',
      'تطبيق آيفون', 'ios app', 'android app', 'mobile app', 'فلاتر'
    ];
    if (mobilePhrases.some(p => fullText.includes(p))) {
      addMatch('mobile_app', 0.9);
    }

    // Web App: Must be explicit web application or web platform (NOT physical location "موقع الأرض" / "موقع شقة"!)
    const webAppPhrases = [
      'تطبيق ويب', 'منصة إلكترونية', 'منصة رقمية', 'موقع إلكتروني', 'موقع الكتروني',
      'موقع ويب', 'نظام ويب', 'web app', 'web application'
    ];
    if (webAppPhrases.some(p => fullText.includes(p))) {
      addMatch('web_app', 0.9);
    }

    // ERP & CRM & API & WordPress
    matchPhrases(['نظام erp', 'برنامج erp', 'نظام تسيير إداري', 'إدارة شركات'], 'erp');
    matchPhrases(['نظام crm', 'إدارة علاقات العملاء', 'برنامج crm'], 'crm');
    matchPhrases(['واجهة api', 'rest api', 'ربط api'], 'api');
    matchPhrases(['موقع ووردبريس', 'موقع وردبريس', 'قالب ووردبريس', 'إضافة ووردبريس', 'wordpress'], 'wordpress_site');


    // --- 5. INDUSTRY CLASSIFICATION (Strict Context Evidence) ---
    // Retail & E-commerce Sector
    const retailPhrases = ['تجارة إلكترونية', 'متجر إلكتروني', 'مبيعات تجزئة', 'متاجر تجزئة', 'retail'];
    if (retailPhrases.some(p => fullText.includes(p))) {
      addMatch('retail', 0.9);
    }

    // Healthcare Sector (Must NOT match generic "طفل"!)
    const healthcarePhrases = [
      'قطاع طبي', 'رعاية صحية', 'مستشفى', 'عيادة طبية', 'مركز طبي',
      'أطباء', 'صيدلية', 'تطبيقات طبية', 'healthcare', 'medical'
    ];
    if (healthcarePhrases.some(p => fullText.includes(p))) {
      addMatch('healthcare', 0.9);
    }

    // Education Sector (Must NOT match generic "طفل" or "باحث"!)
    const educationPhrases = [
      'منصة تعليمية', 'مدرسة', 'جامعة', 'دورة تدريبية', 'مناهج دراسية',
      'نظام تعليمي', 'مؤسسة تعليمية', 'كورس تعليمي', 'edtech', 'education'
    ];
    if (educationPhrases.some(p => fullText.includes(p))) {
      addMatch('education', 0.9);
    }

    // Real Estate Sector
    const realEstatePhrases = [
      'قطاع عقاري', 'عقارات', 'تطوير عقاري', 'تسويق عقاري', 'إدارة أملاك', 'مكتب عقاري', 'real estate'
    ];
    if (realEstatePhrases.some(p => fullText.includes(p))) {
      addMatch('real_estate', 0.9);
    }

    // Finance & Fintech Sector
    const financePhrases = [
      'قطاع مالي', 'تكنولوجيا مالية', 'بنوك', 'خدمات مالية', 'بوابة دفع', 'فواتير إلكترونية', 'fintech', 'finance'
    ];
    if (financePhrases.some(p => fullText.includes(p))) {
      addMatch('finance', 0.9);
    }

    // Logistics & Delivery Sector
    const logisticsPhrases = [
      'شحن وتوصيل', 'خدمات لوجستية', 'تتبع شحنات', 'إدارة أسطول', 'logistics', 'delivery app'
    ];
    if (logisticsPhrases.some(p => fullText.includes(p))) {
      addMatch('logistics', 0.9);
    }


    // --- 6. WORK TYPE CLASSIFICATION ---
    matchPhrases(['جديد من الصفر', 'بناء من الصفر', 'إنشاء جديد', 'موقع جديد', 'تطبيق جديد', 'new development'], 'new_dev');
    matchPhrases(['تعديل على', 'إضافة ميزة', 'تطوير على', 'تحسين موقع', 'تحسين تطبيق', 'feature addition'], 'modification');
    matchPhrases(['إصلاح مشكلة', 'إصلاح عطل', 'حل مشكلة', 'اصلاح الكود', 'bug fix'], 'bug_fix');
    matchPhrases(['نقل موقع', 'تحويل نظام', 'مهاجرة بيانات', 'system migration'], 'migration');


    // --- 7. TECHNOLOGY CLASSIFICATION (From Text Fallback) ---
    const techRegexes: Array<{ code: string; regex: RegExp }> = [
      { code: 'laravel', regex: /\blaravel\b|لارافيل/i },
      { code: 'react', regex: /\breact(?:\.js|js)?\b|رياكت/i },
      { code: 'vue', regex: /\bvue(?:\.js|js)?\b|فيو/i },
      { code: 'nodejs', regex: /\bnode(?:\.js|js)?\b|نود/i },
      { code: 'python', regex: /\bpython\b|بايثون/i },
      { code: 'flutter', regex: /\bflutter\b|فلاتر/i },
      { code: 'wordpress', regex: /\bwordpress\b|ووردبريس|وردبريس/i },
      { code: 'php', regex: /\bphp\b|بي اتش بي/i },
      { code: 'docker', regex: /\bdocker\b|دوكر/i },
      { code: 'mysql', regex: /\bmysql\b|ماي اس كيو ال/i },
      { code: 'postgresql', regex: /\bpostgresql\b|بوستجري/i }
    ];

    for (const t of techRegexes) {
      if (t.regex.test(fullText)) {
        addMatch(t.code, 0.95);
      }
    }

    // Save project classifications
    const classifications: ProjectClassification[] = [];
    for (const match of termMatches.values()) {
      classifications.push(new ProjectClassification({
        id: `cls_${project.id}_${match.termId}`,
        projectId: project.id,
        taxonomyTermId: match.termId,
        confidenceScore: match.confidence,
        classifiedBy: match.source,
        classifiedAt: new Date()
      }));
    }

    await this.taxonomyRepo.saveClassifications(classifications);

    // Update FTS Index Table `projects_fts`
    const termsAssigned = await this.taxonomyRepo.getProjectTerms(project.id);
    const termsStr = termsAssigned.map(t => `${t.nameAr} ${t.nameEn} ${t.code}`).join(' ');
    const skillsStr = normalizedSkills.map(s => `${s.rawSkill} ${s.normalizedName}`).join(' ');

    this.db.prepare(`DELETE FROM projects_fts WHERE project_id = ?`).run(project.id);
    this.db.prepare(`
      INSERT INTO projects_fts (project_id, title, description, skills, client_name, taxonomy_terms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      project.title,
      project.descriptionRaw || '',
      skillsStr,
      clientName || '',
      termsStr
    );
  }
}
