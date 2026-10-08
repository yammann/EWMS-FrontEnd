import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenanceRequest } from '../data-access/maintenance.models';
import { RequestPart, RequestParts, SparePart, twoDecimals } from '../data-access/spare-part.models';
import { qty } from '@core/utils/format';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { Modal } from '@shared/ui/modal';
import { UtcPipe, MoneyPipe, QtyPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

/**
 * قطع الغيار المصروفة على طلب الصيانة: الصرف من مخزون قسم الطلب (المتوافقة مع الجهاز أولاً)، والإرجاع للمخزون،
 * وتكلفة الجهاز على مدى عمره مع تنبيه حد الاستبدال. بعد إغلاق الطلب تُقفل القطع.
 */
@Component({
  selector: 'app-request-parts-panel', standalone: true, imports: [Alert, QtyPipe, MoneyPipe, UtcPipe, DatePipe, Modal],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/maintenance.scss'],
  template: `
    @if (data(); as d) {
      <section class="panel">
        <div class="panel-heading">
          <div><h2>قطع الغيار</h2><p>{{ d.items.length ? 'تكلفة قطع هذا الطلب ' + (d.total | money) : 'لم تُصرف قطع على هذا الطلب' }}{{ request().isClosed && d.items.length ? ' — مقفلة مع الطلب' : '' }}</p></div>
          @if (d.canIssue && can().issueParts) { <button class="btn btn-sm" type="button" (click)="openIssue()">+ صرف قطعة</button> }
        </div>

        @if (d.items.length) {
          <div class="table-wrap"><table>
            <thead><tr><th>القطعة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th>صُرفت</th>@if (d.canIssue && can().issueParts) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (p of d.items; track p.id) {
                <tr>
                  <td><span class="cell-strong">{{ p.partName }}</span>@if (p.partNumber) { <small class="mono">{{ p.partNumber }}</small> }</td>
                  <td class="num">{{ p.quantity | qty }} {{ p.unit }}</td>
                  <td class="num">{{ p.unitCost | money }}</td>
                  <td class="num cell-strong">{{ p.total | money }}</td>
                  <td>{{ p.issuedByName }}<small>{{ p.issuedAt | utc | date:'yyyy/MM/dd — HH:mm' }}</small></td>
                  @if (d.canIssue && can().issueParts) {
                    <td><div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" [disabled]="busy()" (click)="returnPart(p)">إعادة للمخزون</button></div></td>
                  }
                </tr>
              }
            </tbody>
          </table></div>
        }
        <p class="lifetime">تكلفة قطع الجهاز على مدى عمره: <strong>{{ d.deviceLifetimeCost | money }}</strong></p>
      </section>
    }

    @if (issueOpen()) {
      <app-modal heading="صرف قطعة على الطلب" [subheading]="request().number + ' — من مخزون ' + request().departmentName" [busy]="busy()" (closed)="issueOpen.set(false)">
        <div class="modal-body form-stack">
          <app-alert [message]="issueError()" />
          <label class="form-field"><span class="form-label">بحث في القطع المتوفرة</span>
            <input #t1 type="search" [value]="search()" (input)="search.set(t1.value); findParts()" placeholder="الاسم أو رقم القطعة…" autocomplete="off"></label>
          <div class="pick" role="listbox" aria-label="القطع المتوفرة">
            @for (p of available(); track p.id) {
              <button type="button" role="option" [class.on]="selected()?.id === p.id" [attr.aria-selected]="selected()?.id === p.id" (click)="select(p)">
                <span><strong>{{ p.name }}</strong>@if (p.partNumber) { <small class="mono"> {{ p.partNumber }}</small> }</span>
                <small>متوفر {{ p.quantity | qty }} {{ p.unit }} · {{ p.averageCost | money }}</small>
              </button>
            } @empty { <p class="hint">{{ loadingParts() ? 'جارٍ التحميل…' : 'لا توجد قطع متوفرة في مخزون قسم الطلب' }}</p> }
          </div>
          @if (selected(); as s) {
            <label class="form-field"><span class="form-label">الكمية ({{ s.unit }}) — المتوفر {{ s.quantity | qty }}</span>
              <input #t2 type="number" [value]="quantity()" (input)="quantity.set(+t2.value)" min="0.01" [max]="s.quantity" step="0.01" dir="ltr">
              @if (quantityError()) { <small class="form-error">{{ quantityError() }}</small> }
              @else { <small class="hint">التكلفة {{ quantity() * s.averageCost | money }} — بسعر المتوسط الحالي، ويُثبَّت على الطلب</small> }</label>
          }
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="issueOpen.set(false)" [disabled]="busy()">إلغاء</button>
          <button type="button" (click)="issue()" [disabled]="!selected() || !!quantityError() || busy()">{{ busy() ? 'جارٍ الصرف…' : 'صرف' }}</button>
        </footer>
      </app-modal>
    }`,
  styles: [`
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td small { display: block; color: var(--ink-500); font-size: 11px; }
    .lifetime { margin: 12px 0 0; font-size: 13px; color: var(--ink-500); }
    .lifetime strong { color: var(--ink-900); }
    .pick { display: grid; gap: 6px; max-height: 260px; overflow: auto; }
    .pick button { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; text-align: start;
      border-radius: var(--radius-lg); background: var(--fill); color: var(--ink-900); border: 2px solid transparent; font-weight: 400; min-height: 0; }
    .pick button:hover { box-shadow: none; transform: none; background: var(--fill-strong); }
    .pick button.on { border-color: var(--brand-600); background: var(--brand-50); }
    .pick small { color: var(--ink-500); white-space: nowrap; }
  `]
})
export class RequestPartsPanel {
  private service = inject(MaintenanceService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  can = this.service.can;

  request = input.required<MaintenanceRequest>();
  /** بعد الصرف أو الإرجاع (لتحديث سجل الطلب) */
  changed = output<void>();

  data = signal<RequestParts | null>(null);
  busy = signal(false);

  issueOpen = signal(false);
  issueError = signal('');
  search = signal('');
  available = signal<SparePart[]>([]);
  loadingParts = signal(false);
  selected = signal<SparePart | null>(null);
  quantity = signal(1);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  quantityError = computed(() => {
    const s = this.selected(), q = this.quantity();
    if (!s) return '';
    if (!(q > 0) || !twoDecimals(q)) return 'كمية موجبة بخانتين عشريتين على الأكثر';
    return q > s.quantity ? `المتوفر ${qty(s.quantity)} ${s.unit} فقط` : '';
  });

  constructor() {
    // يُعاد التحميل عند تغيّر الطلب أو حالته (الإغلاق يُقفل القطع)
    effect(() => {
      const r = this.request();
      void r.id; void r.isClosed;
      untracked(() => this.load());
    });
  }

  load() {
    this.service.requestParts(this.request().id).subscribe({ next: d => this.data.set(d), error: () => this.data.set(null) });
  }

  openIssue() {
    this.issueError.set(''); this.search.set(''); this.selected.set(null); this.quantity.set(1);
    this.issueOpen.set(true);
    this.fetchParts();
  }

  findParts() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.fetchParts(), 250);
  }

  private fetchParts() {
    this.loadingParts.set(true);
    this.service.availableParts(this.request().id, this.search().trim()).subscribe({
      next: list => { this.available.set(list); this.loadingParts.set(false); },
      error: e => { this.issueError.set(e.message); this.loadingParts.set(false); }
    });
  }

  select(p: SparePart) {
    this.selected.set(p);
    if (this.quantity() > p.quantity) this.quantity.set(Math.min(1, p.quantity));
  }

  issue() {
    const s = this.selected();
    if (!s || this.quantityError() || this.busy()) return;
    trackRequest(this.service.issuePart(this.request().id, { sparePartId: s.id, quantity: this.quantity() }), this.busy, this.issueError, d => { this.issueOpen.set(false); this.data.set(d);
        this.toast.success(`صُرف ${qty(this.quantity())} ${s.unit} من «${s.name}»`);
        this.changed.emit(); });
  }

  async returnPart(p: RequestPart) {
    if (!await this.confirm.ask(`إعادة ${qty(p.quantity)} ${p.unit} من «${p.partName}» إلى المخزون وإزالتها من الطلب؟`, 'إعادة')) return;
    this.busy.set(true);
    this.service.returnPart(p.id).subscribe({
      next: d => { this.busy.set(false); this.data.set(d); this.toast.success('أُعيدت القطعة إلى المخزون'); this.changed.emit(); },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }
}
