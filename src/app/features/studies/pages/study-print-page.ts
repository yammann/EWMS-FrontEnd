import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PRINT_HEADER } from '@core/constants/print';
import { money } from '@core/utils/format';
import { formatPhone } from '@core/utils/phone';
import { BackButton } from '@shared/ui/back-button';
import { Icon } from '@shared/ui/icon';
import { Logo } from '@shared/ui/logo';
import { StudyPrintService } from '../data-access/study-print.service';
import { STUDY_PRINT_ROUTES, StudyPrint, StudyPrintSegment } from '../data-access/studies.models';

interface Field { label: string; value: string; wide?: boolean; }
interface Table { title: string; head: string[]; rows: string[][]; foot?: string[]; }

const day = (value: string | null | undefined) => value ? value.slice(0, 10).replaceAll('-', '/') : '';
const text = (value: string | number | null | undefined) => value == null ? '' : String(value);

/**
 * النماذج الورقية للدراسة (الطلب، التكليف، الرد، أمر البدء، CDA) على ورقة A4 بألوان ثابتة بصرف النظر عن مظهر التطبيق.
 * ترويسة (الدولة، فرع الدراسة، الرقم، التاريخ الهجري والميلادي) ثم حقول المستند وجداوله ثم التواقيع بصورتها المحفوظة
 * وقت القرار (مربع فارغ لمن لم يقرّر). صفحة خارج الإطار العام؛ الخادم يفحص PrintStudyDocuments وعرض المستند وحدّ الفرع.
 */
@Component({
  selector: 'app-study-print', standalone: true, imports: [Icon, BackButton, DatePipe, Logo],
  templateUrl: './study-print-page.html',
  styleUrl: './study-print-page.scss'
})
export class StudyPrintPage {
  header = PRINT_HEADER;
  data = signal<StudyPrint | null>(null);
  error = signal('');

  fields = computed<Field[]>(() => {
    const d = this.data();
    if (!d) return [];
    const r = d.request, a = d.assignment, s = d.response, o = d.startOrder, c = d.designApproval;
    if (r) return [
      { label: 'الجهة المستفيدة الرئيسية', value: r.mainBeneficiary }, { label: 'الجهة الفرعية', value: text(r.subBeneficiary) },
      { label: 'رقم الطلب من الديوان المركزي', value: text(r.diwanRequestNumber) }, { label: 'رمز الجهة', value: text(r.entityCode) },
      { label: 'رقم أرشيف ديوان الوزارة', value: text(r.ministryArchiveNumber) }, { label: 'تاريخ أرشيف ديوان الوزارة', value: day(r.ministryArchiveDate) },
      { label: 'رقم أرشيف ديوان الإدارة', value: text(r.adminArchiveNumber) }, { label: 'تاريخ أرشيف ديوان الإدارة', value: day(r.adminArchiveDate) },
      { label: 'رقم أرشيف الجهة المستفيدة', value: text(r.beneficiaryArchiveNumber) }, { label: 'تاريخ الإضافة', value: day(r.addedDate) },
      { label: 'المحافظة', value: r.governorateName }, { label: 'المنطقة', value: text(r.area) },
      { label: 'المدينة / القرية', value: text(r.cityOrVillage) }, { label: 'طبيعة العقار', value: text(r.propertyNature) },
      { label: 'نوع العمل', value: r.workTypeName }, { label: 'الاستعجال', value: r.urgencyName },
      { label: 'المتابع لدى الجهة', value: [r.followerName, r.followerPhone ? formatPhone(r.followerPhone) : ''].filter(Boolean).join(' — ') },
      { label: 'الموقع', value: text(r.siteName) },
      { label: 'ملاحظات عامة', value: text(r.notes), wide: true }
    ];
    if (a) return [
      { label: 'الجهة المستفيدة', value: a.mainBeneficiary }, { label: 'القسم المتابع', value: a.followingDepartmentName },
      { label: 'الطلب المرجعي', value: a.requestNumber }, { label: 'كود المشروع', value: text(a.projectCode) },
      { label: 'تاريخ التكليف', value: day(a.assignmentDate) }, { label: 'درجة الأهمية', value: a.priorityName },
      { label: 'الميزانية المرصودة', value: a.allocatedBudget != null ? money(a.allocatedBudget) : '' }, { label: 'تاريخ الإحالة الداخلي', value: day(a.referralDate) },
      { label: 'الحد الأقصى للرد', value: day(a.responseDeadline), wide: true },
      { label: 'ملخص نطاق العمل والمتطلبات', value: a.scopeSummary, wide: true },
      { label: 'المخرجات المطلوبة', wide: true, value: [
        a.needsTechnicalEvaluation && 'التقييم الفني الأولي وقابلية التنفيذ', a.needsResourceEstimate && 'تقدير الموارد والكوادر الهندسية والمدة',
        a.needsPreliminaryBudget && 'الميزانية التقديرية المبدئية للمشروع', a.needsFinalRecommendation && 'التوصية الفنية النهائية للقسم'
      ].filter(Boolean).join('، ') }
    ];
    if (s) return [
      { label: 'التكليف المرجعي', value: s.assignmentNumber }, { label: 'كود المشروع', value: text(s.projectCode) },
      { label: 'القسم المتابع', value: s.followingDepartmentName }, { label: 'تاريخ الرد', value: day(s.responseDate) },
      { label: 'مدير المشروع المقترح', value: text(s.proposedManagerName) }, { label: 'التوصية الفنية النهائية', value: s.recommendationName },
      { label: 'مساحة الموقع العام', value: s.siteArea != null ? s.siteArea + ' م²' : '' }, { label: 'التكلفة المبدئية', value: s.initialCost != null ? money(s.initialCost) : '' },
      { label: 'تقدير المدة اللازمة لإعداد الدراسة', value: s.requiredDays ? s.requiredDays + ' يوم تقويمي' : '', wide: true }
    ];
    if (o) return [
      { label: 'أمر التكليف المرجعي', value: o.assignmentNumber }, { label: 'كود المشروع', value: text(o.projectCode) },
      { label: 'تاريخ الأمر', value: day(o.orderDate) }, { label: 'القسم المختص', value: o.competentDepartmentName },
      { label: 'مدير المشروع', value: o.projectManagerName }, { label: 'تاريخ بدء الدراسة', value: day(o.studyStartDate) },
      { label: 'الحد الأقصى للإنهاء', value: day(o.studyDeadline), wide: true }
    ];
    if (c) return [
      { label: 'أمر البدء', value: text(d.startOrderNumber) }, { label: 'كود المشروع', value: c.projectCode },
      { label: 'المخطط المعماري', value: c.drawingName }, { label: 'النسخة', value: c.versionLabel },
      { label: 'تاريخ الاعتماد', value: day(c.cdaDate) }, { label: 'القرار', value: c.decisionName },
      { label: 'المحتوى', value: text(c.content), wide: true }, { label: 'الملاحظات الفنية', value: text(c.technicalNotes), wide: true }
    ];
    return [];
  });

  tables = computed<Table[]>(() => {
    const d = this.data();
    const s = d?.response, o = d?.startOrder;
    if (s) return [
      { title: 'المباني', head: ['نوع البناء', 'عدد المباني', 'المساحة الإجمالية للمباني (م²)'], rows: s.buildings.map(b => [b.buildingTypeName, text(b.buildingCount), text(b.buildingsArea)]) },
      { title: 'الجدول التفصيلي للتكلفة المبدئية', head: ['البند', 'الوحدة', 'الكمية', 'سعر الوحدة', 'المجموع'],
        rows: s.costItems.map(c => [c.description, c.unit, text(c.quantity), money(c.unitPrice), money(c.total)]), foot: s.costItems.length ? ['الإجمالي', '', '', '', money(s.totalCost)] : undefined },
      { title: 'الكوادر الهندسية المقترحة', head: ['الاختصاص', 'العدد'], rows: s.staffEstimates.map(x => [x.disciplineName, text(x.staffCount)]) },
      { title: 'الموارد اللوجستية اللازمة', head: ['المورد', 'الكمية', 'ملاحظة'], rows: s.logisticItems.map(x => [x.item, text(x.quantity), text(x.note)]) }
    ].filter(t => t.rows.length);
    if (o) return [
      { title: 'الكوادر الهندسية المخصصة', head: ['المهندس', 'الاختصاص'], rows: o.engineers.map(e => [e.engineerName, e.disciplineName]) },
      { title: 'الموارد المخصصة', head: ['المورد', 'الكمية', 'ملاحظة'], rows: o.resources.map(x => [x.item, text(x.quantity), text(x.note)]) }
    ].filter(t => t.rows.length);
    return [];
  });

  constructor() {
    const params = inject(ActivatedRoute).snapshot.paramMap;
    const segment = params.get('segment') as StudyPrintSegment;
    const id = Number(params.get('id'));
    if (!(segment in STUDY_PRINT_ROUTES)) { this.error.set('نوع النموذج غير معروف'); return; }
    inject(StudyPrintService).get(segment, id).subscribe({
      next: d => this.data.set(d),
      error: e => this.error.set(e.message)
    });
  }

  print() { window.print(); }
}
