import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TASK_ASSIGN } from '@core/constants/access';
import { ToastService } from '@shared/ui/toast.service';
import { Modal } from '@shared/ui/modal';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import {
  AssignedTaskDetail, TaskPriority, TaskTargetKind, TaskTargetOption, TaskTemplate, TASK_ATTACHMENTS, TASK_PRIORITY_LABEL,
  TASK_PRIORITY_VALUE, attachmentProblem
} from '../data-access/assigned-task.models';
import { fileSize } from '@core/utils/file-size';
import { fileIcon } from './task-attachments';
import { Alert } from '@shared/ui/alert';
import { LineList, cleanLines } from '@shared/ui/line-list';
import { Icon } from '@shared/ui/icon';

export type TaskFormMode = 'create' | 'edit' | 'delegate';

/** عناوين مجموعات القائمة بالترتيب: أقسام ثم مكاتب ثم موظفون */
const GROUPS: { kind: TaskTargetKind; label: string }[] = [
  { kind: 'Department', label: 'الأقسام' }, { kind: 'Office', label: 'المكاتب' }, { kind: 'User', label: 'الموظفون' }
];

/** نافذة إنشاء مهمة / تعديلها / تفويض جزء من مهمة واردة لجهة أدنى */
@Component({
  selector: 'app-task-form-dialog', standalone: true, imports: [Icon, Alert, LineList, ReactiveFormsModule, FormsModule, Modal],
  templateUrl: './task-form-dialog.html',
  styleUrl: './task-form-dialog.scss'
})
export class TaskFormDialog implements OnInit {
  private service = inject(AssignedTaskService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  mode = input.required<TaskFormMode>();
  /** للتعديل: المهمة نفسها — للتفويض: المهمة الأصل */
  task = input<AssignedTaskDetail | null>(null);
  saved = output<AssignedTaskDetail>();
  /** حُفظت المهمة لكن فشل رفع المرفقات (تبقى المهمة، وتُضاف الملفات من تفاصيلها) */
  uploadFailed = output<string>();
  closed = output<void>();

  maxItems = 30;
  templates = signal<TaskTemplate[]>([]);
  /** بنود التحقق كما في الحقول (كل بند سطر، بنمط وينبوكس) */
  items = signal<string[]>(['']);
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
    /** مفتاح الجهة المختارة «النوع:المعرّف» (تتشابه المعرّفات بين الأقسام والمكاتب والموظفين) */
    targetId: ['']
  });

  targets = signal<TaskTargetOption[]>([]);
  targetsLoading = signal(false);
  /** بحث بالاسم داخل القائمة حين تطول (الجهة المختارة تبقى ظاهرة دائماً) */
  filter = signal('');
  showFilter = computed(() => this.targets().length > 8);
  key = (t: TaskTargetOption) => `${t.kind}:${t.id}`;

  private targetKey = signal('');
  selectedTarget = computed(() => this.targets().find(t => this.key(t) === this.targetKey()) ?? null);

  /** الجهات مجمّعة (أقسام ← مكاتب ← موظفون) بعد البحث؛ لا اختيار «نوع»: النوع يأتي من العنصر نفسه */
  groups = computed(() => {
    const q = this.filter().trim().toLowerCase(), chosen = this.targetKey();
    return GROUPS.map(g => ({
      ...g,
      items: this.targets().filter(t => t.kind === g.kind
        && (!q || this.key(t) === chosen || `${t.name} ${t.detail ?? ''} ${t.headNames}`.toLowerCase().includes(q)))
    })).filter(g => g.items.length > 0);
  });

  optionText(t: TaskTargetOption) {
    return t.kind === 'User' ? t.name + (t.detail ? ` — ${t.detail}` : '') : `${t.name} — ${t.headNames || 'لا أحد يتولاها حالياً'}`;
  }

  heading = computed(() => ({ create: 'مهمة جديدة', edit: 'تعديل المهمة', delegate: 'تفويض مهمة فرعية' })[this.mode()]);
  subheading = computed(() => this.mode() === 'delegate' && this.task() ? `من المهمة: «${this.task()!.title}»` : '');

  ngOnInit() {
    const t = this.task();
    if (this.mode() === 'edit' && t) {
      this.form.patchValue({ title: t.title, description: t.description, priority: t.priority, dueDate: t.dueDate?.slice(0, 10) ?? '' });
    } else if (this.mode() === 'delegate' && t) {
      // التفويض يرث الأولوية والموعد من الأصل افتراضياً، والجهات أدنى منه بدرجة
      this.form.patchValue({ priority: t.priority, dueDate: t.dueDate?.slice(0, 10) ?? '' });
      this.loadTargets({ parentTaskId: t.id });
    } else if (this.mode() === 'create') {
      this.loadTargets({});
      if (this.canTemplate()) this.service.templates().subscribe({ next: list => this.templates.set(list), error: () => { /* القوالب اختيارية */ } });
    }
    this.form.controls.targetId.valueChanges.subscribe(v => this.targetKey.set(v));
  }

  /** يملأ النموذج من القالب (العنوان والوصف والأولوية وموعد التسليم وبنود التحقق) */
  applyTemplate(id: string) {
    const t = this.templates().find(x => x.id === Number(id));
    if (!t) return;
    const due = t.defaultDueDays === null ? '' : new Date(Date.now() + t.defaultDueDays * 86_400_000).toISOString().slice(0, 10);
    this.form.patchValue({ title: t.title, description: t.description, priority: t.priority, dueDate: due });
    this.items.set(t.items.length ? [...t.items] : ['']);
  }

  private checklist() { return cleanLines(this.items()); }

  saveAsTemplate() {
    const v = this.form.getRawValue();
    const name = this.templateName().trim();
    if (!name || this.templateBusy()) return;
    const due = v.dueDate ? Math.max(0, Math.round((new Date(v.dueDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)) : null;
    this.templateBusy.set(true);
    this.service.createTemplate({
      name, title: v.title.trim(), description: v.description.trim(), priority: TASK_PRIORITY_VALUE[v.priority],
      defaultDueDays: due, items: this.checklist()
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

  private loadTargets(options: { parentTaskId?: number }) {
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
    const picked = this.selectedTarget();
    if (this.mode() !== 'edit' && !picked) { this.error.set('اختر الجهة'); return; }

    this.saving.set(true); this.error.set('');
    const request = this.mode() === 'edit'
      ? this.service.update(this.task()!.id, common)
      : this.service.create({
        ...common, targetId: picked!.id,
        targetType: picked!.kind,
        parentTaskId: this.mode() === 'delegate' ? this.task()!.id : null,
        checklistItems: this.checklist()
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
