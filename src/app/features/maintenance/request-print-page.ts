import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MaintenanceService } from '@core/services/maintenance.service';
import { MaintenancePrint } from '@core/models/maintenance.models';
import { formatPhone } from '@core/utils/phone';
import { Logo } from '@shared/ui/logo';
import { UtcPipe } from '@shared/pipes/format.pipes';

/** ترويسة المطبوعات — عدّلها هنا عند اعتماد الترويسة الرسمية */
export const PRINT_HEADER = {
  organization: 'الجمهورية العربية السورية',
  system: 'نظام إدارة سير العمل — EWMS',
  fallbackUnit: 'قسم الصيانة'
};

type Kind = 'receipt' | 'delivery';

/**
 * صفحة طباعة (خارج الإطار العام): إيصال استلام الجهاز من العميل، أو ورقة تسليمه بعد الصيانة
 * وعليها التوقيع الإلكتروني لصاحب صلاحية SignMaintenanceReceipt في قسم الطلب (صورة يرفعها من ملفه الشخصي).
 * الورقة بألوان ثابتة (ورق أبيض) بصرف النظر عن مظهر التطبيق.
 */
@Component({
  selector: 'app-maintenance-print', standalone: true, imports: [UtcPipe, DatePipe, Logo],
  template: `
    <div class="bar no-print">
      <button type="button" class="btn btn-ghost" (click)="goBack()">→ رجوع</button>
      <div class="kinds" role="tablist" aria-label="نوع الورقة">
        <button type="button" role="tab" [class.on]="kind() === 'receipt'" (click)="setKind('receipt')">إيصال الاستلام</button>
        <button type="button" role="tab" [class.on]="kind() === 'delivery'" (click)="setKind('delivery')">ورقة التسليم</button>
      </div>
      <button type="button" class="btn" (click)="print()" [disabled]="!data()">🖨 طباعة</button>
    </div>

    @if (error()) { <p class="alert alert-error no-print" role="alert">{{ error() }}</p> }
    @if (data(); as d) {
      @if (kind() === 'delivery' && !d.delivered) {
        <p class="alert alert-warning no-print" role="status">
          لم يُسلَّم الطلب بعد — يُثبَّت اسم رئيس القسم وتوقيعه عند تحويل الطلب إلى حالة من مرحلة «مُسلَّم»، وتُطبع الورقة الآن بخانة توقيع فارغة.
        </p>
      } @else if (kind() === 'delivery' && !d.managerSignature) {
        <p class="alert alert-warning no-print" role="status">
          {{ d.managerName ? 'لم يكن لرئيس القسم (' + d.managerName + ') توقيع مرفوع لحظة التسليم' : 'لم يكن في قسم هذا الطلب من يملك صلاحية التوقيع على أوراق التسليم لحظة التسليم' }} — تُطبع الورقة بخانة توقيع فارغة.
        </p>
      }

      <article class="sheet" dir="rtl">
        <header class="head">
          <div class="org">
            <app-logo class="logo" />
            <div><strong>{{ header.organization }}</strong><span>{{ d.request.departmentName || header.fallbackUnit }}</span></div>
          </div>
          <div class="doc">
            <h1>{{ kind() === 'receipt' ? 'إيصال استلام جهاز للصيانة' : 'ورقة تسليم جهاز بعد الصيانة' }}</h1>
            <dl>
              <div><dt>رقم الطلب</dt><dd class="ltr">{{ d.request.number }}</dd></div>
              <div><dt>{{ kind() === 'receipt' ? 'تاريخ الاستلام' : 'تاريخ التسليم' }}</dt>
                <dd>{{ (kind() === 'receipt' ? (d.request.createdAt | utc) : ((d.deliveredAt | utc) ?? today)) | date:'yyyy/MM/dd' }}</dd></div>
            </dl>
          </div>
        </header>

        <section>
          <h2>بيانات العميل</h2>
          <table><tbody>
            <tr><th>الاسم</th><td>{{ d.request.clientName }}</td><th>الهاتف</th><td class="ltr">{{ phone(d.request.clientPhone) || '—' }}</td></tr>
          </tbody></table>
        </section>

        <section>
          <h2>بيانات الجهاز</h2>
          <table><tbody>
            <tr><th>نوع الجهاز</th><td>{{ d.request.deviceTypeName }}</td><th>الشركة المصنّعة</th><td>{{ d.request.deviceCompanyName }}</td></tr>
            <tr><th>الموديل</th><td class="ltr">{{ d.request.model || '—' }}</td><th>الرقم التسلسلي</th><td class="ltr">{{ d.request.serialNumber || '—' }}</td></tr>
            <tr><th>الملحقات</th><td colspan="3">{{ d.request.accessories || 'لا يوجد' }}</td></tr>
          </tbody></table>
        </section>

        <section>
          <h2>{{ kind() === 'receipt' ? 'العطل المبلَّغ عنه' : 'الصيانة' }}</h2>
          <table><tbody>
            <tr><th>نوع العطل</th><td>{{ d.request.damageTypeName }}</td><th>الفني</th><td>{{ d.request.technicianName }}</td></tr>
            @if (kind() === 'delivery') {
              <tr><th>حالة الطلب</th><td>{{ d.request.statusName }}</td><th>تاريخ الاستلام</th><td>{{ d.request.createdAt | utc | date:'yyyy/MM/dd' }}</td></tr>
              <tr><th>بدء العمل</th><td>{{ d.request.startedAt ? (d.request.startedAt | date:'yyyy/MM/dd HH:mm') : '—' }}</td>
                <th>الإنجاز</th><td>{{ d.request.completedAt ? (d.request.completedAt | date:'yyyy/MM/dd HH:mm') : '—' }}</td></tr>
            }
            <tr><th>{{ kind() === 'receipt' ? 'الوصف' : 'الوصف والملاحظات' }}</th><td colspan="3" class="desc">{{ d.request.description || '—' }}</td></tr>
          </tbody></table>
        </section>

        <p class="statement">
          {{ kind() === 'receipt'
            ? 'استُلم الجهاز المذكور أعلاه مع ملحقاته المدوّنة بغرض الصيانة. يُرجى إبراز هذا الإيصال عند استلام الجهاز.'
            : 'أقرّ أنا الموقّع أدناه باستلام الجهاز المذكور أعلاه مع ملحقاته المدوّنة بعد الصيانة.' }}
        </p>

        <footer class="signatures">
          <div class="sig"><span class="role">{{ kind() === 'receipt' ? 'توقيع العميل' : 'توقيع المستلم' }}</span><span class="line"></span><span class="name">{{ d.request.clientName }}</span></div>
          @if (kind() === 'receipt') {
            <div class="sig"><span class="role">الفني المستلم</span><span class="line"></span><span class="name">{{ d.request.technicianName }}</span></div>
          } @else {
            <div class="sig"><span class="role">رئيس القسم</span>
              @if (d.managerSignature) { <img [src]="d.managerSignature" alt="توقيع رئيس القسم"> } @else { <span class="line"></span> }
              <span class="name">{{ d.managerName || '—' }}</span></div>
          }
        </footer>

        <p class="foot">{{ header.system }} · طُبع في {{ today | date:'yyyy/MM/dd HH:mm' }}</p>
      </article>
    } @else if (!error()) { <p class="loading no-print" role="status">جارٍ التحميل…</p> }`,
  styles: [`
    :host { display: block; min-height: 100vh; padding: 24px 16px 48px; background: var(--bg, #f2f2f4); }
    .bar { max-width: 210mm; margin: 0 auto 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    .kinds { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-lg); background: var(--fill); }
    .kinds button { min-height: 32px; padding: 0 14px; background: transparent; color: var(--ink-600); font-size: 13px; font-weight: 700; border-radius: var(--radius-md); }
    .kinds button:hover:not(:disabled) { box-shadow: none; transform: none; background: var(--surface); }
    .kinds button.on { background: var(--surface); color: var(--ink-900); box-shadow: var(--shadow-sm); }
    .alert, .loading { max-width: 210mm; margin: 0 auto 16px; }
    .loading { text-align: center; color: var(--ink-500); }

    /* الورقة: ألوان ثابتة (حبر على ورق أبيض) */
    .sheet { --ink: #1b1b1f; --soft: #5b5b66; --rule: #c9c9d1; --tint: #f4f4f6; --brand: #054239; --gold: #988561;
      box-sizing: border-box; width: 210mm; max-width: 100%; min-height: 148mm; margin: 0 auto; padding: 14mm 14mm 10mm;
      background: #fff; color: var(--ink); border-radius: 6px; box-shadow: 0 10px 40px rgba(0, 0, 0, .12); font-size: 13px; line-height: 1.7; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--brand); }
    .org { display: flex; align-items: center; gap: 12px; }
    .logo { width: 58px; height: 58px; color: var(--gold); }
    .org strong { display: block; font-size: 16px; color: var(--brand); }
    .org span { display: block; font-size: 13px; color: var(--soft); }
    .doc { text-align: left; }
    .doc h1 { margin: 0 0 6px; font-size: 17px; color: var(--ink); }
    .doc dl { margin: 0; display: grid; gap: 2px; font-size: 12px; }
    .doc dl div { display: flex; justify-content: flex-end; gap: 8px; }
    .doc dt { color: var(--soft); }
    .doc dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }

    section { margin-top: 12px; }
    h2 { margin: 0 0 4px; font-size: 12px; color: var(--brand); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid var(--rule); padding: 5px 9px; text-align: right; vertical-align: top; font-size: 13px; background: none; color: var(--ink); }
    th { width: 18%; background: var(--tint); color: var(--soft); font-weight: 700; white-space: nowrap; }
    td { width: 32%; overflow-wrap: anywhere; }
    .desc { white-space: pre-line; min-height: 44px; }
    .ltr { direction: ltr; unicode-bidi: isolate; text-align: right; }

    .statement { margin: 14px 0 0; font-size: 12px; color: var(--soft); }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 18px; }
    .sig { display: grid; justify-items: center; gap: 4px; text-align: center; }
    .role { font-size: 12px; color: var(--soft); font-weight: 700; }
    .line { width: 70%; height: 56px; border-bottom: 1px dashed var(--soft); }
    .sig img { height: 60px; max-width: 80%; object-fit: contain; }
    .name { font-weight: 700; }
    .foot { margin: 16px 0 0; padding-top: 6px; border-top: 1px solid var(--rule); font-size: 10px; color: var(--soft); text-align: center; }

    @media print {
      :host { padding: 0; min-height: 0; background: #fff; }
      .no-print { display: none !important; }
      .sheet { width: auto; min-height: 0; margin: 0; padding: 0; border-radius: 0; box-shadow: none; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `]
})
export class MaintenancePrintPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  header = PRINT_HEADER;
  phone = formatPhone;
  today = new Date();

  data = signal<MaintenancePrint | null>(null);
  error = signal('');
  private kindParam = signal<Kind>(this.route.snapshot.paramMap.get('kind') === 'delivery' ? 'delivery' : 'receipt');
  kind = computed(() => this.kindParam());

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    inject(MaintenanceService).printData(id).subscribe({
      next: d => this.data.set(d),
      error: e => this.error.set(e.message)
    });
  }

  setKind(kind: Kind) {
    this.kindParam.set(kind);
    // الرابط يتبع النوع المختار دون إضافة خطوة في سجل التصفح
    this.location.replaceState(this.router.createUrlTree(['/maintenance/print', this.data()?.request.id ?? this.route.snapshot.paramMap.get('id'), kind]).toString());
  }

  print() { window.print(); }

  goBack() {
    if (history.length > 1) this.location.back();
    else this.router.navigate(['/maintenance/requests', this.route.snapshot.paramMap.get('id')]);
  }
}
