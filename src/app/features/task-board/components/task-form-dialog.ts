import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TASK_ASSIGN } from '@core/constants/access';
import { ToastService } from '@shared/ui/toast.service';
import { Modal } from '@shared/ui/modal';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import {
  AssignedTaskDetail, TaskPriority, TaskTargetKind, TaskTargetOption, TaskTargetType, TaskTemplate, TASK_ATTACHMENTS, TASK_PRIORITY_LABEL,
  TASK_PRIORITY_VALUE, attachmentProblem
} from '../data-access/assigned-task.models';
import { fileSize } from '@core/utils/file-size';
import { fileIcon } from './task-attachments';
import { Alert } from '@shared/ui/alert';
import { LineList, cleanLines } from '@shared/ui/line-list';

export type TaskFormMode = 'create' | 'edit' | 'delegate';

const TARGET_LABEL: Record<TaskTargetKind, string> = { Department: 'قسم', Office: 'مكتب', User: 'موظف' };

/** نافذة إنشاء مهمة / تعديلها / تفويض جزء من مهمة واردة لجهة أدنى */
@Component({
  selector: 'app-task-form-dialog', standalone: true, imports: [Alert, LineList, ReactiveFormsModule, FormsModule, Modal],
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
  /** أنواع الإسناد المتاحة لي (من اللوحة) — يظهر اختيار النوع إن كانت أكثر من واحد */
  targetTypes = input<TaskTargetType[]>([]);
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
