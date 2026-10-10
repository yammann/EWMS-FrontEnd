import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable } from 'rxjs';
import { ToDoService } from '../data-access/todo.service';
import { AuthService } from '@core/services/auth.service';
import { AppPermission } from '@core/constants/access';
import { TODO_LIMITS, ToDoItem, ToDoList } from '../data-access/todo.models';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { Icon } from '@shared/ui/icon';
import { StatTile } from '@shared/ui/stat-tile';
import { TodoListDialog } from '../components/todo-list-dialog';
import { TodoItemDialog } from '../components/todo-item-dialog';
import { TodoBulkDialog } from '../components/todo-bulk-dialog';
import { Alert } from '@shared/ui/alert';
import { SelectValue } from '@shared/ui/select-value';

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
  imports: [SelectValue, Alert, FormsModule, RouterLink, DatePipe, CdkDropList, CdkDrag, CdkDragHandle, Icon, StatTile, TodoListDialog, TodoItemDialog, TodoBulkDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../styles/todo.scss', '../styles/todo-cards.scss'],
  templateUrl: './todo-list-page.html',
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
  setSort(value: string) { this.sort.set(value as Sort); }
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
