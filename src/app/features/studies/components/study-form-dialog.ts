import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { DIWAN_ACCESS } from '@core/constants/access';
import { Alert } from '@shared/ui/alert';
import { Modal } from '@shared/ui/modal';
import { DiwanService } from '@features/diwan';
import { STUDY_MODES, Study, StudyInput } from '../data-access/studies.models';

interface LinkOption { id: number; number: string; subject: string; }

/**
 * فتح أمر دراسة على مشروع أو تعديله: العنوان ورقم الأمر الرسمي والموعد والملاحظات، وترتيب المخرجات (بالتسلسل أو بالتوازي: يقرره
 * رئيس القسم لكل أمر)، وربط اختياري بمعاملة الديوان الواردة التي وصل بها الأمر (يبحث برقمها أو موضوعها لمن يملك صلاحية الديوان).
 */
@Component({
  selector: 'app-study-form-dialog', standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal [heading]="study() ? 'تعديل أمر الدراسة' : 'أمر دراسة جديد'" [subheading]="study() ? study()!.number : ''" size="lg" [busy]="busy()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />

          <label class="form-field"><span class="form-label">عنوان الدراسة</span>
            <input formControlName="title" maxlength="200" autocomplete="off" placeholder="مثال: دراسة ترميم مدرسة الشهيد">
            @if (form.controls.title.touched && form.controls.title.invalid) { <small class="form-error">العنوان مطلوب</small> }
          </label>

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">رقم الأمر الرسمي <small class="hint">(اختياري)</small></span>
              <input formControlName="externalNumber" maxlength="100" autocomplete="off" dir="ltr"></label>
            <label class="form-field"><span class="form-label">موعد الإنجاز <small class="hint">(اختياري — تجاوزه تنبيه لا قرار)</small></span>
              <input type="date" formControlName="dueDate"></label>
          </div>

          <fieldset class="form-field">
            <legend class="form-label">ترتيب المخرجات</legend>
            <div class="modes" role="radiogroup">
              @for (m of modes; track m.value) {
                <label class="mode" [class.on]="form.controls.mode.value === m.value">
                  <input type="radio" [value]="m.value" formControlName="mode"><strong>{{ m.label }}</strong><small>{{ m.hint }}</small>
                </label>
              }
            </div>
          </fieldset>

          @if (canLink) {
            <div class="form-field"><span class="form-label">المعاملة الواردة <small class="hint">(اختياري — التي وصل بها أمر الدراسة)</small></span>
              @if (linked(); as l) {
                <p class="linked"><strong dir="ltr">{{ l.number }}</strong>@if (l.subject) { — {{ l.subject }} }
                  <button type="button" class="btn btn-ghost btn-sm" (click)="linked.set(null)">إزالة</button></p>
              } @else {
                <div class="lookup">
                  <input #q type="search" placeholder="رقم المعاملة (IN-…) أو موضوعها" (keydown.enter)="$event.preventDefault(); search(q.value)" autocomplete="off">
                  <button type="button" class="btn btn-ghost" (click)="search(q.value)" [disabled]="searching()">بحث</button>
                </div>
                @if (results().length) {
                  <ul class="results">
                    @for (r of results(); track r.id) { <li><button type="button" (click)="pick(r)"><strong dir="ltr">{{ r.number }}</strong> — {{ r.subject }}</button></li> }
                  </ul>
                } @else if (searched()) { <small class="hint">لا معاملة واردة مطابقة ضمن صلاحياتك.</small> }
              }
            </div>
          }

          <label class="form-field"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span>
            <textarea formControlName="notes" rows="3" maxlength="2000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="busy()">إلغاء</button>
          <button type="submit" [disabled]="busy()">{{ busy() ? 'جارٍ الحفظ…' : study() ? 'حفظ' : 'فتح الأمر' }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .mode { display: grid; gap: 2px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; }
    .mode input { position: absolute; opacity: 0; pointer-events: none; }
    .mode.on { border-color: var(--brand-600); background: var(--brand-50); }
    .mode small { color: var(--ink-500); }
    .lookup { display: flex; gap: 8px; } .lookup input { flex: 1; }
    .results { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
    .results button { width: 100%; text-align: start; min-height: 0; padding: 8px 12px; border-radius: var(--radius-md); background: var(--fill); box-shadow: none; color: var(--ink-800); }
    .results button:hover { background: var(--fill-strong); transform: none; }
    .linked { display: flex; align-items: center; gap: 8px; margin: 0; flex-wrap: wrap; }
  `]
})
export class StudyFormDialog implements OnInit {
  private fb = inject(FormBuilder);
  private diwan = inject(DiwanService);
  private auth = inject(AuthService);

  projectId = input.required<number>();
  /** التعديل: الأمر نفسه */
  study = input<Study | null>(null);
  busy = input(false);
  error = input('');
  submitted = output<StudyInput>();
  closed = output<void>();

  modes = STUDY_MODES;
  canLink = this.auth.hasAnyPermission(DIWAN_ACCESS);
  linked = signal<LinkOption | null>(null);
  results = signal<LinkOption[]>([]);
  searching = signal(false);
  searched = signal(false);

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    externalNumber: [''],
    dueDate: [''],
    mode: [1],
    notes: ['']
  });

  ngOnInit() {
    const s = this.study();
    if (!s) return;
    this.form.patchValue({ title: s.title, externalNumber: s.externalNumber ?? '', dueDate: s.dueDate?.slice(0, 10) ?? '', mode: s.mode, notes: s.notes });
    if (s.correspondenceId) this.linked.set({ id: s.correspondenceId, number: s.correspondenceNumber ?? '', subject: '' });
  }

  search(text: string) {
    const q = text.trim();
    if (!q || this.searching()) return;
    this.searching.set(true); this.searched.set(false);
    this.diwan.search({ direction: 1, typeId: null, statusId: null, stage: null, projectId: null, search: q, from: '', to: '', overdueOnly: false, inbox: false, page: 1, pageSize: 6 })
      .subscribe({
        next: page => { this.results.set(page.items.map(c => ({ id: c.id, number: c.number ?? '', subject: c.subject }))); this.searching.set(false); this.searched.set(true); },
        error: () => { this.results.set([]); this.searching.set(false); this.searched.set(true); }
      });
  }

  pick(option: LinkOption) { this.linked.set(option); this.results.set([]); }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      projectId: this.projectId(), correspondenceId: this.linked()?.id ?? null, externalNumber: v.externalNumber.trim() || null,
      title: v.title.trim(), notes: v.notes.trim() || null, mode: v.mode, dueDate: v.dueDate || null, rowVersion: this.study()?.rowVersion ?? null
    });
  }
}
