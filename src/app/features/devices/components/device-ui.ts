import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DeviceService, saveBlob } from '../data-access/device.service';
import { DeviceInventoryLog, ImportReport, INSTALLATION_STATUSES } from '../data-access/device.models';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { Pager } from '@shared/ui/pager';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { trackRequest } from '@shared/ui/loader';

/**
 * كلمة سر التركيب عند الطلب فقط: لا تصل مع القوائم، تُجلب بالضغط على «إظهار» أو «نسخ» (صلاحية RevealDevicePasswords)
 * ويُسجَّل كل إظهار ونسخ في سجل التركيب. من لا يملك الصلاحية يرى «مخفية».
 */
@Component({
  selector: 'app-device-password', standalone: true,
  template: `
    @if (!hasPassword()) { <span class="muted-cell">—</span> }
    @else if (!access().canRevealPasswords) { <span class="muted-cell" title="إظهار كلمات السر يحتاج صلاحية خاصة">مخفية 🔒</span> }
    @else {
      <span class="secret">
        <span class="mono">{{ value() ?? '••••••••' }}</span>
        <button type="button" class="icon-btn-sm" (click)="toggle()" [disabled]="busy()"
                [attr.aria-label]="value() ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'" [attr.aria-pressed]="!!value()">{{ value() ? '🙈' : '👁' }}</button>
        <button type="button" class="icon-btn-sm" (click)="copy()" [disabled]="busy()" aria-label="نسخ كلمة السر">⧉</button>
      </span>
    }`
})
export class DevicePassword {
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  access = this.service.access;

  installationId = input.required<number>();
  hasPassword = input(true);
  value = signal<string | null>(null);
  busy = signal(false);

  toggle() {
    if (this.value()) { this.value.set(null); return; }
    this.busy.set(true);
    this.service.revealPassword(this.installationId(), false).subscribe({
      next: p => { this.busy.set(false); this.value.set(p); },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }

  copy() {
    this.busy.set(true);
    this.service.revealPassword(this.installationId(), true).subscribe({
      next: p => { this.busy.set(false); this.toast.copy(p, 'كلمة السر'); },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }
}

/** شارة حالة التركيب */
@Component({
  selector: 'app-install-status', standalone: true,
  template: `<span class="badge {{ tone() }}">{{ label() }}</span>`,
  styles: [`
    .badge { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .ok { background: var(--brand-100); color: var(--brand-800); }
    .warn { background: var(--warning-100); color: var(--warning-700); }
    .off { background: var(--fill-strong); color: var(--ink-500); }
  `]
})
export class InstallStatus {
  status = input.required<number>();
  private item = () => INSTALLATION_STATUSES.find(s => s.value === this.status());
  label = () => this.item()?.label ?? '—';
  tone = () => this.item()?.tone ?? 'off';
}

/** سجل التغييرات لموقع أو جهاز أو تركيب (من غيّر ماذا ومتى، ومن أظهر كلمة السر) */
@Component({
  selector: 'app-device-history', standalone: true, imports: [EmptyState, Alert, UtcPipe, DatePipe, Modal, Pager],
  template: `
    <app-modal [heading]="'سجل: ' + title()" subheading="من غيّر ماذا ومتى — الأحدث أولاً" size="lg" (closed)="closed.emit()">
      <div class="modal-body">
        <app-alert [message]="error()" />
        @if (loading() && !items().length) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!items().length) { <app-empty-state>لا يوجد سجل بعد</app-empty-state> }
        @else {
          <ol class="log">
            @for (l of items(); track l.id) {
              <li class="a-{{ l.action }}">
                <div class="head"><strong>{{ l.userName }}</strong> {{ l.actionAr }}<time>{{ l.createdAt | utc | date:'yyyy/MM/dd — HH:mm' }}</time></div>
                @if (l.details) { <pre>{{ l.details }}</pre> }
              </li>
            }
          </ol>
          <app-pager [sizes]="[]" [page]="page()" [pageSize]="20" [total]="total()" [disabled]="loading()" (pageChange)="load($event)" />
        }
      </div>
      <footer class="modal-actions"><button type="button" class="ghost" (click)="closed.emit()">إغلاق</button></footer>
    </app-modal>`,
  styles: [`
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .log li { padding: 10px 12px; border-radius: 12px; background: var(--fill); border-inline-start: 3px solid var(--border-strong); }
    .log li.a-4, .log li.a-5 { border-inline-start-color: var(--warning-700); }
    .log li.a-3 { border-inline-start-color: var(--danger-700); }
    .log li.a-1, .log li.a-7 { border-inline-start-color: var(--brand-600); }
    .head { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; font-size: 13.5px; }
    time { margin-inline-start: auto; font-size: 12px; color: var(--ink-400); font-variant-numeric: tabular-nums; }
    pre { margin: 6px 0 0; white-space: pre-wrap; font-family: inherit; font-size: 12.5px; color: var(--ink-600); }
  `]
})
export class DeviceHistory implements OnInit {
  private service = inject(DeviceService);

  kind = input.required<'site' | 'device' | 'installation'>();
  entityId = input.required<number>();
  title = input('');
  closed = output<void>();

  items = signal<DeviceInventoryLog[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  ngOnInit() { this.load(1); }

  load(page: number) {
    this.page.set(page); trackRequest(this.service.history(this.kind(), this.entityId(), page), this.loading, this.error, r => { this.items.set(r.items); this.total.set(r.totalCount); });
  }
}

/**
 * استيراد التركيبات من Excel: تنزيل القالب ← اختيار الملف ← معاينة (لا يُحفظ شيء) ← «استيراد الأسطر الصالحة».
 * الموقع يجب أن يكون موجوداً، والجهاز الجديد يُضاف إلى الكتالوج (قرار المستخدم 2026-10-05).
 */
@Component({
  selector: 'app-installations-import', standalone: true, imports: [Alert, Modal],
  template: `
    <app-modal heading="استيراد التركيبات من Excel" subheading="معاينة أولاً — لا يُحفظ شيء قبل تأكيدك" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <div class="modal-body form-stack">
        <app-alert [message]="error()" />
        <ol class="steps">
          <li>نزّل <button type="button" class="link-btn" (click)="template()">قالب الاستيراد</button> واملأه (الأعمدة الحمراء مطلوبة، وتعليمات في الورقة الثانية).</li>
          <li>المواقع يجب أن تكون مضافة مسبقاً بنفس الاسم؛ الأجهزة الجديدة تُضاف إلى الكتالوج تلقائياً.</li>
          <li>ارفع الملف للمعاينة، ثم استورد الأسطر الصالحة.</li>
        </ol>
        <label class="form-field"><span class="form-label">ملف Excel (‎.xlsx، حتى 2000 سطر)</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="picked($event)" [disabled]="busy()"></label>

        @if (report(); as r) {
          <div class="summary" role="status">
            <span><strong>{{ r.total }}</strong> سطر</span>
            <span class="ok"><strong>{{ r.valid }}</strong> صالح</span>
            <span class="bad"><strong>{{ r.total - r.valid }}</strong> مرفوض</span>
            @if (r.newDevices.length) { <span>أجهزة جديدة للكتالوج: {{ r.newDevices.join('، ') }}</span> }
            @if (!r.dryRun) { <span class="ok">✓ استُورد {{ r.imported }} تركيباً</span> }
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>السطر</th><th>النتيجة</th><th>الموقع</th><th>الجهاز</th><th>IP</th><th>ملاحظة</th></tr></thead>
            <tbody>
              @for (row of r.rows; track row.row) {
                <tr [class.rejected]="!row.ok">
                  <td>{{ row.row }}</td><td>{{ row.ok ? '✓ صالح' : '✕ مرفوض' }}</td>
                  <td>{{ row.site || '—' }}</td><td>{{ row.device || '—' }}</td><td class="mono">{{ row.ip || '—' }}</td>
                  <td class="wrap">{{ row.message || '—' }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </div>
      <footer class="modal-actions">
        <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">{{ report() && !report()!.dryRun ? 'إغلاق' : 'إلغاء' }}</button>
        @if (report(); as r) {
          @if (r.dryRun) {
            <button type="button" (click)="commit()" [disabled]="!r.valid || busy()">{{ busy() ? 'جارٍ الاستيراد…' : 'استيراد ' + r.valid + ' سطراً صالحاً' }}</button>
          }
        }
      </footer>
    </app-modal>`,
  styles: [`
    .steps { margin: 0; padding-inline-start: 20px; display: grid; gap: 4px; font-size: 13px; color: var(--ink-600); }
    .link-btn { display: inline; min-height: 0; padding: 0; border: 0; background: none; color: var(--brand-700); font-weight: 700; text-decoration: underline; box-shadow: none; }
    .link-btn:hover { transform: none; box-shadow: none; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 12px; border-radius: 12px; background: var(--fill); font-size: 13px; }
    .summary .ok { color: var(--brand-800); } .summary .bad { color: var(--danger-700); }
    table { min-width: 0; }
    tr.rejected td { color: var(--danger-700); }
    .table-wrap { max-height: 320px; overflow: auto; }
  `]
})
export class InstallationsImport {
  private service = inject(DeviceService);
  imported = output<number>();
  closed = output<void>();

  file = signal<File | null>(null);
  report = signal<ImportReport | null>(null);
  busy = signal(false);
  error = signal('');

  template() {
    this.service.importTemplate().subscribe({
      next: blob => saveBlob(blob, 'قالب-استيراد-التركيبات.xlsx'),
      error: e => this.error.set(e.message)
    });
  }

  picked(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.file.set(file); this.report.set(null); this.error.set('');
    if (file) this.send(true);
  }

  commit() { this.send(false); }

  private send(dryRun: boolean) {
    const file = this.file();
    if (!file) return;
    trackRequest(this.service.importInstallations(file, dryRun), this.busy, this.error, r => { this.report.set(r); if (!dryRun) this.imported.emit(r.imported); });
  }
}
