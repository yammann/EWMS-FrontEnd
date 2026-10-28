import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PRINT_HEADER } from '@core/constants/print';
import { BackButton } from '@shared/ui/back-button';
import { Icon } from '@shared/ui/icon';
import { Logo } from '@shared/ui/logo';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { CorrespondencePrint } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

/**
 * الكتاب الصادر المعتمد على ورقة A4 بترويسة الفرع: الرقم والتاريخ (هجري وميلادي)، المرسَل إليه والموضوع ونص الكتاب،
 * واسم المعتمِد وتوقيعه **الذي اعتمد به** (يثبت مع الاعتماد فلا تتغير الطباعة لاحقاً) ومكان الختم.
 * صفحة خارج الإطار العام، والورقة بألوان ثابتة (ورق أبيض) بصرف النظر عن مظهر التطبيق.
 */
@Component({
  selector: 'app-correspondence-print', standalone: true, imports: [Icon, BackButton, DatePipe, Logo, UtcPipe],
  styleUrl: './correspondence-print-page.scss',
  template: `
    <div class="bar no-print">
      <app-back-button />
      <button type="button" class="btn" (click)="print()" [disabled]="!data()"><app-icon name="printer" [size]="16" /> طباعة</button>
    </div>

    @if (error()) { <p class="alert alert-error no-print" role="alert">{{ error() }}</p> }
    @if (data(); as d) {
      @if (!d.isIssued) { <p class="alert alert-warning no-print" role="status">الكتاب معتمد ولم يصدر بعد — يُطبع بلا رقم حتى يصدره الديوان.</p> }
      @if (!d.approverSignature) { <p class="alert alert-warning no-print" role="status">اعتُمد بلا توقيع مرفوع للمعتمِد — يبقى مكان التوقيع فارغاً.</p> }

      <article class="sheet" dir="rtl">
        <header class="head">
          <div class="side right">
            <strong>{{ header.countryAr }}</strong>
            <strong class="branch">{{ d.branchName }}</strong>
          </div>
          <div class="center"><app-logo class="emblem" /></div>
          <div class="side left" dir="ltr"><strong>{{ header.countryEn }}</strong></div>
        </header>

        <table class="ref"><tbody>
          <tr><th>الرقم:</th><td class="ltr">{{ d.number || '' }}</td></tr>
          <tr><th>التاريخ:</th><td class="ltr">{{ d.dateHijri }}</td></tr>
          <tr><th>الموافق لـ:</th><td class="ltr">{{ d.date | utc | date:'yyyy/M/d' }}</td></tr>
          @if (d.replyToNumber) { <tr><th>ردّاً على:</th><td class="ltr">{{ d.replyToNumber }}{{ d.externalNumber ? ' — ' + d.externalNumber : '' }}</td></tr> }
        </tbody></table>

        <p class="to"><strong>إلى / {{ d.party }}</strong></p>
        <p class="subject"><strong>الموضوع: {{ d.subject }}</strong></p>
        <p class="greeting">تحية طيبة وبعد،</p>
        <div class="body">{{ d.body }}</div>
        <p class="closing">وتفضلوا بقبول فائق الاحترام والتقدير،،،</p>

        <div class="signer">
          <strong>المعتمِد</strong>
          @if (d.approverSignature) { <img [src]="d.approverSignature" alt="التوقيع"> } @else { <span class="sign-space"></span> }
          <span class="name">{{ d.approverName || '' }}</span>
          <span class="stamp">مكان الختم</span>
        </div>

        <footer class="foot"><p class="copy">نسخة إلى:<br>- أرشيف {{ d.branchName }}</p></footer>
      </article>
    } @else if (!error()) { <p class="loading no-print" role="status">جارٍ التحميل…</p> }
  `
})
export class CorrespondencePrintPage {
  private route = inject(ActivatedRoute);

  header = PRINT_HEADER;
  data = signal<CorrespondencePrint | null>(null);
  error = signal('');

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    inject(DiwanService).printData(id).subscribe({ next: d => this.data.set(d), error: e => this.error.set(e.message) });
  }

  print() { window.print(); }
}
