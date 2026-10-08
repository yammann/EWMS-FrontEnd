import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { AssignedTaskService } from '../data-access/assigned-task.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission, TASK_ASSIGN, TASK_OVERSIGHT } from '@core/constants/access';
import { NotificationService } from '@core/services/notification.service';
import {
  AssignedTaskCard, AssignedTaskDetail, TaskBoardMode, TaskPriority, TaskStatus, TaskTargetType,
  TASK_PRIORITY_LABEL, TASK_STATUS_LABEL
} from '../data-access/assigned-task.models';

import { StatTile } from '@shared/ui/stat-tile';
import { TaskDetailDrawer } from '../components/task-detail-drawer';
import { TaskNoteDialog } from '../components/task-note-dialog';
import { TaskCalendar } from '../components/task-calendar';
import { ConfirmService } from '@shared/ui/confirm.service';
import { TaskFormDialog, TaskFormMode } from '../components/task-form-dialog';
import { ToastService } from '@shared/ui/toast.service';

interface Column { status: TaskStatus; label: string; hint: string; }

/**
 * لوحة المهام: أربعة أعمدة (لم تُنفَّذ / قيد التنفيذ / بانتظار المراجعة / تم التنفيذ) وتغيير الحالة بالسحب والإفلات.
 * الإفلات مسموح فقط في الأعمدة التي يحسبها الخادم لكل بطاقة (allowedStatuses)، وبديله بلوحة المفاتيح أزرار الحالة داخل تفاصيل المهمة.
 * «تم التنفيذ» تحتاج تأكيداً، وإعادة مهمة من المراجعة إلى التنفيذ بيد المُسنِد تحتاج سبباً.
 */
@Component({
  selector: 'app-task-board', standalone: true,
  imports: [CommonModule, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, StatTile, TaskDetailDrawer, TaskFormDialog, TaskNoteDialog, TaskCalendar, RouterLink],
  templateUrl: './task-board-page.html',
  styleUrl: './task-board-page.scss'
})
export class TaskBoardPage {
  private service = inject(AssignedTaskService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirm = inject(ConfirmService);

  columns: Column[] = [
    { status: 'Todo', label: TASK_STATUS_LABEL.Todo, hint: 'بانتظار البدء' },
    { status: 'InProgress', label: TASK_STATUS_LABEL.InProgress, hint: 'يجري العمل عليها' },
    { status: 'InReview', label: TASK_STATUS_LABEL.InReview, hint: 'بانتظار اعتماد المُسنِد' },
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

  // الفلاتر (محلية على ما حمّله الخادم، عدا doneDays فيُعاد التحميل به)
  search = signal('');
  priorityFilter = signal<TaskPriority | ''>('');
  setPriorityFilter(value: string) { this.priorityFilter.set(value as TaskPriority | ''); }
  overdueOnly = signal(false);
  creatorFilter = signal('');
  targetFilter = signal('');
  dueFrom = signal('');
  dueTo = signal('');
  doneDays = signal(30);
  /** عرض اللوحة أو التقويم (يُحفظ في المتصفح) */
  view = signal<'board' | 'calendar'>(this.savedView());
  exporting = signal(false);
  canRecurring = computed(() => this.auth.hasAnyPermission(TASK_ASSIGN));
  canStats = computed(() => this.auth.hasPermission(AppPermission.ViewTaskStats));
  filtersActive = computed(() => !!(this.creatorFilter() || this.targetFilter() || this.dueFrom() || this.dueTo() || this.doneDays() !== 30));

  /** خيارات الفلاتر المشتقة من المهام المحمّلة */
  creators = computed(() => [...new Set(this.tasks().map(t => t.createdByName))].sort((a, b) => a.localeCompare(b, 'ar')));
  targets = computed(() => [...new Set(this.tasks().map(t => t.targetName))].sort((a, b) => a.localeCompare(b, 'ar')));

  // التفاصيل والنماذج
  openTaskId = signal<number | null>(null);
  form = signal<{ mode: TaskFormMode; task: AssignedTaskDetail | null } | null>(null);
  /** إعادة بطاقة من المراجعة إلى التنفيذ تنتظر كتابة السبب */
  returning = signal<AssignedTaskCard | null>(null);
  returnBusy = signal(false);

  /** تبويب "كل مهام نطاقي": لمن يملك صلاحية إسناد أو تولٍّ (يتحدّث من اللوحة نفسها) */
  private hasScope = signal(false);
  isLeader = computed(() => this.hasScope() || this.auth.hasAnyPermission(TASK_OVERSIGHT));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const p = this.priorityFilter();
    const overdue = this.overdueOnly();
    const creator = this.creatorFilter(), target = this.targetFilter();
    const from = this.dueFrom(), to = this.dueTo();
    return this.tasks().filter(t =>
      (!q || t.title.toLowerCase().includes(q) || t.targetName.toLowerCase().includes(q) || t.createdByName.toLowerCase().includes(q))
      && (!p || t.priority === p)
      && (!overdue || t.isOverdue)
      && (!creator || t.createdByName === creator)
      && (!target || t.targetName === target)
      && (!from || (!!t.dueDate && t.dueDate.slice(0, 10) >= from))
      && (!to || (!!t.dueDate && t.dueDate.slice(0, 10) <= to)));
  });

  byStatus = computed(() => {
    const groups: Record<TaskStatus, AssignedTaskCard[]> = { Todo: [], InProgress: [], InReview: [], Done: [] };
    for (const t of this.filtered()) groups[t.status].push(t);
    return groups;
  });

  counts = computed(() => {
    const all = this.tasks();
    return {
      todo: all.filter(t => t.status === 'Todo').length,
      inProgress: all.filter(t => t.status === 'InProgress').length,
      inReview: all.filter(t => t.status === 'InReview').length,
      overdue: all.filter(t => t.isOverdue).length
    };
  });

  constructor() {
    // الرابط يحمل العرض (?mode=) والمهمة المفتوحة (?task=) — روابط الإشعارات تفتح المهمة مباشرة
    let loadedMode: TaskBoardMode | null = null;
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const mode = (p.get('mode') as TaskBoardMode | null) ?? 'incoming';
      if (mode !== loadedMode) { loadedMode = mode; this.mode.set(mode); this.creatorFilter.set(''); this.targetFilter.set(''); this.load(); }
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
    this.service.board(this.mode(), this.doneDays()).subscribe({
      next: b => {
        this.tasks.set(b.tasks); this.canCreate.set(b.canCreate);
        this.targetTypes.set(b.targetTypes ?? []); this.hasScope.set(b.hasScope);
        this.loading.set(false);
      },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  private savedView(): 'board' | 'calendar' {
    try { return localStorage.getItem('ewms_task_view') === 'calendar' ? 'calendar' : 'board'; } catch { return 'board'; }
  }

  setView(view: 'board' | 'calendar') {
    this.view.set(view);
    try { localStorage.setItem('ewms_task_view', view); } catch { /* التفضيل اختياري */ }
  }

  setDoneDays(days: number) { this.doneDays.set(days); this.load(false); }

  clearFilters() {
    this.creatorFilter.set(''); this.targetFilter.set(''); this.dueFrom.set(''); this.dueTo.set('');
    if (this.doneDays() !== 30) this.setDoneDays(30);
  }

  /** تصدير المهام المعروضة بفلاتر الواجهة نفسها إلى Excel */
  exportExcel() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.service.exportExcel({
      mode: this.mode(), doneDays: this.doneDays(), q: this.search().trim() || undefined, priority: this.priorityFilter() || undefined,
      overdueOnly: this.overdueOnly() || undefined, dueFrom: this.dueFrom() || undefined, dueTo: this.dueTo() || undefined
    }).subscribe({
      next: blob => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `tasks-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => { this.exporting.set(false); this.toast.error(e.message); }
    });
  }

  setMode(mode: TaskBoardMode) {
    this.router.navigate([], { queryParams: { mode, task: null }, queryParamsHandling: 'merge' });
  }

  // ─────────── السحب والإفلات ───────────
  async drop(event: CdkDragDrop<TaskStatus>) {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as AssignedTaskCard;
    const to = event.container.data;

    // الإعادة من المراجعة بيد المُسنِد تُسأل عن السبب أولاً، و«تم التنفيذ» تُؤكَّد — وإن تراجع المستخدم تبقى البطاقة مكانها
    if (task.status === 'InReview' && to === 'InProgress' && task.needsReturnNote) { this.returning.set(task); return; }
    if (to === 'Done' && !(await this.confirm.ask(`اعتماد «${task.title}» «تم التنفيذ»؟ تُقفل بعدها ولا يمكن تغييرها.`, 'اعتماد'))) return;
    this.move(task, to);
  }

  private move(task: AssignedTaskCard, to: TaskStatus, note?: string, done?: () => void) {
    const from = task.status;
    // تحديث متفائل ثم التراجع إن رفض الخادم
    this.patch(task.id, { status: to, statusAr: TASK_STATUS_LABEL[to] });
    this.service.changeStatus(task.id, to, note).subscribe({
      next: updated => { this.patch(task.id, updated); this.toast.success(`«${task.title}» ← ${TASK_STATUS_LABEL[to]}`); done?.(); },
      error: e => { this.patch(task.id, { status: from, statusAr: TASK_STATUS_LABEL[from] }); this.toast.error(e.message); done?.(); }
    });
  }

  returnWithNote(note: string) {
    const task = this.returning();
    if (!task) return;
    this.returnBusy.set(true);
    this.move(task, 'InProgress', note, () => { this.returnBusy.set(false); this.returning.set(null); });
  }

  /** يسمح بالإفلات فقط في أعمدة الحالات المسموحة لهذه البطاقة (يحسبها الخادم) */
  canDrop = (drag: CdkDrag<AssignedTaskCard>, drop: CdkDropList<TaskStatus>) => drag.data.allowedStatuses.includes(drop.data);

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

  uploadFailed(message: string) { this.toast.error(`حُفظت المهمة لكن تعذّر رفع المرفقات: ${message}`); }

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
