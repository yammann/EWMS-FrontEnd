import { DatePipe, Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VacationService } from '../../core/services/vacation.service';
import { VacationPrint } from '../../core/models/vacation.models';
import { Logo } from '../../shared/ui/logo';
import { daysAr } from '../../core/utils/arabic-count';

/** ترويسة نموذج طلب الإجازة: الدولة، ثم اسم فرع الطلب (يُملأ تلقائياً من فرع مقدّم الطلب لحظة التقديم) */
export const VACATION_PRINT_HEADER = {
  countryAr: 'الجمهورية العربية السورية',
  countryEn: 'Syrian Arab Republic'
};


/**
 * نموذج «طلب إجازة» بشكل الورقة المعتمدة في المؤسسة (صورة النموذج من المستخدم 2026-10-04):
 * ترويسة + بيانات مقدم الطلب + نوع الإجازة + السبب + رأي رئيس الفرع وتوقيعه ومكان الختم.
 * صفحة خارج الإطار العام، والورقة بألوان ثابتة (ورق أبيض) بصرف النظر عن مظهر التطبيق.
 */
@Component({
  selector: 'app-vacation-print', standalone: true, imports: [DatePipe, Logo],
  template: `
    <div class="bar no-print">
      <button type="button" class="btn btn-ghost" (click)="goBack()">→ رجوع</button>
      <button type="button" class="btn" (click)="print()" [disabled]="!data()">🖨 طباعة</button>
    </div>

    @if (error()) { <p class="alert alert-error no-print" role="alert">{{ error() }}</p> }
    @if (data(); as d) {
      @if (!d.personalIdNumber || !d.phone) {
        <p class="alert alert-warning no-print" role="status">
          {{ !d.personalIdNumber && !d.phone ? 'الرقم الذاتي ورقم التواصل غير مسجّلين' : !d.personalIdNumber ? 'الرقم الذاتي غير مسجّل' : 'رقم التواصل غير مسجّل' }}
          في بيانات الموظف — ستبقى خانته فارغة. يُضاف من صفحة المستخدمين.
        </p>
      }
      @if (d.vacation.status.startsWith('Pending')) {
        <p class="alert alert-warning no-print" role="status">الطلب لم يُعتمد بعد — يُطبع «رأي رئيس الفرع» فارغاً.</p>
      }

      <article class="sheet" dir="rtl">
        <header class="head">
          <div class="side right">
            <strong>{{ header.countryAr }}</strong>
            <strong class="branch">{{ d.branchName }}</strong>
          </div>
          <div class="center">
            <app-logo class="emblem" />
          </div>
          <div class="side left" dir="ltr"><strong>{{ header.countryEn }}</strong></div>
        </header>

        <div class="meta-row">
          <table class="ref"><tbody>
            <tr><th>الرقم:</th><td class="ltr">{{ d.vacation.requestNumber }}</td></tr>
            <tr><th>التاريخ:</th><td class="ltr">{{ d.submittedHijri }}</td></tr>
            <tr><th>الموافق لـ:</th><td class="ltr">{{ d.submittedAt | date:'yyyy/M/d' }}</td></tr>
          </tbody></table>
          <h1>( طلب إجازة )</h1>
          <span></span>
        </div>

        <h2>❖ بيانات مقدم الطلب:</h2>
        <table class="grid"><tbody>
          <tr><th>الاسم الثلاثي</th><td>{{ d.employeeName }}</td><th>الرقم الذاتي</th><td class="ltr">{{ d.personalIdNumber || '' }}</td></tr>
          <tr><th>رقم التواصل</th><td class="ltr">{{ d.phone || '' }}</td><th>القسم التابع له</th><td>{{ d.departmentName }}</td></tr>
          <tr><th>تاريخ تقديم الإجازة</th><td class="ltr">{{ d.submittedAt | date:'yyyy/M/d' }}</td><th>عدد أيام الإجازة</th><td>{{ days(d.vacation.vacDayCount) }}</td></tr>
          <tr><th>تاريخ بدء الإجازة</th><td class="ltr">{{ d.vacation.startVac | date:'yyyy/M/d' }}</td><th>تاريخ انتهاء الإجازة</th><td class="ltr">{{ d.vacation.endVac | date:'yyyy/M/d' }}</td></tr>
        </tbody></table>

        <table class="grid types"><tbody>
          <tr><th>نوع الإجازة:</th>
            <td>@for (t of d.types; track t.id) { <span class="type">{{ t.name }} <span class="box">({{ t.selected ? '✓' : '  ' }})</span></span> }</td>
          </tr>
        </tbody></table>

        <div class="body">
          <div class="fields">
            <p class="label">• سبب طلب الإجازة:</p>
            <p class="answer">{{ d.vacation.vacReason || '' }}</p>
            <p class="label">• رأي رئيس الفرع:</p>
            @if (d.branchOpinion) { <p class="answer">{{ d.branchOpinion }}</p> }
            @else { <span class="dots"></span><span class="dots"></span> }
          </div>
          <div class="signer">
            <strong>رئيس {{ d.branchName }}</strong>
            @if (d.signerSignature) { <img [src]="d.signerSignature" alt="التوقيع"> } @else { <span class="sign-space"></span> }
            <span class="name">{{ d.signerName || '' }}</span>
            <span class="stamp">مكان الختم</span>
          </div>
        </div>

        <footer class="foot">
          <span class="employee-sign">توقيع مقدم الطلب:
            <span class="sig-box">@if (d.requesterSignature) { <img [src]="d.requesterSignature" alt="توقيع مقدم الطلب"> }</span></span>
          <p class="copy">نسخة إلى:<br>- أرشيف {{ d.branchName }}</p>
        </footer>
      </article>
    } @else if (!error()) { <p class="loading no-print" role="status">جارٍ التحميل…</p> }`,
  styles: [`
    :host { display: block; min-height: 100vh; padding: 24px 16px 48px; background: var(--bg, #f2f2f4); }
    .bar { max-width: 210mm; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .alert, .loading { max-width: 210mm; margin: 0 auto 16px; }
    .loading { text-align: center; color: var(--ink-500); }

    /* الورقة: ألوان ثابتة كالنموذج الورقي (خانات العناوين بلون داكن ونص أبيض) */
    .sheet { --ink: #1b1b1f; --soft: #5b5b66; --rule: #3c3c44; --label: #2f5550; --gold: #b8975a;
      box-sizing: border-box; width: 210mm; max-width: 100%; min-height: 297mm; margin: 0 auto; padding: 12mm 12mm 10mm;
      display: flex; flex-direction: column;
      background: #fff; color: var(--ink); border: 1px solid #000; outline: 3mm solid #fff; box-shadow: 0 10px 40px rgba(0, 0, 0, .12);
      font-size: 13.5px; line-height: 1.7; }

    .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 12px; }
    .side { display: grid; gap: 2px; font-size: 14px; }
    .side.right { text-align: right; }
    .side.left { text-align: left; }
    .side .branch { margin-top: 4px; }
    .center { display: grid; justify-items: center; }
    .emblem { width: 96px; height: 96px; color: var(--gold); }

    /* مربع الرقم يميناً والعنوان في الوسط تحت الشعار (العمودان الجانبيان متساويان فيبقى العنوان في المنتصف) */
    .meta-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-top: 4px; }
    /* الجداول العامة في التطبيق عرضها 100% وبحد أدنى 700px — لا تنطبق على الورقة */
    .sheet table { min-width: 0; }
    .ref { border-collapse: collapse; width: auto; justify-self: start; }
    .ref th, .ref td { border: 1px solid var(--rule); padding: 1px 8px; font-size: 12px; text-align: right; }
    .ref th { font-weight: 700; white-space: nowrap; }
    .ref td { min-width: 30mm; }
    h1 { margin: 0; font-size: 18px; text-align: center; white-space: nowrap; }

    h2 { margin: 14px 0 6px; font-size: 14px; }
    .grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .grid th, .grid td { border: 1px solid var(--rule); padding: 4px 8px; text-align: right; vertical-align: middle; font-size: 13.5px; }
    .grid th { width: 19%; background: var(--label); color: #fff; font-weight: 700; white-space: nowrap; }
    .grid td { width: 31%; overflow-wrap: anywhere; }
    .types { margin-top: 10px; }
    .types td { width: auto; }
    .type { display: inline-block; margin-inline-end: 14px; white-space: nowrap; }
    .box { font-weight: 700; }
    .ltr { direction: ltr; unicode-bidi: isolate; text-align: right; }

    .body { display: grid; grid-template-columns: 1fr 62mm; gap: 18px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--rule); }
    .label { margin: 10px 0 2px; font-weight: 700; }
    .answer { margin: 0 14px 6px 0; white-space: pre-line; min-height: 22px; }
    .dots { display: block; height: 26px; margin: 0 14px 0 0; border-bottom: 1px dotted var(--soft); }
    .signer { display: grid; justify-items: center; align-content: start; gap: 6px; text-align: center; padding-top: 8px; }
    .signer strong { font-size: 14px; }
    .signer img { height: 56px; max-width: 90%; object-fit: contain; }
    .sign-space { height: 56px; }
    .signer .name { font-weight: 700; min-height: 22px; }
    .stamp { display: grid; place-items: center; width: 34mm; height: 34mm; margin-top: 6px; border: 1px dashed #b5b5bd; border-radius: 50%; color: #b5b5bd; font-size: 11px; }

    .foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; font-size: 12px; }
    .copy { margin: 0; }
    .employee-sign { order: 2; display: inline-flex; align-items: flex-end; gap: 6px; color: var(--soft); }
    .employee-sign .sig-box { position: relative; display: inline-flex; align-items: flex-end; justify-content: center; width: 45mm; min-height: 14mm; border-bottom: 1px solid var(--soft); }
    .employee-sign .sig-box img { height: 12mm; max-width: 100%; object-fit: contain; }

    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      :host { padding: 0; min-height: 0; background: #fff; }
      .no-print { display: none !important; }
      .sheet { width: auto; min-height: calc(297mm - 16mm); margin: 0; box-shadow: none; outline: none; }
      .grid th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `]
})
export class VacationPrintPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  header = VACATION_PRINT_HEADER;
  days = daysAr;
  data = signal<VacationPrint | null>(null);
  error = signal('');

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    inject(VacationService).printData(id).subscribe({
      next: d => this.data.set(d),
      error: e => this.error.set(e.message)
    });
  }

  print() { window.print(); }

  goBack() {
    if (history.length > 1) this.location.back();
    else this.router.navigate(['/profile']);
  }
}
