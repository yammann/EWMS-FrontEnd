import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';
import { Device } from '../../core/models/device.models';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';

/** أنواع الأجهزة (قابلة للتكرار) — كل تركيب في موقع له IP ومعلومات خاصة به من صفحة التركيبات */
@Component({
  selector: 'app-devices-catalog-page', standalone: true, imports: [ReactiveFormsModule, RouterLink, Modal],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>الأجهزة</h1><p class="muted">أنواع وموديلات الأجهزة — الجهاز الواحد يمكن تركيبه عدة مرات في نفس الموقع أو في مواقع مختلفة</p></div>
        <div class="header-actions">
          @if (access().canCreate) { <button class="btn" type="button" (click)="openForm(null)">+ جهاز جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <section class="panel">
        <div class="panel-heading"><h2>الأجهزة <span class="count">({{ filtered().length }})</span></h2>
          <input class="search" type="search" placeholder="بحث بالاسم أو الموديل…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
        </div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!filtered().length) { <p class="empty-state">{{ search() ? 'لا توجد نتائج' : 'لا توجد أجهزة بعد' }}</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الجهاز</th><th>الموديل</th><th>الوصف</th><th>التركيبات</th>@if (access().canEdit || access().canDelete) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (d of filtered(); track d.id) {
                <tr>
                  <td class="cell-strong">{{ d.name }}</td>
                  <td>{{ d.model || '—' }}</td>
                  <td class="wrap">{{ d.description || '—' }}</td>
                  <td><a class="cell-link" [routerLink]="['/devices/installations']" [queryParams]="{ deviceId: d.id }">{{ installCounts().get(d.id) ?? 0 }} تركيب ←</a></td>
                  @if (access().canEdit || access().canDelete) {
                    <td><div class="row-actions">
                      @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(d)">تعديل</button> }
                      @if (access().canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(d)">حذف</button> }
                    </div></td>
                  }
                </tr>
              }
            </tbody>
          </table></div>
        }
      </section>
    </div>

    @if (formOpen()) {
      <app-modal [heading]="editing() ? 'تعديل الجهاز' : 'جهاز جديد'" [busy]="saving()" (closed)="closeForm()">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body form-grid-2">
              @if (formError()) { <p class="alert alert-error full" role="alert">{{ formError() }}</p> }
              <label class="form-field full"><span class="form-label">اسم الجهاز</span><input formControlName="name" maxlength="100" placeholder="مثال: راوتر رئيسي"></label>
              <label class="form-field full"><span class="form-label">الموديل <small class="hint">(اختياري)</small></span><input formControlName="model" maxlength="100" dir="ltr"></label>
              <p class="hint full">الرقم التسلسلي يُسجَّل لكل قطعة عند تركيبها (صفحة التركيبات).</p>
              <label class="form-field full"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="500"></textarea></label>
            </div>
            <footer class="modal-actions">
              <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
              <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
            </footer>
          </form>
      </app-modal>
    }
`
})
export class DevicesCatalogPage {
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  access = this.service.access;

  devices = signal<Device[]>([]);
  installCounts = signal(new Map<number, number>());
  search = signal('');
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Device | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.devices().filter(d => [d.name, d.model, d.description].some(f => (f ?? '').toLowerCase().includes(q))) : this.devices();
  });

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    model: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(500)]
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ devices: this.service.devices(), installations: this.service.installations() }).subscribe({
      next: r => { this.devices.set(r.devices); this.installCounts.set(this.service.countBy(r.installations, i => i.deviceId)); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  openForm(d: Device | null) {
    this.editing.set(d); this.formError.set('');
    this.form.reset({ name: d?.name ?? '', model: d?.model ?? '', description: d?.description ?? '' });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  async askDelete(d: Device) {
    if (!await this.confirm.ask(`حذف الجهاز «${d.name}»؟ لا يمكن حذف جهاز له تركيبات.`, 'حذف')) return;
    this.service.deleteDevice(d.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }


  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), model: v.model.trim(), description: v.description.trim() };
    const d = this.editing();
    this.saving.set(true); this.formError.set('');
    (d ? this.service.updateDevice(d.id, body) : this.service.createDevice(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

}
