import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { ScheduleDependency, ScheduleTask, TASK_COMPLETED, dateOnly } from '../data-access/schedule.models';
import { layoutGantt } from '../utils/gantt';

/**
 * مخطط غانت بـ SVG (بلا مكتبة، بلا اتصال): أسماء البنود عند اليمين والزمن يجري من اليمين إلى اليسار.
 * الشريط = التواريخ الحالية، والخط الرمادي تحته = خط الأساس (الأصلية) إن تحرك بتمديد معتمد، والتعبئة = الإنجاز.
 * أحمر = حرج، أخضر = مكتمل، وإطار برتقالي = مرشَّح للتأخر (تنبيه لا تأخير مسجَّل). السهم من نهاية السابق إلى بداية اللاحق.
 */
@Component({
  selector: 'app-schedule-gantt', standalone: true,
  template: `
    @if (tasks().length === 0) {
      <p class="empty">لا بنود في هذا الجدول بعد.</p>
    } @else {
      <div class="gantt" role="group" aria-label="مخطط غانت">
        <ol class="names" [style.--head.px]="layout().headerHeight" [style.--row.px]="layout().rowHeight">
          @for (t of tasks(); track t.id) {
            <li [class.picked]="t.id === selectedId()">
              <button type="button" (click)="taskSelect.emit(t.id)">
                @if (t.code) { <small dir="ltr">{{ t.code }}</small> }
                <span class="n">{{ t.name }}</span>
              </button>
            </li>
          }
        </ol>
        <div class="scroll" #scroll>
          <svg [attr.width]="layout().width" [attr.height]="layout().height" [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
               role="img" [attr.aria-label]="'مخطط زمني لـ ' + tasks().length + ' بنداً'">
            <defs><marker id="gantt-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" class="arrow-head" /></marker></defs>
            @for (tick of layout().ticks; track tick.x) {
              <line class="grid" [attr.x1]="tick.x" [attr.x2]="tick.x" [attr.y1]="0" [attr.y2]="layout().height" />
              <text class="month" [attr.x]="tick.x - 6" y="21">{{ tick.label }}</text>
            }
            @for (b of layout().bars; track b.id; let i = $index) {
              <rect class="stripe" [class.odd]="i % 2 === 1" x="0" [attr.y]="layout().headerHeight + i * layout().rowHeight" [attr.width]="layout().width" [attr.height]="layout().rowHeight" />
            }
            @if (layout().todayX !== null) { <line class="today" [attr.x1]="layout().todayX" [attr.x2]="layout().todayX" y1="26" [attr.y2]="layout().height" /> }
            @for (a of layout().arrows; track a.id) {
              <path class="arrow" [class.conflict]="a.conflict" [attr.d]="a.path" marker-end="url(#gantt-arrow)" />
            }
            @for (b of layout().bars; track b.id; let i = $index) {
              @let t = tasks()[i];
              <g class="bar-group" [class.picked]="t.id === selectedId()" (click)="taskSelect.emit(t.id)" tabindex="0" role="button"
                 (keydown.enter)="taskSelect.emit(t.id)" [attr.aria-label]="label(t)">
                @if (b.baseX !== null) { <rect class="base" [attr.x]="b.baseX" [attr.y]="b.y + layout().barHeight + 2" [attr.width]="b.baseWidth" height="3" rx="1.5" /> }
                <rect class="track" [class.overdue]="t.isOverdueCandidate" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.width" [attr.height]="layout().barHeight" rx="4" />
                <rect class="fill" [class.critical]="t.isCritical" [class.done]="t.status === completed" [attr.x]="b.x + b.width - b.progressWidth" [attr.y]="b.y"
                      [attr.width]="b.progressWidth" [attr.height]="layout().barHeight" rx="4" />
                <rect class="hit" [attr.x]="b.x" [attr.y]="layout().headerHeight + i * layout().rowHeight" [attr.width]="b.width" [attr.height]="layout().rowHeight" />
                <title>{{ label(t) }}</title>
              </g>
            }
          </svg>
        </div>
      </div>
      <p class="legend" aria-hidden="true">
        <span><i class="sw normal"></i> البند</span><span><i class="sw critical"></i> حرج</span><span><i class="sw done"></i> مكتمل</span>
        <span><i class="sw overdue"></i> مرشَّح للتأخر</span><span><i class="sw base"></i> خط الأساس</span>
      </p>
    }`,
  styles: [`
    :host { display: block; }
    .empty { margin: 0; padding: 24px; text-align: center; color: var(--ink-500); }
    .gantt { display: grid; grid-template-columns: minmax(150px, 220px) 1fr; border: 1px solid var(--line, var(--ink-300)); border-radius: var(--radius-md); overflow: hidden; background: var(--surface); }
    .names { margin: 0; padding: 0; list-style: none; padding-top: var(--head); border-inline-end: 1px solid var(--line, var(--ink-300)); }
    .names li { height: var(--row); display: flex; align-items: stretch; }
    .names li:nth-child(even) { background: var(--fill); }
    .names li.picked { background: var(--brand-50); }
    .names button { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 6px; padding: 0 10px; cursor: pointer; min-width: 0; font-size: 13px; color: var(--ink-800); }
    .names button:focus-visible { outline: 2px solid var(--brand-600); outline-offset: -2px; }
    .names small { color: var(--ink-500); flex: none; }
    .names .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .scroll { overflow-x: auto; overflow-y: hidden; }
    svg { display: block; direction: rtl; }
    .stripe { fill: transparent; } .stripe.odd { fill: var(--fill); }
    .grid { stroke: var(--ink-300); stroke-width: 1; opacity: .55; }
    .month { fill: var(--ink-500); font-size: 11px; font-family: inherit; direction: rtl; }
    .today { stroke: var(--danger-500); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .arrow { fill: none; stroke: var(--ink-400); stroke-width: 1.2; }
    .arrow.conflict { stroke: var(--danger-600); stroke-dasharray: 3 3; }
    .arrow-head { fill: var(--ink-400); }
    .track { fill: var(--brand-100); }
    .track.overdue { stroke: var(--warning-500); stroke-width: 2; }
    .fill { fill: var(--brand-600); } .fill.critical { fill: var(--danger-600); } .fill.done { fill: var(--success-500); }
    .base { fill: var(--ink-400); }
    .hit { fill: transparent; cursor: pointer; }
    .bar-group:focus-visible { outline: none; } .bar-group:focus-visible .track, .bar-group.picked .track { stroke: var(--brand-700); stroke-width: 2; }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 0 0; font-size: 12px; color: var(--ink-600); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .sw { width: 14px; height: 8px; border-radius: 3px; display: inline-block; }
    .sw.normal { background: var(--brand-600); } .sw.critical { background: var(--danger-600); } .sw.done { background: var(--success-500); }
    .sw.overdue { background: var(--brand-100); outline: 2px solid var(--warning-500); outline-offset: -2px; } .sw.base { background: var(--ink-400); height: 3px; }
  `]
})
export class ScheduleGantt {
  tasks = input.required<readonly ScheduleTask[]>();
  dependencies = input<readonly ScheduleDependency[]>([]);
  selectedId = input<number | null>(null);
  /** تكبير يدوي بعرض اليوم؛ الافتراضي يلائم الجدول كله عرض الشاشة (بين 2.5 و14 بكسل لليوم) */
  pxPerDay = input<number | null>(null);
  taskSelect = output<number>();

  protected completed = TASK_COMPLETED;

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private available = signal(900);

  constructor() {
    afterNextRender(() => {
      const area = this.host.nativeElement.querySelector<HTMLElement>('.scroll');
      const measure = () => this.available.set(area?.clientWidth || this.host.nativeElement.clientWidth || 900);
      measure();
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(this.host.nativeElement);
    });
  }

  /** عرض اليوم: ما يجعل المدى كله ظاهراً دون تمرير، ضمن حدّين معقولين */
  private px = computed(() => {
    const manual = this.pxPerDay();
    if (manual) return manual;
    const days = layoutGantt(this.tasks(), [], { pxPerDay: 1 }).width || 1;
    return Math.min(14, Math.max(2.5, Math.floor((this.available() / days) * 10) / 10));
  });

  protected layout = computed(() => layoutGantt(this.tasks(), this.dependencies(), { pxPerDay: this.px(), today: this.today() }));

  private today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  protected label(t: ScheduleTask) {
    return `${t.name}: ${dateOnly(t.plannedStart)} ← ${dateOnly(t.plannedEnd)} · ${t.progress}% · ${t.statusName}${t.isCritical ? ' · حرج' : ''}${t.isOverdueCandidate ? ' · مرشَّح للتأخر' : ''}`;
  }
}
