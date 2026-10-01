import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { TechnicianOption } from '../../core/models/maintenance.models';
import { Modal } from '../../shared/ui/modal';

/** شارة حالة الطلب بلونها المعرَّف في جدول الحالات (يعمل في الوضعين الفاتح والداكن) */
@Component({
  selector: 'app-status-chip', standalone: true,
  template: `<span class="chip" [style.--c]="color() || 'var(--ink-400)'"><i aria-hidden="true"></i>{{ name() }}</span>`,
  styles: [`
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: var(--radius-full); font-size: 12px; font-weight: 700; white-space: nowrap;
      background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 62%, var(--ink-900)); }
    i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
  `]
})
export class StatusChip {
  name = input.required<string>();
  color = input<string | null | undefined>('');
}

/** ترقيم الصفحات: السابق / التالي مع عدد النتائج */
@Component({
  selector: 'app-pager', standalone: true,
  template: `
    @if (total() > 0) {
      <nav class="pager" aria-label="ترقيم الصفحات">
        <span class="info">{{ from() }}–{{ to() }} من {{ total() }}</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="pageChange.emit(page() - 1)" [disabled]="page() <= 1 || disabled()">السابق</button>
        <span class="current">صفحة {{ page() }} من {{ pages() }}</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="pageChange.emit(page() + 1)" [disabled]="page() >= pages() || disabled()">التالي</button>
      </nav>
    }`,
  styles: [`
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; padding-top: 16px; font-size: 12px; color: var(--ink-500); font-variant-numeric: tabular-nums; }
    .info { margin-inline-end: auto; }
    .current { font-weight: 700; color: var(--ink-700); }
  `]
})
export class Pager {
  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();
  disabled = input(false);
  pageChange = output<number>();

  pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}

/**
 * نقل طلب/مهمة صيانة إلى موظف آخر (رئيس القسم داخل قسمه، والسوبر ادمن داخل قسم السجل).
 * النافذة تختار الموظف فقط — الحفظ عند الصفحة المستدعية عبر (assign).
 */
@Component({
  selector: 'app-assign-dialog', standalone: true, imports: [Modal],
  template: `
    <app-modal heading="تغيير الموظف المسؤول" [subheading]="subject()" [busy]="busy()" (closed)="closed.emit()">
      <form (submit)="$event.preventDefault(); submit()">
        <div class="modal-body">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          <label class="form-field"><span class="form-label">الموظف المسؤول الجديد</span>
            <select (change)="selected.set(+$any($event.target).value)" [disabled]="loading()">
              <option [value]="0" [selected]="!selected()">{{ loading() ? 'جارٍ التحميل…' : 'اختر الموظف' }}</option>
              @for (u of options(); track u.id) { <option [value]="u.id" [disabled]="u.id === currentUserId()">{{ u.fullName }}{{ u.id === currentUserId() ? ' (الحالي)' : '' }}</option> }
            </select>
          </label>
          <p class="note">سيصل إشعار للموظف الجديد وللموظف السابق.</p>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="!selected() || selected() === currentUserId() || busy()">{{ busy() ? 'جارٍ النقل…' : 'نقل' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`.note { margin: 12px 0 0; font-size: 12px; color: var(--ink-500); }`]
})
export class AssignDialog implements OnInit {
  private service = inject(MaintenanceService);
  /** وصف السجل (رقم الطلب أو مكان المهمة) */
  subject = input('');
  currentUserId = input.required<number>();
  departmentId = input<number | null>(null);
  busy = input(false);
  assign = output<number>();
  closed = output<void>();

  options = signal<TechnicianOption[]>([]);
  loading = signal(true);
  error = signal('');
  selected = signal(0);

  ngOnInit() {
    this.service.assignees(this.departmentId()).subscribe({
      next: list => { this.options.set(list); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  submit() {
    if (this.selected() && this.selected() !== this.currentUserId()) this.assign.emit(this.selected());
  }
}
