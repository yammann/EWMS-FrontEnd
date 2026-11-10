import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { Alert } from '@shared/ui/alert';
import { ConfirmService } from '@shared/ui/confirm.service';
import { EmptyState } from '@shared/ui/empty-state';
import { CalendarEvent, MonthCalendar } from '@shared/ui/month-calendar';
import { PageHeader } from '@shared/ui/page-header';
import { StatTile } from '@shared/ui/stat-tile';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest } from '@shared/ui/track-request';
import { StudyProgress } from '../components/progress-bar';
import { StudyTaskProgressDialog } from '../components/task-progress-dialog';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { StageTask, StudyTaskStatus, TASK_STATUSES } from '../data-access/studies.models';

/** حجم الطلب الواحد وأقصى عدد طلبات (الخادم يقسّم الصفحات ولا يرشّح بالحالة، فتُحمَّل المهام دفعات ثم تُقسَّم على الأعمدة) */
const FETCH_SIZE = 100;
const MAX_FETCHES = 5;
/** عدد البطاقات في صفحة العمود الواحد */
const PER_COLUMN = 8;
const VIEW_KEY = 'ewms_study_task_view';

const day = (v: string | null | undefined) => v ? v.slice(0, 10).replaceAll('-', '/') : '—';
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Column { status: StudyTaskStatus; label: string; hint: string; }

/**
 * مهامي في مشاريع الدراسات: لوحة بثلاثة أعمدة (لم تبدأ / قيد التنفيذ / منجزة) وتقويم لنهايات الفترات، بنمط لوحة المهام.
 * المهام المسندة إليّ أو إلى مكتبي أو قسمي؛ يحدّث الإنجاز من يصل إليه (علم canUpdateProgress) والخادم يحسب نسبة المرحلة والمشروع.
 * السحب إلى «منجزة» = 100%، وإلى «لم تبدأ» = تصفير النسبة (بتأكيد)، وإلى «قيد التنفيذ» يبقي النسبة الجارية أو يفتح نافذة التحديث.
 * كل عمود مقسَّم إلى صفحات.
 */
@Component({
  selector: 'app-study-my-tasks-page',
  standalone: true,
  imports: [
    RouterLink, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder,
    PageHeader, Alert, EmptyState, StatTile, MonthCalendar, StudyProgress, StudyTaskProgressDialog
  ],
  templateUrl: './study-my-tasks-page.html',
  styleUrl: './study-my-tasks-page.scss'
})
export class StudyMyTasksPage {
  private service = inject(StudyProjectsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private latest = latestRequest();

  fmt = day;
  columns: Column[] = [
    { status: StudyTaskStatus.NotStarted, label: TASK_STATUSES[0].label, hint: 'بانتظار البدء' },
    { status: StudyTaskStatus.InProgress, label: TASK_STATUSES[1].label, hint: 'يجري العمل عليها' },
    { status: StudyTaskStatus.Done, label: TASK_STATUSES[2].label, hint: 'الأحدث إنجازاً أولاً' }
  ];

  rows = signal<StageTask[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  editing = signal<StageTask | null>(null);

  search = signal('');
  lateOnly = signal(false);
  view = signal<'board' | 'calendar'>(this.savedView());
  /** صفحة كل عمود (تبدأ من 1) */
  private pages = signal<Record<number, number>>({});

  truncated = computed(() => this.total() > this.rows().length);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const lateOnly = this.lateOnly();
    return this.rows().filter(t =>
      (!q || [t.title, t.projectCode, t.projectName, t.stageName, t.targetName].some(s => s?.toLowerCase().includes(q)))
      && (!lateOnly || this.isLate(t)));
  });

  byStatus = computed(() => {
    const groups: Record<number, StageTask[]> = { 1: [], 2: [], 3: [] };
    for (const t of this.filtered()) groups[t.status].push(t);
    // المنجزة: الأحدث إنجازاً أولاً (الخادم يرتّب المفتوحة بموعدها)
    groups[StudyTaskStatus.Done].sort((a, b) => (b.actualEndDate ?? b.updatedAt ?? '').localeCompare(a.actualEndDate ?? a.updatedAt ?? ''));
    return groups;
  });

  counts = computed(() => {
    const all = this.rows();
    return {
      todo: all.filter(t => t.status === StudyTaskStatus.NotStarted).length,
      progress: all.filter(t => t.status === StudyTaskStatus.InProgress).length,
      done: all.filter(t => t.status === StudyTaskStatus.Done).length,
      late: all.filter(t => this.isLate(t)).length
    };
  });

  /** كل مهمة تظهر في يوم بدايتها ويوم نهايتها المخططين، وفقاعة التفاصيل عند التأشير عليها */
  events = computed<CalendarEvent[]>(() => this.filtered().map(t => ({
    id: t.id, title: t.title, start: t.plannedStartDate, end: t.plannedEndDate,
    tone: t.status === StudyTaskStatus.Done ? 'done' : t.status === StudyTaskStatus.InProgress ? 'progress' : 'todo',
    late: this.isLate(t), sub: `${t.projectCode} · ${t.stageName}`,
    details: [
      { label: 'المشروع', value: `${t.projectCode} — ${t.projectName}` },
      { label: 'المرحلة', value: t.stageName },
      { label: 'المسندة إلى', value: `${t.targetTypeName}: ${t.targetName}` },
      { label: 'أسندها', value: t.assignedByName },
      { label: 'الفترة المخططة', value: `${day(t.plannedStartDate)} ← ${day(t.plannedEndDate)}` },
      { label: 'الإنجاز', value: `${Math.round(t.progress)}% — ${t.statusName}` }
    ]
  })));

  constructor() { this.load(); }

  load() {
    const first$ = this.service.myTasks(false, 1, FETCH_SIZE);
    const all$ = first$.pipe(switchMap(first => {
      const fetches = Math.min(MAX_FETCHES, Math.ceil(first.totalCount / FETCH_SIZE));
      if (fetches <= 1) return of({ items: first.items, total: first.totalCount });
      const rest = Array.from({ length: fetches - 1 }, (_, i) => this.service.myTasks(false, i + 2, FETCH_SIZE));
      return forkJoin(rest).pipe(map(r => ({ items: [...first.items, ...r.flatMap(x => x.items)], total: first.totalCount })));
    }));
    this.latest(all$, this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.total); });
  }

  // ─────────── الفلاتر والعرض ───────────
  setSearch(value: string) { this.search.set(value); this.pages.set({}); }
  setLateOnly(value: boolean) { this.lateOnly.set(value); this.pages.set({}); }

  private savedView(): 'board' | 'calendar' {
    try { return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'board'; } catch { return 'board'; }
  }

  setView(view: 'board' | 'calendar') {
    this.view.set(view);
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* التفضيل اختياري */ }
  }

  // ─────────── صفحات الأعمدة ───────────
  pagesOf(status: number) { return Math.max(1, Math.ceil(this.byStatus()[status].length / PER_COLUMN)); }
  pageOf(status: number) { return Math.min(this.pages()[status] ?? 1, this.pagesOf(status)); }
  goPage(status: number, page: number) { this.pages.update(p => ({ ...p, [status]: Math.min(Math.max(1, page), this.pagesOf(status)) })); }
  visible(status: number) { const from = (this.pageOf(status) - 1) * PER_COLUMN; return this.byStatus()[status].slice(from, from + PER_COLUMN); }

  // ─────────── السحب والإفلات ───────────
  /** السحب لمن يحدّث الإنجاز فقط؛ والخادم يرفض ما لا يجوز (مرحلة مغلقة، مشروع غير جارٍ) فتعود البطاقة */
  canDrop = (drag: CdkDrag<StageTask>) => drag.data.canUpdateProgress;

  async drop(event: CdkDragDrop<StudyTaskStatus>) {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as StageTask;
    const to = event.container.data;

    if (to === StudyTaskStatus.Done) {
      if (!(await this.confirm.ask(`تسجيل «${task.title}» منجزة بنسبة 100%؟`, 'تأكيد'))) return;
      this.apply(task, 100, to);
    } else if (to === StudyTaskStatus.NotStarted) {
      if (!(await this.confirm.ask(`إعادة «${task.title}» إلى «لم تبدأ»؟ تُصفَّر نسبة إنجازها.`, 'تصفير'))) return;
      this.apply(task, 0, to);
    } else if (task.progress > 0 && task.progress < 100) {
      this.apply(task, task.progress, to);
    } else {
      // «قيد التنفيذ» تحتاج نسبة بين 1 و99: يدخلها المستخدم في النافذة
      this.editing.set(task);
    }
  }

  private apply(task: StageTask, progress: number, status: StudyTaskStatus) {
    const before = { progress: task.progress, status: task.status, statusName: task.statusName };
    // تحديث متفائل ثم التراجع إن رفض الخادم
    this.patch(task.id, { progress, status, statusName: TASK_STATUSES.find(s => s.value === status)?.label ?? task.statusName });
    this.service.updateProgress(task.id, { progress, status }).subscribe({
      next: updated => { this.patch(task.id, updated); this.toast.success(`«${task.title}» ← ${updated.statusName}`); },
      error: e => { this.patch(task.id, before); this.toast.error(e.message); this.load(); }
    });
  }

  private patch(id: number, changes: Partial<StageTask>) {
    this.rows.update(list => list.map(t => t.id === id ? { ...t, ...changes } : t));
  }

  // ─────────── البطاقات ───────────
  /** من يحدّث الإنجاز تفتح له النافذة، وغيره (قارئ) يُنقل إلى المشروع */
  openCard(task: StageTask) {
    if (task.canUpdateProgress) this.editing.set(task);
    else this.router.navigate(['/studies/projects', task.projectId]);
  }

  openById(id: number) { const t = this.rows().find(x => x.id === id); if (t) this.openCard(t); }

  saved() { this.editing.set(null); this.toast.success('حُدّث الإنجاز'); this.load(); }

  short(v: string | null) { return v ? v.slice(5, 10).replace('-', '/') : ''; }

  isLate(t: StageTask) { return t.status !== StudyTaskStatus.Done && !!t.plannedEndDate && t.plannedEndDate.slice(0, 10) < dayKey(new Date()); }

  dueState(t: StageTask): 'late' | 'soon' | '' {
    if (t.status === StudyTaskStatus.Done || !t.plannedEndDate) return '';
    if (this.isLate(t)) return 'late';
    const days = (new Date(t.plannedEndDate.slice(0, 10)).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000;
    return days <= 2 ? 'soon' : '';
  }
}
