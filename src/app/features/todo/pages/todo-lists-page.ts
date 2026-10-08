import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToDoService } from '../data-access/todo.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { AppPermission } from '@core/constants/access';
import { ToDoList, ToDoToday, ToDoTodayItem, todoColor } from '../data-access/todo.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { Icon } from '@shared/ui/icon';
import { StatTile } from '@shared/ui/stat-tile';
import { TodoListDialog } from '../components/todo-list-dialog';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

type View = 'lists' | 'today';

/**
 * «مفكرتي»: قوائم المهام الشخصية بتصميم «لوحة المهام اليومية» (رأس بأيقونة وتاريخ، شريط أرقام، حبّات، شبكة بطاقات).
 * تبويبان: «قوائمي» (بطاقة لكل قائمة بتقدّمها، وقائمة ⋮ للتثبيت والنسخ والأرشفة) و«اليوم» (بنودي المتأخرة والمستحقة اليوم من كل القوائم).
 * السوبر ادمن يرى قوائم الجميع بأسماء أصحابها.
 */
@Component({
  selector: 'app-todo-lists-page', standalone: true, imports: [Alert, TodoListDialog, DatePipe, Icon, StatTile, Pager],
  styleUrls: ['../../../shared/styles/page-base.scss', '../styles/todo.scss', '../styles/todo-cards.scss', './todo-lists-page.scss'],
  templateUrl: './todo-lists-page.html',
  
})
export class TodoListsPage {
  pager = new Pagination(() => this.filtered(), { size: 12, sizes: [12, 24, 48] });
  private service = inject(ToDoService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  /** التاريخ بالعربية وأرقام لاتينية (كبقية الواجهة) */
  dateText = new Date().toLocaleDateString('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  view = signal<View>('lists');
  lists = signal<ToDoList[]>([]);
  today = signal<ToDoToday | null>(null);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  search = signal('');
  showArchived = signal(false);
  formOpen = signal(false);
  editing = signal<ToDoList | null>(null);
  menuFor = signal<number | null>(null);

  me = computed(() => this.auth.currentUser()?.fullName ?? '');
  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateToDoList));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditToDoList));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteToDoList));

  activeLists = computed(() => this.lists().filter(l => !l.isArchived));
  archivedCount = computed(() => this.lists().filter(l => l.isArchived).length);
  openItems = computed(() => this.activeLists().reduce((sum, l) => sum + l.itemsTotal - l.itemsDone, 0));
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.lists().filter(l => (this.showArchived() || !l.isArchived)
      && (!q || l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)));
  });
  todayTotal = computed(() => { const t = this.today(); return t ? t.overdueCount + t.todayCount : 0; });
  todayGroups = computed(() => {
    const items = this.today()?.items ?? [];
    return [
      { title: 'متأخرة', late: true, items: items.filter(i => i.isOverdue) },
      { title: 'مستحقة اليوم', late: false, items: items.filter(i => !i.isOverdue) }
    ];
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => this.view.set(p.get('view') === 'today' ? 'today' : 'lists'));
    this.reload();
    // تذكيرات المفكرة تصل كإشعارات: حدّث «اليوم» عند وصولها
    inject(NotificationService).incoming$.pipe(takeUntilDestroyed()).subscribe(n => { if (n.relatedEntityType === 'ToDoList') this.loadToday(); });
  }

  color = todoColor;
  percent = (l: ToDoList) => l.itemsTotal ? Math.round(100 * l.itemsDone / l.itemsTotal) : 0;

  @HostListener('document:click') closeMenu() { if (this.menuFor() !== null) this.menuFor.set(null); }
  toggleMenu(id: number) { this.menuFor.set(this.menuFor() === id ? null : id); }

  setView(view: View) { this.router.navigate([], { queryParams: { view: view === 'today' ? 'today' : null }, queryParamsHandling: 'merge' }); }

  reload() { this.loadLists(); this.loadToday(); }

  private loadLists() {
    trackRequest(this.service.lists(), this.loading, this.error, l => { this.lists.set(l); });
  }

  private loadToday() { this.service.today().subscribe({ next: t => this.today.set(t), error: e => this.error.set(e.message) }); }

  open(l: ToDoList) { this.openList(l.id); }
  openList(id: number) { this.router.navigate(['/todo-lists', id]); }
  openForm(l: ToDoList | null) { this.editing.set(l); this.formOpen.set(true); }

  saved(l: ToDoList) {
    const wasNew = !this.editing();
    this.formOpen.set(false);
    this.toast.success(wasNew ? 'أُنشئت القائمة' : 'تم حفظ التعديلات');
    if (wasNew) this.open(l); else this.loadLists();
  }

  /** إنجاز بند من «اليوم»: المتكرر يعود بموعده التالي */
  complete(item: ToDoTodayItem) {
    if (this.busy()) return;
    this.busy.set(true);
    this.service.updateItem(item.id, { isDone: true }).subscribe({
      next: l => {
        this.busy.set(false);
        const updated = l.items.find(i => i.id === item.id);
        if (updated && !updated.isDone && updated.dueDate) this.toast.success(`«${item.title}» يعود في ${updated.dueDate.slice(0, 10)}`);
        this.loadToday(); this.loadLists();
      },
      error: e => { this.busy.set(false); this.toast.error(e.message); }
    });
  }

  private run(request: ReturnType<ToDoService['pin']>, message: string) {
    request.subscribe({ next: () => { this.toast.success(message); this.loadLists(); this.loadToday(); }, error: e => this.toast.error(e.message) });
  }

  togglePin(l: ToDoList) { this.run(this.service.pin(l.id, !l.isPinned), l.isPinned ? 'أُلغي التثبيت' : 'تم تثبيت القائمة'); }
  toggleArchive(l: ToDoList) { this.run(this.service.archive(l.id, !l.isArchived), l.isArchived ? 'أُعيدت القائمة' : 'نُقلت القائمة إلى الأرشيف'); }

  duplicate(l: ToDoList) {
    this.service.duplicate(l.id).subscribe({
      next: copy => { this.toast.success(`أُنشئت «${copy.name}»`); this.open(copy); },
      error: e => this.toast.error(e.message)
    });
  }

  async remove(l: ToDoList) {
    const extra = l.itemsTotal ? ` وبنودها (${l.itemsTotal})` : '';
    if (!(await this.confirm.ask(`حذف القائمة «${l.name}»${extra}؟ لا يمكن التراجع.`, 'حذف'))) return;
    this.service.delete(l.id).subscribe({
      next: () => { this.toast.success('تم حذف القائمة'); this.loadLists(); this.loadToday(); },
      error: e => this.toast.error(e.message)
    });
  }
}
