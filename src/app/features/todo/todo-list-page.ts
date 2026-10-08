import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable } from 'rxjs';
import { ToDoService } from '../../core/services/todo.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { TODO_LIMITS, ToDoItem, ToDoList } from '../../core/models/todo.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { Icon } from '../../shared/ui/icon';
import { StatTile } from '../dashboard/dashboard-widgets';
import { TodoListDialog } from './todo-list-dialog';
import { TodoItemDialog } from './todo-item-dialog';
import { TodoBulkDialog } from './todo-bulk-dialog';

type Filter = 'all' | 'today' | 'tomorrow' | 'late' | 'done' | 'important';
type Sort = 'manual' | 'due' | 'important';
interface DueLabel { text: string; kind: 'late' | 'today' | 'soon' | ''; }

const DAY = 86_400_000;
const startOfToday = () => new Date().setHours(0, 0, 0, 0);
const dayOf = (iso: string) => new Date(iso).setHours(0, 0, 0, 0);

/**
 * قائمة واحدة بتصميم «لوحة المهام اليومية»: رأس بأيقونة وتاريخ ونسبة الإنجاز، شريط أرقام، حبّات فلاتر بأعدادها،
 * وشبكة بطاقات (3 أعمدة) ببطاقة إضافة منقّطة في آخرها. البحث والترتيب يعملان على ما حمّله الخادم، والسحب مع الترتيب اليدوي دون تصفية.
 * كل عملية تُرجع القائمة كاملة فتحلّ محل الحالة المحلية؛ والتعليم والترتيب متفائلان.
 */
@Component({
  selector: 'app-todo-list-page', standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, CdkDropList, CdkDrag, CdkDragHandle, Icon, StatTile, TodoListDialog, TodoItemDialog, TodoBulkDialog],
  styleUrls: ['../shared/organization.scss', './todo.scss', './todo-cards.scss'],
  template: `
    <div class="page">
      @if (list(); as l) {
        <header class="t-head">
          <div class="t-id">
            <span class="t-badge" aria-hidden="true">@if (l.icon) { {{ l.icon }} } @else { <app-icon name="clipboard" /> }</span>
            <div class="t-title">
              <a class="t-back" routerLink="/todo-lists">‹ مفكرتي</a>
              <h1>{{ l.name }}@if (l.isArchived) { <span class="t-chip">مؤرشفة</span> }</h1>
              <p class="t-sub">
                <span>{{ dateText }}</span><span class="t-dot" aria-hidden="true"></span>
                <span class="t-pill">تم إنجاز {{ percent() }}%</span>
                @if (l.description) { <span class="t-dot" aria-hidden="true"></span><span>{{ l.description }}</span> }
              </p>
            </div>
          </div>
          <div class="t-actions">
            @if (canEdit() && !l.isArchived) { <button type="button" class="btn btn-ghost" (click)="formOpen.set(true)">تعديل القائمة</button> }
          </div>
        </header>

        <section class="t-tiles" aria-label="ملخص القائمة">
          <app-stat-tile label="إجمالي البنود" [value]="l.itemsTotal" icon="🗂️" tone="blue" />
          <app-stat-tile label="المنجزة" [value]="l.itemsDone" icon="✅" tone="green" />
          <app-stat-tile label="المتبقية" [value]="l.itemsTotal - l.itemsDone" icon="⏳" tone="orange" [hint]="l.itemsOverdue ? l.itemsOverdue + ' متأخرة' : 'لا متأخرات'" [alert]="l.itemsOverdue > 0" />
          <app-stat-tile label="الهامة" [value]="importantOpen()" icon="⭐" tone="red" hint="غير منجزة" />
        </section>

        @if (l.itemsTotal) {
          <div class="t-tools">
            <label class="sr-only" for="todo-search">بحث في البنود</label>
            <input id="todo-search" type="search" placeholder="بحث بالعنوان أو الملاحظة…" [value]="search()" (input)="search.set($any($event.target).value)">
            <label class="sr-only" for="todo-sort">الترتيب</label>
            <select id="todo-sort" [value]="sort()" (change)="sort.set($any($event.target).value)">
              <option value="manual">ترتيبي اليدوي</option>
              <option value="due">حسب الموعد</option>
              <option value="important">المهم أولاً</option>
            </select>
          </div>
        }

        @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

        @if (l.itemsTotal) {
          <div class="t-pills" role="group" aria-label="تصفية البنود">
            @for (f of filterList(); track f.key) {
              @if (f.key === 'all' || f.count || filter() === f.key) {
                <button type="button" class="p" [class.on]="filter() === f.key" [attr.aria-pressed]="filter() === f.key" (click)="filter.set(f.key)">
                  {{ f.label }}<span class="n">({{ f.count }})</span></button>
              }
            }
            @if (editable() && l.itemsDone) {
              <button type="button" class="btn btn-ghost btn-sm clear" (click)="clearDone()" [disabled]="busy()">مسح المنجزة ({{ l.itemsDone }})</button>
            }
          </div>
        }

        <ul class="t-grid" cdkDropList cdkDropListOrientation="mixed" [cdkDropListDisabled]="!canDrag()" (cdkDropListDropped)="drop($event)">
          @for (item of visible(); track item.id) {
            <li class="t-card" [class.imp]="item.isImportant && !item.isDone" [class.done]="item.isDone" [class.click]="editable()" cdkDrag [cdkDragData]="item" (click)="open(item)">
              <div class="t-row">
                <button type="button" class="t-tick" role="checkbox" [attr.aria-checked]="item.isDone" [disabled]="!editable() || busy()"
                        (click)="toggle(item); $event.stopPropagation()" [attr.aria-label]="(item.isDone ? 'إلغاء إنجاز ' : 'إنجاز ') + item.title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>
                </button>
                <div class="t-body">
                  <h3 class="t-name">@if (item.isImportant && !item.isDone) { <span class="t-star" aria-label="مهم">★</span> }{{ item.title }}</h3>
                  @if (item.note) { <p class="t-note">{{ item.note }}</p> }
                  <div class="t-meta">
                    @if (item.isDone) {
                      <span class="t-chip ok">✔ أُنجز {{ item.doneAt | date:'MM/dd' }}</span>
                    } @else if (dueLabel(item); as d) {
                      <span class="t-chip" [class.late]="d.kind === 'late'" [class.today]="d.kind === 'today'">📅 {{ d.text }}</span>
                    }
                    @if (item.repeatAr) { <span class="t-chip">🔁 {{ item.repeatAr }}</span> }
                    @if (item.linkedTask; as t) {
                      @if (t.available) {
                        <a class="t-chip info" [routerLink]="['/task-board']" [queryParams]="{ task: t.id }" (click)="$event.stopPropagation()" title="فتح المهمة في لوحة المهام">🔗 {{ t.statusAr }}@if (t.isOverdue) { · متأخرة }</a>
                      } @else { <span class="t-chip">🔗 مهمة غير متاحة</span> }
                    }
                  </div>
                </div>
                @if (editable()) {
                  <div class="t-acts" (click)="$event.stopPropagation()">
                    <button type="button" class="t-act t-tip" data-tip="تفاصيل وتعديل" [attr.aria-label]="'تفاصيل وتعديل ' + item.title" (click)="open(item)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
                    </button>
                    <button type="button" class="t-act del t-tip" data-tip="حذف البند" [attr.aria-label]="'حذف ' + item.title" (click)="remove(item)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                    </button>
                  </div>
                }
              </div>
              @if (canDrag()) { <span class="t-grip" cdkDragHandle (click)="$event.stopPropagation()" aria-label="اسحب لإعادة الترتيب" title="اسحب لإعادة الترتيب">⋮⋮</span> }
            </li>
          } @empty {
            @if (l.itemsTotal) { <li class="t-empty">لا بنود مطابقة.</li> }
          }

          @if (editable() && l.itemsTotal < limits.maxItems) {
            @if (adding()) {
              <li class="t-card t-add open">
                <form (ngSubmit)="add()">
                  <label class="sr-only" for="todo-new">بند جديد</label>
                  <input id="todo-new" name="title" [maxlength]="limits.titleLength" [(ngModel)]="newTitle" placeholder="عنوان البند… (الصق عدة أسطر لإضافتها دفعة واحدة)"
                         autocomplete="off" [disabled]="busy()" (paste)="onPaste($event)" (keydown.escape)="cancelAdd()">
                  <div class="f-row">
                    <input name="due" type="date" [(ngModel)]="newDue" aria-label="موعد البند" title="موعد (اختياري)">
                    <button type="button" class="t-star-toggle" [class.on]="newImportant" [attr.aria-pressed]="newImportant" (click)="newImportant = !newImportant" title="مهم" aria-label="مهم">★</button>
                  </div>
                  <div class="f-row">
                    <button type="submit" class="btn btn-sm" [disabled]="busy() || !newTitle.trim()">إضافة</button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="cancelAdd()">إلغاء</button>
                  </div>
                </form>
              </li>
            } @else {
              <li class="t-card t-add">
                <div class="t-add-row">
                  <button type="button" class="t-add-btn t-tip" data-tip="بند جديد — اكتب العنوان والموعد" aria-label="بند جديد" (click)="startAdd()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M12 11v6M9 14h6"/></svg>
                  </button>
                  <div class="t-add-text"><strong>أضف إلى القائمة</strong><small>بند واحد أو عدة بنود دفعة واحدة</small></div>
                  <button type="button" class="t-add-btn t-tip" data-tip="عدة بنود — كل سطر بند" aria-label="عدة بنود" (click)="openBulk('')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M4 12h10M4 18h6"/><path d="M18 14v6M15 17h6"/></svg>
                  </button>
                </div>
              </li>
            }
          }
        </ul>
        @if (l.itemsTotal >= limits.maxItems && editable()) { <p class="t-hint">بلغت الحد الأقصى ({{ limits.maxItems }} بنداً).</p> }
        @if (l.isArchived) { <p class="t-hint">القائمة مؤرشفة: أعدها من صفحة مفكرتي لتعديل بنودها.</p> }
      } @else if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p><a class="btn btn-ghost" routerLink="/todo-lists">رجوع إلى مفكرتي</a>
      } @else { <div class="panel empty-state" role="status">جارٍ التحميل…</div> }
    </div>

    @if (formOpen() && list(); as l) { <app-todo-list-dialog [list]="l" (saved)="renamed($event)" (close)="formOpen.set(false)" /> }
    @if (editingItem(); as it) { <app-todo-item-dialog [item]="it" (saved)="replaced($event)" (close)="editingItem.set(null)" /> }
    @if (bulkOpen() && list(); as l) { <app-todo-bulk-dialog [list]="l" [initialText]="bulkText()" (saved)="bulkSaved($event)" (close)="bulkOpen.set(false)" /> }`,
  styles: [`
    .page { gap: 20px; }
    .empty-state { text-align: center; }
  `]
})
export class TodoListPage {
  private service = inject(ToDoService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  limits = TODO_LIMITS;
  /** التاريخ بالعربية وأرقام لاتينية (كبقية الواجهة) */
  dateText = new Date().toLocaleDateString('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  list = signal<ToDoList | null>(null);
  error = signal('');
  busy = signal(false);
  formOpen = signal(false);
  editingItem = signal<ToDoItem | null>(null);
  bulkOpen = signal(false);
  bulkText = signal('');
  filter = signal<Filter>('all');
  sort = signal<Sort>('manual');
  search = signal('');
  adding = signal(false);
  newTitle = '';
  newDue = '';
  newImportant = false;

  /** صلاحية التعديل، والقائمة غير مؤرشفة */
  editable = computed(() => this.auth.hasPermission(AppPermission.EditToDoList) && !this.list()?.isArchived);
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditToDoList));
  /** السحب مع الترتيب اليدوي الكامل فقط (التصفية والبحث والفرز تغيّر ما يُرى فلا يصحّ ترتيبه) */
  canDrag = computed(() => this.editable() && this.filter() === 'all' && !this.search().trim() && this.sort() === 'manual');

  private matches = (i: ToDoItem, f: Filter) => {
    switch (f) {
      case 'today': return !i.isDone && !!i.dueDate && dayOf(i.dueDate) === startOfToday();
      case 'tomorrow': return !i.isDone && !!i.dueDate && dayOf(i.dueDate) === startOfToday() + DAY;
      case 'late': return i.isOverdue;
      case 'done': return i.isDone;
      case 'important': return i.isImportant && !i.isDone;
      default: return true;
    }
  };
  filterList = computed(() => {
    const items = this.list()?.items ?? [];
    const labels: [Filter, string][] = [['all', 'الكل'], ['today', 'اليوم'], ['tomorrow', 'غداً'], ['late', 'متأخرة'], ['important', 'الهامة'], ['done', 'المكتملة']];
    return labels.map(([key, label]) => ({ key, label, count: items.filter(i => this.matches(i, key)).length }));
  });
  importantOpen = computed(() => (this.list()?.items ?? []).filter(i => i.isImportant && !i.isDone).length);
  visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    let items = (this.list()?.items ?? []).filter(i => this.matches(i, this.filter())
      && (!q || i.title.toLowerCase().includes(q) || i.note.toLowerCase().includes(q)));
    if (this.sort() === 'due') items = [...items].sort((a, b) => (a.dueDate ? dayOf(a.dueDate) : Infinity) - (b.dueDate ? dayOf(b.dueDate) : Infinity));
    else if (this.sort() === 'important') items = [...items].sort((a, b) => Number(b.isImportant) - Number(a.isImportant));
    return items;
  });
  percent = computed(() => { const l = this.list(); return l?.itemsTotal ? Math.round(100 * l.itemsDone / l.itemsTotal) : 0; });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => this.load(Number(p.get('id'))));
  }

  private load(id: number) {
    this.error.set('');
    this.service.get(id).subscribe({ next: l => this.list.set(l), error: e => { this.list.set(null); this.error.set(e.message); } });
  }

  /** ينفّذ عملية تُرجع القائمة المحدَّثة */
  private run(request: Observable<ToDoList>, after?: (l: ToDoList) => void, onError?: () => void) {
    this.busy.set(true); this.error.set('');
    request.subscribe({
      next: l => {
        this.busy.set(false); this.list.set(l); after?.(l);
        // لو فرغ الفلتر الحالي (آخر بند منجز مثلاً) نعود إلى «الكل»
        if (this.filter() !== 'all' && !this.visible().length && !this.search().trim()) this.filter.set('all');
      },
      error: e => { this.busy.set(false); this.error.set(e.message); onError?.(); }
    });
  }

  /** نص الموعد ولونه: متأخر N أيام / اليوم / غداً / التاريخ */
  dueLabel(item: ToDoItem): DueLabel | null {
    if (!item.dueDate) return null;
    const days = Math.round((dayOf(item.dueDate) - startOfToday()) / DAY);
    if (days < 0) return { text: days === -1 ? 'متأخر يوماً' : `متأخر ${-days} أيام`, kind: 'late' };
    if (days === 0) return { text: 'اليوم', kind: 'today' };
    if (days === 1) return { text: 'غداً', kind: 'soon' };
    return { text: item.dueDate.slice(5, 10).replace('-', '/'), kind: '' };
  }

  startAdd() {
    if (!this.editable()) return;
    this.adding.set(true);
    setTimeout(() => {
      const input = document.getElementById('todo-new') as HTMLInputElement | null;
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input?.focus();
    });
  }

  cancelAdd() { this.adding.set(false); this.newTitle = ''; this.newDue = ''; this.newImportant = false; }

  add() {
    const l = this.list(), title = this.newTitle.trim();
    if (!l || !title || this.busy()) return;
    // تبقى بطاقة الإضافة مفتوحة لإدخال بند تلو آخر
    this.run(this.service.addItem(l.id, { title, dueDate: this.newDue || null, isImportant: this.newImportant }),
      () => { this.newTitle = ''; this.newDue = ''; this.newImportant = false; setTimeout(() => document.getElementById('todo-new')?.focus()); });
  }

  /** لصق نص متعدد الأسطر في خانة الإضافة يفتح نافذة الإضافة الجماعية بدل لصقه بند واحد */
  onPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    if (/\r?\n/.test(text.trim())) { event.preventDefault(); this.openBulk(text); }
  }

  openBulk(text: string) { this.bulkText.set(text); this.bulkOpen.set(true); }
  bulkSaved(l: ToDoList) { this.bulkOpen.set(false); this.list.set(l); this.toast.success('أُضيفت البنود'); }

  open(item: ToDoItem) { if (this.editable()) this.editingItem.set(item); }

  toggle(item: ToDoItem) {
    const l = this.list();
    if (!l || this.busy()) return;
    const done = !item.isDone;
    // تحديث متفائل (إلا المتكرر: يقرر الخادم موعده التالي) ثم استبدال الحالة بما يعيده
    if (!item.repeat) this.list.set({ ...l, itemsDone: l.itemsDone + (done ? 1 : -1), items: l.items.map(i => i.id === item.id ? { ...i, isDone: done } : i) });
    this.run(this.service.updateItem(item.id, { isDone: done }), updated => {
      const now = updated.items.find(i => i.id === item.id);
      if (done && item.repeat && now && !now.isDone && now.dueDate) this.toast.success(`«${item.title}» يعود في ${now.dueDate.slice(0, 10)}`);
    }, () => this.list.set(l));
  }

  replaced(l: ToDoList) { this.editingItem.set(null); this.list.set(l); }

  async remove(item: ToDoItem) {
    if (!(await this.confirm.ask(`حذف البند «${item.title}»؟`, 'حذف'))) return;
    this.run(this.service.deleteItem(item.id));
  }

  async clearDone() {
    const l = this.list();
    if (!l || !(await this.confirm.ask(`حذف ${l.itemsDone} بنداً منجزاً من القائمة؟`, 'مسح'))) return;
    this.run(this.service.clearDone(l.id), () => this.toast.success('تم مسح البنود المنجزة'));
  }

  drop(event: CdkDragDrop<ToDoItem[]>) {
    const l = this.list();
    if (!l || event.previousIndex === event.currentIndex || !this.canDrag()) return;
    const items = [...l.items];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.list.set({ ...l, items });                                    // متفائل
    this.run(this.service.reorder(l.id, items.map(i => i.id)), undefined, () => this.load(l.id));
  }

  renamed(updated: ToDoList) {
    this.formOpen.set(false);
    this.toast.success('تم حفظ التعديلات');
    const l = this.list();
    if (l) this.list.set({ ...l, name: updated.name, description: updated.description, color: updated.color, icon: updated.icon });
  }
}
