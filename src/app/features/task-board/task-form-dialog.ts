import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TASK_ASSIGN } from '@core/constants/access';
import { ToastService } from '@shared/ui/toast.service';
import { Modal } from '@shared/ui/modal';
import { AssignedTaskService } from '@core/services/assigned-task.service';
import {
  AssignedTaskDetail, TaskPriority, TaskTargetKind, TaskTargetOption, TaskTargetType, TaskTemplate, TASK_ATTACHMENTS, TASK_PRIORITY_LABEL,
  TASK_PRIORITY_VALUE, attachmentProblem
} from '@core/models/assigned-task.models';
import { fileSize } from '@core/utils/file-size';
import { fileIcon } from './task-attachments';

export type TaskFormMode = 'create' | 'edit' | 'delegate';

const TARGET_LABEL: Record<TaskTargetKind, string> = { Department: 'قسم', Office: 'مكتب', User: 'موظف' };

/** نافذة إنشاء مهمة / تعديلها / تفويض جزء من مهمة واردة لجهة أدنى */
@Component({
  selector: 'app-task-form-dialog', standalone: true, imports: [ReactiveFormsModule, FormsModule, Modal],
  template: `
    <app-modal [heading]="heading()" [subheading]="subheading()" size="lg" [busy]="saving()" (closed)="close.emit()">

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="modal-body form-stack">
            @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

            @if (mode() === 'create' && templates().length) {
              <label class="form-field">
                <span class="form-label">البدء من قالب <small class="muted">(اختياري — يملأ الحقول وتبقى قابلة للتعديل)</small></span>
                <select [ngModel]="''" [ngModelOptions]="{ standalone: true }" (ngModelChange)="applyTemplate($event)">
                  <option value="">بدون قالب</option>
                  @for (t of templates(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
                </select>
              </label>
            }

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

            @if (mode() !== 'edit') {
              <label class="form-field">
                <span class="form-label">بنود التحقق <small class="muted">(اختياري — بند في كل سطر، حتى {{ maxItems }})</small></span>
                <textarea [ngModel]="itemsText()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="itemsText.set($event)" rows="3"
                          placeholder="خطوات صغيرة تُنشأ مع المهمة ويعلّمها المنفِّذ"></textarea>
              </label>
              <div class="form-field">
                <span class="form-label">مرفقات <small class="muted">(اختياري — حتى {{ maxFiles }} ملفات، 10MB للملف: PDF وصور وWord وExcel وPowerPoint)</small></span>
                <input #picker type="file" multiple hidden [accept]="accept" (change)="pick($event)">
                @if (files().length) {
                  <ul class="picked">
                    @for (f of files(); track f) {
                      <li><span aria-hidden="true">{{ icon(f.type) }}</span><span class="n">{{ f.name }}</span><small>{{ size(f.size) }}</small>
                        <button type="button" class="x" (click)="dropFile(f)" [disabled]="saving()" [attr.aria-label]="'إزالة ' + f.name">×</button></li>
                    }
                  </ul>
                }
                <button type="button" class="btn btn-ghost btn-sm add-file" (click)="picker.click()" [disabled]="saving() || files().length >= maxFiles">+ إرفاق ملف</button>
                @if (fileProblem()) { <small class="form-error">{{ fileProblem() }}</small> }
              </div>
            }
          </div>

          @if (templateNaming()) {
            <div class="tpl-save">
              <input [ngModel]="templateName()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="templateName.set($event)" (keydown.enter)="$event.preventDefault(); saveAsTemplate()"
                     maxlength="100" placeholder="اسم القالب" aria-label="اسم القالب">
              <button type="button" class="btn btn-sm" (click)="saveAsTemplate()" [disabled]="!templateName().trim() || templateBusy()">حفظ القالب</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="templateNaming.set(false)">إلغاء</button>
            </div>
          }
          <footer class="modal-actions">
            @if (canTemplate() && !templateNaming()) {
              <button type="button" class="ghost tpl-btn" (click)="templateNaming.set(true)" [disabled]="saving() || !form.value.title?.trim()">حفظ كقالب</button>
            }
            <button type="button" class="ghost" (click)="close.emit()" [disabled]="saving()">إلغاء</button>
            <button type="submit" [disabled]="form.invalid || saving() || (mode() !== 'edit' && !form.value.targetId)">
              {{ saving() ? (uploadText() || 'جارٍ الحفظ…') : (mode() === 'edit' ? 'حفظ التعديلات' : 'إسناد المهمة') }}
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
    .picked { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 4px; }
    .picked li { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: var(--radius-md); background: var(--fill); font-size: 13px; }
    .picked .n { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .picked small { color: var(--ink-500); }
    .picked .x { min-height: 28px; width: 28px; padding: 0; background: transparent; color: var(--ink-500); font-size: 18px; box-shadow: none; }
    .tpl-save { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 20px; border-top: 1px solid var(--border); }
    .tpl-save input { flex: 1; min-width: 160px; }
    .tpl-btn { margin-inline-end: auto; }
    .add-file { justify-self: start; }
    .readonly-target { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--ink-50); font-size: 13px; color: var(--ink-600); }
  `]
})
export class TaskFormDialog implements OnInit {
  private service = inject(AssignedTaskService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  mode = input.required<TaskFormMode>();
  /** للتعديل: المهمة نفسها — للتفويض: المهمة الأصل */
  task = input<AssignedTaskDetail | null>(null);
  /** أنواع الإسناد المتاحة لي (من اللوحة) — يظهر اختيار النوع إن كانت أكثر من واحد */
  targetTypes = input<TaskTargetType[]>([]);
  saved = output<AssignedTaskDetail>();
  /** حُفظت المهمة لكن فشل رفع المرفقات (تبقى المهمة، وتُضاف الملفات من تفاصيلها) */
  uploadFailed = output<string>();
  close = output<void>();

  maxItems = 30;
  templates = signal<TaskTemplate[]>([]);
  itemsText = signal('');
  templateNaming = signal(false);
  templateName = signal('');
  templateBusy = signal(false);
  /** القوالب لمن يملك صلاحية إسناد، وفي الإنشاء فقط */
  canTemplate = computed(() => this.mode() === 'create' && this.auth.hasAnyPermission(TASK_ASSIGN));

  maxFiles = TASK_ATTACHMENTS.maxFiles;
  accept = TASK_ATTACHMENTS.accept;
  size = fileSize;
  icon = fileIcon;
  files = signal<File[]>([]);
  fileProblem = signal('');
  uploadText = signal('');

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
      if (this.canTemplate()) this.service.templates().subscribe({ next: list => this.templates.set(list), error: () => { /* القوالب اختيارية */ } });
    }
    this.form.controls.targetId.valueChanges.subscribe(v => this.targetId.set(Number(v)));
  }

  /** يملأ النموذج من القالب (العنوان والوصف والأولوية وموعد التسليم وبنود التحقق) */
  applyTemplate(id: string) {
    const t = this.templates().find(x => x.id === Number(id));
    if (!t) return;
    const due = t.defaultDueDays === null ? '' : new Date(Date.now() + t.defaultDueDays * 86_400_000).toISOString().slice(0, 10);
    this.form.patchValue({ title: t.title, description: t.description, priority: t.priority, dueDate: due });
    this.itemsText.set(t.items.join('\n'));
  }

  private items() { return this.itemsText().split('\n').map(i => i.trim()).filter(Boolean); }

  saveAsTemplate() {
    const v = this.form.getRawValue();
    const name = this.templateName().trim();
    if (!name || this.templateBusy()) return;
    const due = v.dueDate ? Math.max(0, Math.round((new Date(v.dueDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)) : null;
    this.templateBusy.set(true);
    this.service.createTemplate({
      name, title: v.title.trim(), description: v.description.trim(), priority: TASK_PRIORITY_VALUE[v.priority],
      defaultDueDays: due, items: this.items()
    }).subscribe({
      next: t => { this.templateBusy.set(false); this.templateNaming.set(false); this.templateName.set(''); this.templates.update(l => [...l, t]); this.toast.success(`حُفظ القالب «${t.name}»`); },
      error: e => { this.templateBusy.set(false); this.error.set(e.message); }
    });
  }

  pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const chosen = [...(input.files ?? [])];
    input.value = '';
    this.fileProblem.set('');
    if (this.files().length + chosen.length > this.maxFiles) { this.fileProblem.set(`الحد الأقصى ${this.maxFiles} ملفات للمهمة`); return; }
    const bad = chosen.map(attachmentProblem).find(p => p);
    if (bad) { this.fileProblem.set(bad); return; }
    this.files.update(list => [...list, ...chosen]);
  }

  dropFile(file: File) { this.files.update(list => list.filter(f => f !== file)); }

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
        parentTaskId: this.mode() === 'delegate' ? this.task()!.id : null,
        checklistItems: this.items()
      });

    request.subscribe({
      next: result => {
        const files = this.files();
        if (this.mode() === 'edit' || !files.length) { this.saving.set(false); this.saved.emit(result); return; }
        // المهمة حُفظت: ترفع الملفات واحداً بعد الآخر، وأي فشل لا يلغي المهمة
        this.uploadText.set(`رفع المرفقات 0 من ${files.length}…`);
        this.service.attachSequentially(result.id, files, (done, total) => this.uploadText.set(`رفع المرفقات ${done} من ${total}…`)).subscribe({
          next: withFiles => { this.saving.set(false); this.saved.emit(withFiles); },
          error: err => { this.saving.set(false); this.saved.emit(result); this.uploadFailed.emit(err.message); }
        });
      },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
