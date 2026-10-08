import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToDoService } from '@core/services/todo.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { AppPermission } from '@core/constants/access';
import { ToDoList, ToDoToday, ToDoTodayItem, todoColor } from '@core/models/todo.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { Icon } from '@shared/ui/icon';
import { StatTile } from '@shared/ui/stat-tile';
import { TodoListDialog } from './todo-list-dialog';
import { Alert } from '@shared/ui/alert';

type View = 'lists' | 'today';

/**
 * «مفكرتي»: قوائم المهام الشخصية بتصميم «لوحة المهام اليومية» (رأس بأيقونة وتاريخ، شريط أرقام، حبّات، شبكة بطاقات).
 * تبويبان: «قوائمي» (بطاقة لكل قائمة بتقدّمها، وقائمة ⋮ للتثبيت والنسخ والأرشفة) و«اليوم» (بنودي المتأخرة والمستحقة اليوم من كل القوائم).
 * السوبر ادمن يرى قوائم الجميع بأسماء أصحابها.
 */
@Component({
  selector: 'app-todo-lists-page', standalone: true, imports: [Alert, TodoListDialog, DatePipe, Icon, StatTile, Pager],
  styleUrls: ['../shared/organization.scss', './todo.scss', './todo-cards.scss'],
  template: `
    <div class="page">
      <header class="t-head">
        <div class="t-id">
          <span class="t-badge" aria-hidden="true"><app-icon name="clipboard" /></span>
          <div class="t-title">
            <h1>مفكرتي</h1>
            <p class="t-sub">
              <span>{{ dateText }}</span><span class="t-dot" aria-hidden="true"></span>
              @if (todayTotal()) { <span class="t-pill">{{ todayTotal() }} مستحقة اليوم</span> }
              @else { <span>قوائم ومهام شخصية لا يراها غيرك</span> }
            </p>
          </div>
        </div>
        <div class="t-actions">
          <button type="button" class="btn btn-ghost" (click)="reload()" [disabled]="loading()">تحديث</button>
          @if (canCreate()) { <button type="button" class="btn" (click)="openForm(null)">+ قائمة جديدة</button> }
        </div>
      </header>

      <section class="t-tiles" aria-label="ملخص المفكرة">
        <app-stat-tile label="القوائم" [value]="activeLists().length" icon="🗂️" tone="blue" [hint]="archivedCount() ? archivedCount() + ' مؤرشفة' : ''" />
        <app-stat-tile label="بنود مفتوحة" [value]="openItems()" icon="⏳" tone="orange" hint="في كل قوائمي" />
        <app-stat-tile label="مستحقة اليوم" [value]="today()?.todayCount ?? 0" icon="📅" tone="green" />
        <app-stat-tile label="متأخرة" [value]="today()?.overdueCount ?? 0" icon="⏰" tone="red" [alert]="(today()?.overdueCount ?? 0) > 0" hint="تجاوزت موعدها" />
      </section>

      @if (lists().length && view() === 'lists') {
        <div class="t-tools">
          <label class="sr-only" for="todo-lists-search">بحث في القوائم</label>
          <input id="todo-lists-search" type="search" placeholder="بحث بالاسم أو الوصف…" [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
      }

      <div class="t-pills" role="tablist" aria-label="عرض المفكرة">
        <button type="button" role="tab" class="p" [class.on]="view() === 'lists'" [attr.aria-selected]="view() === 'lists'" (click)="setView('lists')">قوائمي<span class="n">({{ activeLists().length }})</span></button>
        <button type="button" role="tab" class="p" [class.on]="view() === 'today'" [attr.aria-selected]="view() === 'today'" (click)="setView('today')">اليوم<span class="n">({{ todayTotal() }})</span></button>
        @if (view() === 'lists' && archivedCount()) {
          <button type="button" class="p" [class.on]="showArchived()" [attr.aria-pressed]="showArchived()" (click)="showArchived.set(!showArchived())">المؤرشفة<span class="n">({{ archivedCount() }})</span></button>
        }
      </div>

      <app-alert [message]="error()" />

      @if (view() === 'today') {
        @if (today(); as t) {
          @if (!t.items.length) {
            <div class="panel empty-state"><p>لا شيء مستحق اليوم ولا متأخر 🎉</p><small class="muted">أضف موعداً لأي بند ليظهر هنا في يومه.</small></div>
          } @else {
            @for (group of todayGroups(); track group.title) {
              @if (group.items.length) {
                <h2 class="t-group" [class.late]="group.late">{{ group.title }} <small>{{ group.items.length }}</small></h2>
                <ul class="t-grid">
                  @for (i of group.items; track i.id) {
                    <li class="t-card click" [class.imp]="i.isImportant" (click)="openList(i.toDoListId)">
                      <div class="t-row">
                        <button type="button" class="t-tick" role="checkbox" aria-checked="false" [disabled]="!canEdit() || busy()"
                                (click)="complete(i); $event.stopPropagation()" [attr.aria-label]="'إنجاز ' + i.title">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>
                        </button>
                        <div class="t-body">
                          <h3 class="t-name">@if (i.isImportant) { <span class="t-star" aria-label="مهم">★</span> }{{ i.title }}</h3>
                          <div class="t-meta">
                            <span class="t-chip">{{ i.listIcon || '📋' }} {{ i.listName }}</span>
                            <span class="t-chip" [class.late]="i.isOverdue" [class.today]="!i.isOverdue">📅 {{ i.isOverdue ? 'متأخر · ' + (i.dueDate | date:'MM/dd') : 'اليوم' }}</span>
                            @if (i.repeatAr) { <span class="t-chip">🔁 {{ i.repeatAr }}</span> }
                            @if (i.linkedTask?.available) { <span class="t-chip info">🔗 {{ i.linkedTask!.statusAr }}</span> }
                          </div>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              }
            }
          }
        } @else if (loading()) { <div class="panel empty-state" role="status">جارٍ التحميل…</div> }
      } @else {
        @if (loading() && !lists().length) {
          <div class="panel empty-state" role="status">جارٍ التحميل…</div>
        } @else {
          <ul class="t-grid">
            @for (l of pager.items(); track l.id) {
              <li class="t-card click" [class.done]="l.isArchived" tabindex="0" role="button" (click)="open(l)" (keydown.enter)="open(l)" [attr.aria-label]="'فتح القائمة ' + l.name">
                <div class="t-row">
                  <span class="l-icon" [style.--c]="color(l.color)" aria-hidden="true">{{ l.icon || '📋' }}</span>
                  <div class="t-body">
                    <h3 class="t-name">{{ l.name }}</h3>
                    @if (l.description) { <p class="t-note">{{ l.description }}</p> }
                  </div>
                  @if (canEdit() || canCreate() || canDelete()) {
                    <div class="t-more" (click)="$event.stopPropagation()">
                      <button type="button" (click)="toggleMenu(l.id)" [attr.aria-expanded]="menuFor() === l.id" aria-haspopup="menu" [attr.aria-label]="'خيارات ' + l.name">⋮</button>
                      @if (menuFor() === l.id) {
                        <div class="t-menu" role="menu">
                          @if (canEdit() && !l.isArchived) { <button type="button" role="menuitem" (click)="menuFor.set(null); togglePin(l)">{{ l.isPinned ? 'إلغاء التثبيت' : 'تثبيت' }}</button> }
                          @if (canEdit() && !l.isArchived) { <button type="button" role="menuitem" (click)="menuFor.set(null); openForm(l)">تعديل</button> }
                          @if (canCreate()) { <button type="button" role="menuitem" (click)="menuFor.set(null); duplicate(l)">نسخ القائمة</button> }
                          @if (canEdit()) { <button type="button" role="menuitem" (click)="menuFor.set(null); toggleArchive(l)">{{ l.isArchived ? 'إعادة من الأرشيف' : 'أرشفة' }}</button> }
                          @if (canDelete()) { <button type="button" role="menuitem" class="danger" (click)="menuFor.set(null); remove(l)">حذف</button> }
                        </div>
                      }
                    </div>
                  }
                </div>
                <div class="l-bar" aria-hidden="true"><span [style.width.%]="percent(l)"></span></div>
                <div class="t-meta">
                  <span class="t-chip" [class.ok]="l.itemsTotal > 0 && l.itemsDone === l.itemsTotal">{{ l.itemsTotal ? l.itemsDone + ' من ' + l.itemsTotal + ' منجزة' : 'قائمة فارغة' }}</span>
                  @if (l.itemsOverdue) { <span class="t-chip late">⏰ {{ l.itemsOverdue }} متأخرة</span> }
                  @else if (l.nextDueDate) { <span class="t-chip">📅 {{ l.nextDueDate | date:'MM/dd' }}</span> }
                  @if (l.isPinned) { <span class="t-chip" title="مثبّتة">📌</span> }
                  @if (l.isArchived) { <span class="t-chip">مؤرشفة</span> }
                  @if (l.ownerName !== me()) { <span class="t-chip info">{{ l.ownerName }}</span> }
                </div>
              </li>
            } @empty {
              @if (lists().length) { <li class="t-empty">لا نتائج مطابقة.</li> }
            }
            @if (canCreate()) {
              <li class="t-card t-add" role="button" tabindex="0" (click)="openForm(null)" (keydown.enter)="openForm(null)" aria-label="قائمة جديدة">
                <span class="plus" aria-hidden="true">+</span>
                <strong>{{ lists().length ? 'قائمة جديدة' : 'أنشئ أول قائمة' }}</strong><small>لكل موضوع قائمة ببنودها ومواعيدها</small>
              </li>
            }
          </ul>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
        }
      }
    </div>

    @if (formOpen()) { <app-todo-list-dialog [list]="editing()" (saved)="saved($event)" (close)="formOpen.set(false)" /> }`,
  styles: [`
    .page { gap: 20px; }
    .t-add { align-items: center; text-align: center; gap: 4px; cursor: pointer; }
    .t-add:hover { border-color: var(--brand-600); background: var(--brand-50); }
    .t-add .plus { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: var(--fill); color: var(--ink-500); font-size: 18px; margin-bottom: 2px; }
    .t-add:hover .plus { background: var(--brand-100); color: var(--brand-700); }
    .t-add strong { font-size: 14px; color: var(--ink-700); }
    .t-add:hover strong { color: var(--brand-700); }
    .t-add small { font-size: 11.5px; color: var(--ink-400); }
    .empty-state { display: grid; justify-items: center; gap: 10px; text-align: center; }
    .t-group { margin: 6px 0 -6px; font-size: 15px; color: var(--ink-700); }
    .t-group.late { color: var(--danger-700); }
    .t-group small { margin-inline-start: 6px; color: var(--ink-400); font-weight: 700; }
    .l-icon { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--radius-md); font-size: 20px; background: color-mix(in srgb, var(--c, var(--brand-600)) 16%, transparent); }
    .l-bar { height: 5px; margin-top: 14px; background: var(--ink-100); border-radius: 3px; overflow: hidden; }
    .l-bar span { display: block; height: 100%; background: var(--brand-600); border-radius: 3px; transition: width .25s ease; }
    .t-card.done .l-bar span { background: var(--ink-300); }
  `]
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
    this.loading.set(true); this.error.set('');
    this.service.lists().subscribe({
      next: l => { this.lists.set(l); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
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
