import { Component, computed, input, output, signal } from '@angular/core';
import { AssignedTaskCard } from '../data-access/assigned-task.models';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Cell { date: Date; key: string; inMonth: boolean; today: boolean; tasks: AssignedTaskCard[]; }

/** تقويم شهري لمواعيد تسليم المهام: يكشف ازدحام الأيام. النقر على مهمة يفتحها، والنقر على اليوم يعرض مهامه كاملة */
@Component({
  selector: 'app-task-calendar', standalone: true,
  templateUrl: './task-calendar.html',
  styleUrl: './task-calendar.scss'
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
