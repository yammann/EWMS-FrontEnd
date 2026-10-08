import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToDoService } from '../../core/services/todo.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPermission } from '../../core/constants/access';
import { ToDoList } from '../../core/models/todo.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { TodoListDialog } from './todo-list-dialog';

/** قوائم المهام الشخصية: بطاقة لكل قائمة بتقدّمها، والنقر يفتح بنودها. السوبر ادمن يرى قوائم الجميع بأسماء أصحابها. */
@Component({
  selector: 'app-todo-lists-page', standalone: true, imports: [TodoListDialog],
  styleUrls: ['../shared/organization.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">مهامي</span><h1>قوائمي</h1><p class="muted">قوائم مهام شخصية لا يراها غيرك</p></div>
        <div class="header-actions">
          @if (canCreate()) { <button class="btn" type="button" (click)="openForm(null)">+ قائمة جديدة</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (lists().length > 4) {
        <label class="search"><span class="sr-only">بحث</span>
          <input type="search" placeholder="بحث بالاسم أو الوصف…" [value]="search()" (input)="search.set($any($event.target).value)"></label>
      }
      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      @if (loading() && !lists().length) {
        <div class="panel empty-state" role="status">جارٍ التحميل…</div>
      } @else if (!lists().length) {
        <div class="panel empty-state">
          <p>لا توجد قوائم بعد.</p>
          @if (canCreate()) { <button class="btn" type="button" (click)="openForm(null)">أنشئ أول قائمة</button> }
        </div>
      } @else {
        <ul class="cards">
          @for (l of filtered(); track l.id) {
            <li class="card" tabindex="0" role="button" (click)="open(l)" (keydown.enter)="open(l)" [attr.aria-label]="'فتح القائمة ' + l.name">
              <div class="top">
                <h2>{{ l.name }}</h2>
                @if (l.ownerName !== me()) { <span class="owner">{{ l.ownerName }}</span> }
              </div>
              @if (l.description) { <p class="desc">{{ l.description }}</p> }
              <div class="progress" aria-hidden="true"><span [style.width.%]="percent(l)"></span></div>
              <div class="foot">
                <small>{{ l.itemsTotal ? l.itemsDone + ' من ' + l.itemsTotal + ' منجزة' : 'قائمة فارغة' }}</small>
                <span class="actions" (click)="$event.stopPropagation()">
                  @if (canEdit()) { <button type="button" class="btn btn-ghost btn-sm" (click)="openForm(l)" [attr.aria-label]="'تعديل ' + l.name">تعديل</button> }
                  @if (canDelete()) { <button type="button" class="btn btn-danger btn-sm" (click)="remove(l)" [attr.aria-label]="'حذف ' + l.name">حذف</button> }
                </span>
              </div>
            </li>
          } @empty { <li class="muted none">لا نتائج مطابقة.</li> }
        </ul>
      }
    </div>

    @if (formOpen()) { <app-todo-list-dialog [list]="editing()" (saved)="saved($event)" (close)="formOpen.set(false)" /> }`,
  styles: [`
    .search input { width: 100%; max-width: 420px; }
    .cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { display: grid; gap: 10px; align-content: start; padding: 18px; cursor: pointer; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); transition: border-color .15s ease, box-shadow .15s ease; }
    .card:hover { border-color: var(--brand-500); box-shadow: var(--shadow-md); }
    .card:focus-visible { outline: 2px solid var(--brand-600); outline-offset: 2px; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    h2 { margin: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
    .owner { flex: none; padding: 2px 10px; border-radius: var(--radius-full); background: var(--brand-50); color: var(--brand-700); font-size: 11px; font-weight: 800; }
    .desc { margin: 0; font-size: 13px; color: var(--ink-600); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .progress { height: 6px; background: var(--ink-100); border-radius: 4px; overflow: hidden; }
    .progress span { display: block; height: 100%; background: var(--brand-600); border-radius: 4px; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .foot small { color: var(--ink-500); font-size: 12px; font-weight: 700; }
    .actions { display: inline-flex; gap: 6px; }
    .none { grid-column: 1 / -1; text-align: center; padding: 24px; }
    .empty-state { display: grid; justify-items: center; gap: 12px; text-align: center; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `]
})
export class TodoListsPage {
  private service = inject(ToDoService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  lists = signal<ToDoList[]>([]);
  loading = signal(false);
  error = signal('');
  search = signal('');
  formOpen = signal(false);
  editing = signal<ToDoList | null>(null);

  me = computed(() => this.auth.currentUser()?.fullName ?? '');
  canCreate = computed(() => this.auth.hasPermission(AppPermission.CreateToDoList));
  canEdit = computed(() => this.auth.hasPermission(AppPermission.EditToDoList));
  canDelete = computed(() => this.auth.hasPermission(AppPermission.DeleteToDoList));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.lists().filter(l => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)) : this.lists();
  });

  constructor() { this.load(); }

  percent = (l: ToDoList) => l.itemsTotal ? Math.round(100 * l.itemsDone / l.itemsTotal) : 0;

  load() {
    this.loading.set(true); this.error.set('');
    this.service.lists().subscribe({
      next: l => { this.lists.set(l); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  open(l: ToDoList) { this.router.navigate(['/todo-lists', l.id]); }
  openForm(l: ToDoList | null) { this.editing.set(l); this.formOpen.set(true); }

  saved(l: ToDoList) {
    const wasNew = !this.editing();
    this.formOpen.set(false);
    this.toast.success(wasNew ? 'أُنشئت القائمة' : 'تم حفظ التعديلات');
    if (wasNew) this.open(l); else this.load();
  }

  async remove(l: ToDoList) {
    const extra = l.itemsTotal ? ` وبنودها (${l.itemsTotal})` : '';
    if (!(await this.confirm.ask(`حذف القائمة «${l.name}»${extra}؟ لا يمكن التراجع.`, 'حذف'))) return;
    this.service.delete(l.id).subscribe({
      next: () => { this.toast.success('تم حذف القائمة'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }
}
