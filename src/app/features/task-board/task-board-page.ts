import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { AssignedTaskService } from '../../core/services/assigned-task.service';
import { AuthService } from '../../core/services/auth.service';
import { TASK_OVERSIGHT } from '../../core/constants/access';
import { NotificationService } from '../../core/services/notification.service';
import {
  AssignedTaskCard, AssignedTaskDetail, TaskBoardMode, TaskPriority, TaskStatus, TaskTargetType,
  TASK_PRIORITY_LABEL, TASK_STATUS_LABEL
} from '../../core/models/assigned-task.models';

import { StatTile } from '../dashboard/dashboard-widgets';
import { TaskDetailDrawer } from './task-detail-drawer';
import { TaskFormDialog, TaskFormMode } from './task-form-dialog';
import { ToastService } from '../../shared/ui/toast.service';

interface Column { status: TaskStatus; label: string; hint: string; }

/**
 * لوحة المهام: ثلاثة أعمدة (لم تُنفَّذ / قيد التنفيذ / تم التنفيذ) وتغيير الحالة بالسحب والإفلات.
 * السحب متاح فقط للجهة المنفِّذة (canChangeStatus)، وبديله بلوحة المفاتيح أزرار الحالة داخل تفاصيل المهمة.
 */
@Component({
  selector: 'app-task-board', standalone: true,
  imports: [CommonModule, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, StatTile, TaskDetailDrawer, TaskFormDialog],
  templateUrl: './task-board-page.html',
  styleUrl: './task-board-page.scss'
})
export class TaskBoardPage {
  private service = inject(AssignedTaskService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  columns: Column[] = [
    { status: 'Todo', label: TASK_STATUS_LABEL.Todo, hint: 'بانتظار البدء' },
    { status: 'InProgress', label: TASK_STATUS_LABEL.InProgress, hint: 'يجري العمل عليها' },
    { status: 'Done', label: TASK_STATUS_LABEL.Done, hint: 'خلال آخر 30 يوماً' }
  ];
  priorityLabel = TASK_PRIORITY_LABEL;
  priorities: TaskPriority[] = ['Urgent', 'High', 'Normal', 'Low'];

  mode = signal<TaskBoardMode>('incoming');
  tasks = signal<AssignedTaskCard[]>([]);
  canCreate = signal(false);
  targetTypes = signal<TaskTargetType[]>([]);
  loading = signal(false);
  error = signal('');
  private toast = inject(ToastService);

  // الفلاتر
  search = signal('');
  priorityFilter = signal<TaskPriority | ''>('');
  overdueOnly = signal(false);

  // التفاصيل والنماذج
  openTaskId = signal<number | null>(null);
  form = signal<{ mode: TaskFormMode; task: AssignedTaskDetail | null } | null>(null);

  /** تبويب "كل مهام نطاقي": لمن يملك صلاحية إسناد أو تولٍّ (يتحدّث من اللوحة نفسها) */
  private hasScope = signal(false);
  isLeader = computed(() => this.hasScope() || this.auth.hasAnyPermission(TASK_OVERSIGHT));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const p = this.priorityFilter();
    const overdue = this.overdueOnly();
    return this.tasks().filter(t =>
      (!q || t.title.toLowerCase().includes(q) || t.targetName.toLowerCase().includes(q) || t.createdByName.toLowerCase().includes(q))
      && (!p || t.priority === p)
      && (!overdue || t.isOverdue));
  });

  byStatus = computed(() => {
    const groups: Record<TaskStatus, AssignedTaskCard[]> = { Todo: [], InProgress: [], Done: [] };
    for (const t of this.filtered()) groups[t.status].push(t);
    return groups;
  });

  counts = computed(() => {
    const all = this.tasks();
    return {
      todo: all.filter(t => t.status === 'Todo').length,
      inProgress: all.filter(t => t.status === 'InProgress').length,
      done: all.filter(t => t.status === 'Done').length,
      overdue: all.filter(t => t.isOverdue).length
    };
  });

  constructor() {
    // الرابط يحمل العرض (?mode=) والمهمة المفتوحة (?task=) — روابط الإشعارات تفتح المهمة مباشرة
    let loadedMode: TaskBoardMode | null = null;
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const mode = (p.get('mode') as TaskBoardMode | null) ?? 'incoming';
      if (mode !== loadedMode) { loadedMode = mode; this.mode.set(mode); this.load(); }
      const id = Number(p.get('task'));
      this.openTaskId.set(id > 0 ? id : null);
    });
    // تحديث تلقائي عند وصول إشعار مهمة (إسناد/تغيير حالة/تعليق)
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => {
      if (n.relatedEntityType === 'AssignedTask') this.load(false);
    });
  }

  load(showSpinner = true) {
    if (showSpinner) this.loading.set(true);
    this.error.set('');
    this.service.board(this.mode()).subscribe({
      next: b => {
        this.tasks.set(b.tasks); this.canCreate.set(b.canCreate);
        this.targetTypes.set(b.targetTypes ?? []); this.hasScope.set(b.hasScope);
        this.loading.set(false);
      },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  setMode(mode: TaskBoardMode) {
    this.router.navigate([], { queryParams: { mode, task: null }, queryParamsHandling: 'merge' });
  }

  // ─────────── السحب والإفلات ───────────
  drop(event: CdkDragDrop<TaskStatus>) {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as AssignedTaskCard;
    const to = event.container.data;
    const from = task.status;

    // تحديث متفائل ثم التراجع إن رفض الخادم
    this.patch(task.id, { status: to, statusAr: TASK_STATUS_LABEL[to] });
    this.service.changeStatus(task.id, to).subscribe({
      next: updated => { this.patch(task.id, updated); this.toast.success(`«${task.title}» ← ${TASK_STATUS_LABEL[to]}`); },
      error: e => { this.patch(task.id, { status: from, statusAr: TASK_STATUS_LABEL[from] }); this.toast.error(e.message); }
    });
  }

  /** يسمح بالإفلات فقط لمن يستطيع تغيير حالة المهمة */
  canDrop = (drag: CdkDrag<AssignedTaskCard>) => drag.data.canChangeStatus;

  private patch(id: number, changes: Partial<AssignedTaskCard>) {
    this.tasks.update(list => list.map(t => t.id === id ? { ...t, ...changes } : t));
  }

  // ─────────── التفاصيل والنماذج ───────────
  open(task: AssignedTaskCard) { this.openTask(task.id); }

  openTask(id: number) {
    this.router.navigate([], { queryParams: { task: id }, queryParamsHandling: 'merge' });
  }

  closeDrawer() {
    this.router.navigate([], { queryParams: { task: null }, queryParamsHandling: 'merge' });
  }

  newTask() { this.openForm('create', null); }
  editTask(task: AssignedTaskDetail) { this.openForm('edit', task); }
  delegateTask(task: AssignedTaskDetail) { this.openForm('delegate', task); }

  private openForm(mode: TaskFormMode, task: AssignedTaskDetail | null) {
    this.form.set({ mode, task });
  }

  formSaved(result: AssignedTaskDetail) {
    const mode = this.form()?.mode;
    this.form.set(null);
    this.toast.success(mode === 'edit' ? 'تم حفظ التعديلات' : `تم إسناد «${result.title}» إلى ${result.targetName}`);
    this.load(false);
    // بعد الإنشاء: تظهر المهمة في "الصادرة"
    if (mode === 'create' && this.mode() === 'incoming') this.setMode('outgoing');
    if (mode !== 'create') this.openTask(mode === 'delegate' ? result.parentTaskId ?? result.id : result.id);
  }

  dueState(t: AssignedTaskCard): 'late' | 'soon' | '' {
    if (!t.dueDate || t.status === 'Done') return '';
    if (t.isOverdue) return 'late';
    const days = (new Date(t.dueDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000;
    return days <= 2 ? 'soon' : '';
  }
}
