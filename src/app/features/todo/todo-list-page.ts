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
import { TodoListDialog } from './todo-list-dialog';

/**
 * قائمة واحدة: إضافة بند (Enter)، تعليمه منجزاً، تعديل عنوانه، ترتيبه بالسحب، حذفه، ومسح المنجزة.
 * كل عملية تُرجع القائمة كاملة من الخادم فتحلّ محلّ الحالة المحلية؛ والتعليم والترتيب متفائلان مع تراجع عند الخطأ.
 */
@Component({
  selector: 'app-todo-list-page', standalone: true,
  imports: [FormsModule, RouterLink, CdkDropList, CdkDrag, CdkDragHandle, TodoListDialog],
  styleUrls: ['../shared/organization.scss'],
  template: `
    <div class="page">
      @if (list(); as l) {
        <header class="page-header">
          <div>
            <a class="back" routerLink="/todo-lists">‹ قوائمي</a>
            <h1>{{ l.name }}</h1>
            @if (l.description) { <p class="muted">{{ l.description }}</p> }
          </div>
          <div class="header-actions">
            @if (canEdit()) { <button class="btn btn-ghost" type="button" (click)="formOpen.set(true)">تعديل القائمة</button> }
          </div>
        </header>

        <section class="panel">
          <div class="summary">
            <strong>{{ l.itemsDone }} من {{ l.itemsTotal }} منجزة</strong>
            <span class="pct">{{ percent() }}%</span>
          </div>
          <div class="progress" role="progressbar" [attr.aria-valuenow]="percent()" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="percent()"></span></div>

          @if (canEdit()) {
            <form class="add" (ngSubmit)="add()">
              <label class="sr-only" for="todo-new">بند جديد</label>
              <input id="todo-new" name="title" [maxlength]="limits.titleLength" [(ngModel)]="newTitle" placeholder="أضف بنداً… ثم Enter"
                     autocomplete="off" [disabled]="busy() || l.itemsTotal >= limits.maxItems">
              <button type="submit" class="btn" [disabled]="busy() || !newTitle.trim() || l.itemsTotal >= limits.maxItems">إضافة</button>
            </form>
            @if (l.itemsTotal >= limits.maxItems) { <p class="hint">بلغت الحد الأقصى ({{ limits.maxItems }} بنداً).</p> }
          }

          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

          @if (l.itemsTotal) {
            <div class="tools">
              <label class="check"><input type="checkbox" [checked]="hideDone()" (change)="hideDone.set($any($event.target).checked)"> إخفاء المنجزة</label>
              @if (canEdit() && l.itemsDone) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="clearDone()" [disabled]="busy()">مسح المنجزة ({{ l.itemsDone }})</button>
              }
            </div>
          }

          <ul class="items" cdkDropList [cdkDropListDisabled]="!canEdit() || hideDone()" (cdkDropListDropped)="drop($event)">
            @for (item of visible(); track item.id) {
              <li class="item" [class.done]="item.isDone" cdkDrag [cdkDragData]="item">
                @if (canEdit() && !hideDone()) { <span class="grip" cdkDragHandle aria-label="اسحب لإعادة الترتيب" title="اسحب لإعادة الترتيب">⋮⋮</span> }
                <button type="button" class="tick" role="checkbox" [attr.aria-checked]="item.isDone" [disabled]="!canEdit() || busy()"
                        (click)="toggle(item)" [attr.aria-label]="(item.isDone ? 'إلغاء إنجاز ' : 'إنجاز ') + item.title">
                  @if (item.isDone) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg> }
                </button>

                @if (editingId() === item.id) {
                  <input class="edit" [maxlength]="limits.titleLength" [(ngModel)]="editTitle" name="edit-{{ item.id }}" autocomplete="off"
                         (keydown.enter)="saveEdit(item)" (keydown.escape)="editingId.set(null)" (blur)="saveEdit(item)" autofocus>
                } @else {
                  <span class="title" (dblclick)="startEdit(item)">{{ item.title }}</span>
                }

                @if (canEdit() && editingId() !== item.id) {
                  <span class="row-actions">
                    <button type="button" class="icon" (click)="startEdit(item)" [attr.aria-label]="'تعديل ' + item.title" title="تعديل">✎</button>
                    <button type="button" class="icon del" (click)="remove(item)" [attr.aria-label]="'حذف ' + item.title" title="حذف">×</button>
                  </span>
                }
              </li>
            } @empty {
              <li class="empty">{{ l.itemsTotal ? 'كل البنود منجزة ومخفية.' : 'القائمة فارغة — أضف أول بند.' }}</li>
            }
          </ul>
        </section>
      } @else if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p><a class="btn btn-ghost" routerLink="/todo-lists">رجوع إلى قوائمي</a>
      } @else { <div class="panel empty-state" role="status">جارٍ التحميل…</div> }
    </div>

    @if (formOpen() && list(); as l) { <app-todo-list-dialog [list]="l" (saved)="renamed($event)" (close)="formOpen.set(false)" /> }`,
  styles: [`
    .back { display: inline-block; margin-bottom: 4px; font-size: 13px; font-weight: 700; color: var(--brand-700); }
    .summary { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .pct { font-weight: 800; color: var(--brand-700); font-variant-numeric: tabular-nums; }
    .progress { height: 8px; background: var(--ink-100); border-radius: 5px; overflow: hidden; }
    .progress span { display: block; height: 100%; background: var(--brand-600); border-radius: 5px; transition: width .25s ease; }
    .add { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin: 18px 0 6px; }
    .hint { margin: 0 0 6px; font-size: 12px; color: var(--warning-700); }
    .tools { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 14px 0 8px; }
    .check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-600); font-weight: 700; }
    .check input { width: auto; }
    .items { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 6px; }
    .item { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); }
    .item.done .title { text-decoration: line-through; color: var(--ink-400); }
    .grip { cursor: grab; color: var(--ink-400); letter-spacing: -2px; user-select: none; padding: 4px 2px; touch-action: none; }
    .tick { flex: none; width: 24px; height: 24px; min-height: 0; padding: 0; display: grid; place-items: center; border-radius: 50%; background: var(--surface); border: 2px solid var(--border-strong); color: var(--on-brand); box-shadow: none; }
    .tick:hover:not(:disabled) { border-color: var(--brand-600); transform: none; box-shadow: none; background: var(--surface); }
    .tick[aria-checked="true"] { background: var(--brand-600); border-color: var(--brand-600); }
    .tick svg { width: 14px; height: 14px; }
    .title { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 14px; line-height: 1.6; color: var(--ink-900); }
    .edit { flex: 1; min-width: 0; }
    .row-actions { display: inline-flex; gap: 2px; opacity: 0; transition: opacity .15s ease; }
    .item:hover .row-actions, .item:focus-within .row-actions { opacity: 1; }
    @media (hover: none) { .row-actions { opacity: 1; } }
    .icon { min-height: 32px; width: 32px; padding: 0; background: transparent; color: var(--ink-500); font-size: 16px; box-shadow: none; }
    .icon:hover:not(:disabled) { background: var(--fill); color: var(--ink-900); transform: none; box-shadow: none; }
    .icon.del:hover:not(:disabled) { background: var(--danger-50); color: var(--danger-700); }
    .empty { padding: 28px 8px; text-align: center; font-size: 13px; color: var(--ink-400); border: 1px dashed var(--border-strong); border-radius: var(--radius-lg); }
    .cdk-drag-preview { box-shadow: var(--shadow-xl); border-radius: var(--radius-lg); background: var(--surface); }
    .cdk-drag-placeholder { opacity: .35; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0, 0, .2, 1); }
    .items.cdk-drop-list-dragging .item:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0, 0, .2, 1); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
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
  list = signal<ToDoList | null>(null);
  error = signal('');
  busy = signal(false);
  formOpen = signal(false);
  hideDone = signal(false);
  editingId = signal<number | null>(null);
  newTitle = '';
  editTitle = '';

  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditToDoList));
  visible = computed(() => (this.list()?.items ?? []).filter(i => !this.hideDone() || !i.isDone));
  percent = computed(() => { const l = this.list(); return l?.itemsTotal ? Math.round(100 * l.itemsDone / l.itemsTotal) : 0; });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => this.load(Number(p.get('id'))));
  }

  private load(id: number) {
    this.error.set('');
    this.service.get(id).subscribe({ next: l => this.list.set(l), error: e => { this.list.set(null); this.error.set(e.message); } });
  }

  /** ينفّذ عملية تُرجع القائمة المحدَّثة */
  private run(request: Observable<ToDoList>, after?: () => void, onError?: () => void) {
    this.busy.set(true); this.error.set('');
    request.subscribe({
      next: l => { this.busy.set(false); this.list.set(l); after?.(); },
      error: e => { this.busy.set(false); this.error.set(e.message); onError?.(); }
    });
  }

  add() {
    const l = this.list(), title = this.newTitle.trim();
    if (!l || !title || this.busy()) return;
    this.run(this.service.addItem(l.id, title), () => this.newTitle = '');
  }

  toggle(item: ToDoItem) {
    const l = this.list();
    if (!l || this.busy()) return;
    const done = !item.isDone;
    // تحديث متفائل للدائرة والعدّاد ثم استبدال الحالة بما يعيده الخادم
    this.list.set({ ...l, itemsDone: l.itemsDone + (done ? 1 : -1), items: l.items.map(i => i.id === item.id ? { ...i, isDone: done } : i) });
    this.run(this.service.updateItem(item.id, { isDone: done }), undefined, () => this.list.set(l));
  }

  startEdit(item: ToDoItem) { this.editTitle = item.title; this.editingId.set(item.id); }

  saveEdit(item: ToDoItem) {
    if (this.editingId() !== item.id) return;      // Esc أو حفظ سابق
    this.editingId.set(null);
    const title = this.editTitle.trim();
    if (!title || title === item.title) return;
    this.run(this.service.updateItem(item.id, { title }));
  }

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
    if (!l || event.previousIndex === event.currentIndex || this.hideDone()) return;
    const items = [...l.items];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.list.set({ ...l, items });                                    // متفائل
    this.run(this.service.reorder(l.id, items.map(i => i.id)), undefined, () => this.load(l.id));
  }

  renamed(updated: ToDoList) {
    this.formOpen.set(false);
    this.toast.success('تم حفظ التعديلات');
    const l = this.list();
    if (l) this.list.set({ ...l, name: updated.name, description: updated.description });
  }
}
