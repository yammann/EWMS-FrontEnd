import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../shared/ui/modal';
import { AssignedTaskService } from '../../core/services/assigned-task.service';
import {
  AssignedTaskDetail, TaskPriority, TaskTargetKind, TaskTargetOption, TaskTargetType, TASK_PRIORITY_LABEL, TASK_PRIORITY_VALUE
} from '../../core/models/assigned-task.models';

export type TaskFormMode = 'create' | 'edit' | 'delegate';

const TARGET_LABEL: Record<TaskTargetKind, string> = { Department: 'قسم', Office: 'مكتب', User: 'موظف' };

/** نافذة إنشاء مهمة / تعديلها / تفويض جزء من مهمة واردة لجهة أدنى */
@Component({
  selector: 'app-task-form-dialog', standalone: true, imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal [heading]="heading()" [subheading]="subheading()" size="lg" [busy]="saving()" (closed)="close.emit()">

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="modal-body form-stack">
            @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

            <label class="form-field">
              <span class="form-label">عنوان المهمة</span>
              <input formControlName="title" maxlength="200" placeholder="مثال: إعداد تقرير الجرد الشهري" autofocus>
              @if (form.controls.title.touched && form.controls.title.invalid) { <small class="form-error">العنوان مطلوب</small> }
            </label>

            @if (mode() !== 'edit') {
              @if (mode() === 'create' && targetTypes().length > 1) {
                <fieldset class="form-field">
                  <legend class="form-label">نوع الجهة</legend>
                  <div class="segmented types" role="radiogroup">
                    @for (type of targetTypes(); track type.value) {
                      <button type="button" class="seg" role="radio" [attr.aria-checked]="kind() === type.value"
                              [class.on]="kind() === type.value" (click)="chooseKind(type.value)">{{ type.label }}</button>
                    }
                  </div>
                </fieldset>
              }
              <label class="form-field">
                <span class="form-label">إسناد إلى {{ targetLabel() }}</span>
                <select formControlName="targetId">
                  <option [ngValue]="0">{{ targetsLoading() ? 'جارٍ التحميل…' : 'اختر ' + targetLabel() }}</option>
                  @for (t of targets(); track t.id) {
                    <option [ngValue]="t.id">{{ t.name }}@if (targetLabel() !== 'موظف') { — {{ t.headNames || 'لا أحد يتولاها حالياً' }} }</option>
                  }
                </select>
                @if (!targetsLoading() && !targets().length) { <small class="form-hint">لا توجد جهات متاحة للإسناد ضمن صلاحياتك.</small> }
                @else if (selectedTarget() && targetLabel() !== 'موظف' && !selectedTarget()!.headNames) {
                  <small class="form-hint warn">لا يوجد من يملك صلاحية تولّي مهام هذه الجهة حالياً — ستبقى المهمة بانتظاره.</small>
                }
              </label>
            } @else {
              <p class="readonly-target">مُسندة إلى: <strong>{{ task()?.targetName }}</strong></p>
            }

            <fieldset class="form-field">
              <legend class="form-label">الأولوية</legend>
              <div class="segmented" role="radiogroup">
                @for (p of priorities; track p) {
                  <button type="button" class="seg p-{{ p }}" role="radio" [attr.aria-checked]="form.value.priority === p"
                          [class.on]="form.value.priority === p" (click)="form.patchValue({ priority: p })">{{ priorityLabel[p] }}</button>
                }
              </div>
            </fieldset>

            <label class="form-field">
              <span class="form-label">تاريخ التسليم <small class="muted">(اختياري)</small></span>
              <input type="date" formControlName="dueDate" [min]="mode() === 'edit' ? '' : today">
            </label>

            <label class="form-field">
              <span class="form-label">الوصف والتعليمات <small class="muted">(اختياري)</small></span>
              <textarea formControlName="description" rows="5" maxlength="4000" placeholder="ما المطلوب بالتحديد؟ أي ملاحظات أو معايير للإنجاز"></textarea>
            </label>
          </div>

          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="close.emit()" [disabled]="saving()">إلغاء</button>
            <button type="submit" [disabled]="form.invalid || saving() || (mode() !== 'edit' && !form.value.targetId)">
              {{ saving() ? 'جارٍ الحفظ…' : (mode() === 'edit' ? 'حفظ التعديلات' : 'إسناد المهمة') }}
            </button>
          </footer>
        </form>
    </app-modal>`,
  styles: [`
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    .segmented { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .segmented.types { grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); }
    .seg { min-height: 40px; padding: 0 8px; background: var(--surface); color: var(--ink-600); border: 1px solid var(--border-strong); font-weight: 700; }
    .seg:hover:not(:disabled) { background: var(--ink-50); box-shadow: none; transform: none; }
    .seg.on { color: var(--on-brand); border-color: transparent; }
    .seg.on.p-Low { background: var(--ink-500); }
    .seg.on.p-Normal { background: var(--info-500); }
    .seg.on.p-High { background: var(--warning-700); }
    .seg.on.p-Urgent { background: var(--danger-600); }
    .form-hint.warn { color: var(--warning-700); }
    .readonly-target { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--ink-50); font-size: 13px; color: var(--ink-600); }
  `]
})
export class TaskFormDialog implements OnInit {
  private service = inject(AssignedTaskService);
  private fb = inject(FormBuilder);

  mode = input.required<TaskFormMode>();
  /** للتعديل: المهمة نفسها — للتفويض: المهمة الأصل */
  task = input<AssignedTaskDetail | null>(null);
  /** أنواع الإسناد المتاحة لي (من اللوحة) — يظهر اختيار النوع إن كانت أكثر من واحد */
  targetTypes = input<TaskTargetType[]>([]);
  saved = output<AssignedTaskDetail>();
  close = output<void>();

  priorities: TaskPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
  priorityLabel = TASK_PRIORITY_LABEL;
  today = new Date().toISOString().slice(0, 10);
  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    priority: ['Normal' as TaskPriority],
    dueDate: [''],
    targetId: [0]
  });

  targets = signal<TaskTargetOption[]>([]);
  targetsLoading = signal(false);
  /** نوع الجهة المختار (الإنشاء) أو المشتق من المهمة الأصل (التفويض: قسم ← مكتب، مكتب ← موظف) */
  kind = signal<TaskTargetKind | null>(null);
  targetLabel = computed(() => TARGET_LABEL[this.kind() ?? 'User']);

  private targetId = signal(0);
  selectedTarget = computed(() => this.targets().find(t => t.id === this.targetId()) ?? null);

  heading = computed(() => ({ create: 'مهمة جديدة', edit: 'تعديل المهمة', delegate: 'تفويض مهمة فرعية' })[this.mode()]);
  subheading = computed(() => this.mode() === 'delegate' && this.task() ? `من المهمة: «${this.task()!.title}»` : '');

  ngOnInit() {
    const t = this.task();
    if (this.mode() === 'edit' && t) {
      this.form.patchValue({ title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate?.slice(0, 10) ?? '' });
    } else if (this.mode() === 'delegate' && t) {
      // التفويض يرث الأولوية والموعد من الأصل افتراضياً، والجهات أدنى منه بدرجة
      this.form.patchValue({ priority: t.priority, dueDate: t.dueDate?.slice(0, 10) ?? '' });
      this.kind.set(t.targetType === 'Department' ? 'Office' : 'User');
      this.loadTargets({ parentTaskId: t.id });
    } else if (this.mode() === 'create') {
      const first = this.targetTypes()[0]?.value;
      if (first) this.chooseKind(first);
    }
    this.form.controls.targetId.valueChanges.subscribe(v => this.targetId.set(Number(v)));
  }

  chooseKind(kind: TaskTargetKind) {
    if (this.kind() === kind && this.targets().length) return;
    this.kind.set(kind);
    this.form.patchValue({ targetId: 0 });
    this.loadTargets({ type: kind });
  }

  private loadTargets(options: { type?: TaskTargetKind; parentTaskId?: number }) {
    this.targets.set([]);
    this.targetsLoading.set(true);
    this.service.targets(options).subscribe({
      next: list => { this.targets.set(list); this.targetsLoading.set(false); },
      error: e => { this.error.set(e.message); this.targetsLoading.set(false); }
    });
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const common = {
      title: v.title.trim(),
      description: v.description.trim(),
      priority: TASK_PRIORITY_VALUE[v.priority],
      dueDate: v.dueDate || null
    };
    if (!common.title) { this.error.set('أدخل عنوان المهمة'); return; }

    this.saving.set(true); this.error.set('');
    const request = this.mode() === 'edit'
      ? this.service.update(this.task()!.id, common)
      : this.service.create({
        ...common, targetId: Number(v.targetId),
        targetType: this.mode() === 'create' ? this.kind() : null,
        parentTaskId: this.mode() === 'delegate' ? this.task()!.id : null
      });

    request.subscribe({
      next: result => { this.saving.set(false); this.saved.emit(result); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
