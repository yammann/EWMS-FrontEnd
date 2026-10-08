import { Component, computed, input, output, signal } from '@angular/core';
import { AssignedTaskCard } from '../../core/models/assigned-task.models';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Cell { date: Date; key: string; inMonth: boolean; today: boolean; tasks: AssignedTaskCard[]; }

/** تقويم شهري لمواعيد تسليم المهام: يكشف ازدحام الأيام. النقر على مهمة يفتحها، والنقر على اليوم يعرض مهامه كاملة */
@Component({
  selector: 'app-task-calendar', standalone: true,
  template: `
    <section class="cal" aria-label="تقويم المهام">
      <header class="cal-head">
        <div class="nav">
          <button type="button" class="btn btn-ghost btn-sm" (click)="shift(-1)" aria-label="الشهر السابق">›</button>
          <h2>{{ monthName() }}</h2>
          <button type="button" class="btn btn-ghost btn-sm" (click)="shift(1)" aria-label="الشهر التالي">‹</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="today()">اليوم</button>
        @if (noDue()) { <small class="muted">{{ noDue() }} مهمة بلا موعد لا تظهر هنا</small> }
      </header>

      <div class="grid" role="grid">
        @for (d of dayNames; track d) { <div class="dow" role="columnheader">{{ d }}</div> }
        @for (c of cells(); track c.key) {
          <div class="cell" role="gridcell" [class.out]="!c.inMonth" [class.today]="c.today" [class.sel]="selected() === c.key" (click)="select(c)">
            <span class="num">{{ c.date.getDate() }}</span>
            @for (t of c.tasks.slice(0, 3); track t.id) {
              <button type="button" class="chip s-{{ t.status }}" [class.late]="t.isOverdue" (click)="open(t, $event)" [attr.title]="t.title + ' — ' + t.statusAr">{{ t.title }}</button>
            }
            @if (c.tasks.length > 3) { <small class="more">+{{ c.tasks.length - 3 }} أخرى</small> }
          </div>
        }
      </div>

      @if (selectedCell(); as c) {
        <div class="day">
          <h3>{{ c.date.getDate() }} {{ monthNames[c.date.getMonth()] }} — {{ c.tasks.length }} مهمة</h3>
          <ul>
            @for (t of c.tasks; track t.id) {
              <li><button type="button" (click)="open(t, $event)"><span class="dot s-{{ t.status }}"></span><span class="t">{{ t.title }}</span>
                <small>{{ t.targetName }} · {{ t.statusAr }}@if (t.isOverdue) { · متأخرة }</small></button></li>
            } @empty { <li class="muted">لا مهام في هذا اليوم.</li> }
          </ul>
        </div>
      }
    </section>`,
  styles: [`
    .cal { display: grid; gap: 14px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); }
    .cal-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .nav { display: flex; align-items: center; gap: 10px; }
    .nav h2 { margin: 0; font-size: 17px; min-width: 150px; text-align: center; }
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .dow { padding: 6px 0; text-align: center; font-size: 12px; font-weight: 800; color: var(--ink-500); }
    .cell { min-height: 104px; display: flex; flex-direction: column; gap: 3px; padding: 6px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); cursor: pointer; }
    .cell:hover { border-color: var(--brand-500); }
    .cell.out { background: var(--ink-50); opacity: .6; }
    .cell.today { border-color: var(--brand-600); box-shadow: inset 0 0 0 1px var(--brand-600); }
    .cell.sel { background: var(--brand-50); }
    .num { font-size: 12px; font-weight: 800; color: var(--ink-600); font-variant-numeric: tabular-nums; }
    .chip { min-height: 0; padding: 1px 6px; text-align: start; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; border-radius: var(--radius-sm); box-shadow: none; border: 0; }
    .chip:hover:not(:disabled) { transform: none; box-shadow: none; filter: brightness(.96); }
    .chip.s-Todo { background: var(--ink-100); color: var(--ink-700); }
    .chip.s-InProgress { background: var(--info-50); color: var(--info-700); }
    .chip.s-InReview { background: var(--warning-50); color: var(--warning-700); }
    .chip.s-Done { background: var(--brand-50); color: var(--brand-700); text-decoration: line-through; }
    .chip.late { background: var(--danger-50); color: var(--danger-700); }
    .more { font-size: 11px; color: var(--ink-500); font-weight: 700; }
    .day { padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); }
    .day h3 { margin: 0 0 8px; font-size: 14px; }
    .day ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .day li button { width: 100%; display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 6px 10px; background: var(--fill); color: inherit; text-align: start; box-shadow: none; font-weight: 400; }
    .day li button:hover:not(:disabled) { background: var(--fill-strong); transform: none; box-shadow: none; }
    .t { flex: 1; font-size: 13px; font-weight: 700; color: var(--ink-900); }
    .day small { color: var(--ink-500); font-size: 11.5px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-400); flex: none; }
    .dot.s-InProgress { background: var(--info-500); }
    .dot.s-InReview { background: var(--warning-500); }
    .dot.s-Done { background: var(--brand-600); }
    .muted { color: var(--ink-400); font-size: 12px; }
    @media (max-width: 760px) { .cell { min-height: 64px; } .chip { display: none; } .more { display: none; } .cell:has(.chip) .num { color: var(--brand-700); } }
  `]
})
export class TaskCalendar {
  tasks = input.required<AssignedTaskCard[]>();
  openTask = output<AssignedTaskCard>();

  dayNames = DAYS;
  monthNames = MONTHS;
  /** أول يوم من الشهر المعروض */
  month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  selected = signal<string | null>(null);

  monthName = computed(() => `${MONTHS[this.month().getMonth()]} ${this.month().getFullYear()}`);
  noDue = computed(() => this.tasks().filter(t => !t.dueDate).length);

  cells = computed<Cell[]>(() => {
    const byDay = new Map<string, AssignedTaskCard[]>();
    for (const t of this.tasks()) {
      if (!t.dueDate) continue;
      const k = t.dueDate.slice(0, 10);
      byDay.set(k, [...(byDay.get(k) ?? []), t]);
    }
    const first = this.month();
    const start = new Date(first); start.setDate(1 - first.getDay());         // الأحد أول الأسبوع
    const todayKey = key(new Date());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const k = key(date);
      return { date, key: k, inMonth: date.getMonth() === first.getMonth(), today: k === todayKey, tasks: byDay.get(k) ?? [] };
    });
  });

  selectedCell = computed(() => this.cells().find(c => c.key === this.selected()) ?? null);

  shift(delta: number) { const m = this.month(); this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1)); this.selected.set(null); }
  today() { const n = new Date(); this.month.set(new Date(n.getFullYear(), n.getMonth(), 1)); this.selected.set(key(n)); }
  select(c: Cell) { this.selected.set(this.selected() === c.key ? null : c.key); }
  open(t: AssignedTaskCard, event: Event) { event.stopPropagation(); this.openTask.emit(t); }
}
