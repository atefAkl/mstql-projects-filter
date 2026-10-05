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

    // Keyword Rule Helper
    const matchRule = (keywords: string[], termCode: string, confidence: number = 0.9) => {
      const termId = termMapByCode.get(termCode);
      if (!termId) return;

      for (const kw of keywords) {
        if (fullText.includes(kw.toLowerCase())) {
          if (!termMatches.has(termId) || termMatches.get(termId)!.confidence < confidence) {
            termMatches.set(termId, {
              termId,
              confidence,
              source: 'rule_engine'
            });
          }
          break;
        }
      }
    };

    // 2. Domain Classification
    matchRule(['برمجة', 'تطوير', 'موقع', 'تطبيق', 'ويب', 'software', 'laravel', 'react', 'api', 'كود'], 'software');
    matchRule(['تصميم', 'شعار', 'هوية', 'فيديو', 'موشن', 'design', 'ui', 'ux', 'logo'], 'design');
    matchRule(['تسويق', 'إعلانات', 'حملة', 'سيو', 'seo', 'facebook', 'marketing'], 'marketing');
    matchRule(['كتابة', 'ترجمة', 'مقال', 'تدقيق', 'writing', 'translation'], 'writing');

    // Default Domain to Software if no domain matched
    const hasDomain = Array.from(termMatches.keys()).some(termId => {
      const t = allTerms.find(term => term.id === termId);
      return t?.dimensionCode === 'domain';
    });
    if (!hasDomain && termMapByCode.has('software')) {
      const domId = termMapByCode.get('software')!;
      termMatches.set(domId, { termId: domId, confidence: 0.5, source: 'default_rule' });
    }

    // 3. Service Type Classification
    matchRule(['تطوير', 'برمجة', 'بناء', 'إنشاء', 'development', 'build'], 'development');
    matchRule(['تصميم', 'واجهة', 'واجهات', 'ui/ux', 'design'], 'design');
    matchRule(['صيانة', 'دعم', 'تحديث', 'اصلاح', 'maintenance', 'fix'], 'maintenance');
    matchRule(['ربط', 'تكامل', 'api', 'integration'], 'integration');
    matchRule(['استشارة', 'دراسة', 'فحص', 'consulting'], 'consulting');

    // 4. Project Type Classification
    matchRule(['متجر', 'سلة', 'زد', 'woocommerce', 'shopify', 'ecommerce', 'e-commerce'], 'ecommerce');
    matchRule(['تطبيق جوال', 'تطبيق هاتف', 'اندرويد', 'ايفون', 'ios', 'android', 'flutter', 'mobile app'], 'mobile_app');
    matchRule(['تطبيق ويب', 'منصة', 'موقع', 'نظام ويب', 'web app'], 'web_app');
    matchRule(['erp', 'نظام ادارة', 'تسيير', 'إدارة شركات'], 'erp');
    matchRule(['crm', 'ادارة عملاء', 'خدمة عملاء'], 'crm');
    matchRule(['ووردبريس', 'wordpress'], 'wordpress_site');
    matchRule(['api', 'ربط واجهة', 'rest api'], 'api');

    // 5. Industry Classification
    matchRule(['تجارة', 'متجر', 'مبيعات', 'retail', 'ecommerce', 'تجزئة'], 'retail');
    matchRule(['طبي', 'صحي', 'عيادة', 'مستشفى', 'healthcare', 'رعاية صحية', 'أطباء', 'عيادات', 'طبية'], 'healthcare');
    matchRule(['تعليم', 'مدرسة', 'جامعة', 'دورة', 'كورس', 'edtech', 'education', 'التعليم'], 'education');
    matchRule(['عقار', 'عقارات', 'اراضي', 'شقق', 'real estate'], 'real_estate');
    matchRule(['مالي', 'بنوك', 'دفع', 'fintech', 'finance', 'فواتير'], 'finance');
    matchRule(['توصيل', 'شحن', 'لوجستي', 'logistics', 'delivery'], 'logistics');

    // 6. Work Type Classification
    matchRule(['جديد', 'بناء من الصفر', 'إنشاء', 'تصميم جديد', 'new'], 'new_dev');
    matchRule(['تعديل', 'إضافة ميزة', 'تطوير على', 'تحسين', 'feature', 'update'], 'modification');
    matchRule(['إصلاح', 'مشكلة', 'عطل', 'خطأ', 'حل مشكلة', 'bug', 'fix'], 'bug_fix');
    matchRule(['نقل', 'تحويل', 'مهاجرة', 'migration'], 'migration');

    // 7. Technology Fallbacks in text
    matchRule(['laravel', 'لارافيل'], 'laravel');
    matchRule(['react', 'رياكت'], 'react');
    matchRule(['vue', 'فيو'], 'vue');
    matchRule(['node', 'نود'], 'nodejs');
    matchRule(['python', 'بايثون'], 'python');
    matchRule(['flutter', 'فلاتر'], 'flutter');
    matchRule(['wordpress', 'ووردبريس', 'وردبريس'], 'wordpress');
    matchRule(['php', 'بي اتش بي'], 'php');
    matchRule(['mysql', 'ماي اس كيو ال'], 'mysql');
    matchRule(['postgresql', 'بوستجري'], 'postgresql');

    // Build unique ProjectClassification entities with project.id + termId
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

    // 8. Update FTS Index Table `projects_fts` (Delete old entry + Insert new)
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
