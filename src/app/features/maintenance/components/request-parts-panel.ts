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
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/list-tools.scss'],
  templateUrl: './request-parts-panel.html',
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
