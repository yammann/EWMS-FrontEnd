import { Component, computed, input, output, signal } from '@angular/core';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** حدود الفقاعة: نصف عرضها (ليبقى مركزها داخل الشاشة) وارتفاعها التقريبي (لتنقلب فوق الشريحة قرب أسفل الشاشة) */
const BUBBLE_HALF = 160;
const BUBBLE_HEIGHT = 190;

/** حدث له فترة: يظهر في يوم بدايته ويوم نهايته فقط، وفقاعة التفاصيل (details) عند التأشير عليه */
export interface CalendarEvent {
  id: number; title: string; start: string | null; end: string | null; tone: 'todo' | 'progress' | 'done'; late: boolean;
  /** سطر وصف قصير (المشروع · المرحلة) */
  sub: string;
  details: { label: string; value: string }[];
}

/** start = يبدأ هذا اليوم، end = ينتهي، both = يبدأ وينتهي فيه، mid = جارٍ (في قائمة اليوم فقط) */
type Mark = 'start' | 'end' | 'both' | 'mid';
interface Entry { key: string; event: CalendarEvent; mark: Mark; }
interface Cell { date: Date; key: string; inMonth: boolean; today: boolean; entries: Entry[]; }

const GLYPH: Record<Mark, string> = { start: '▸', end: '■', both: '◆', mid: '' };
const MARK_TEXT: Record<Mark, string> = { start: 'تبدأ اليوم', end: 'تنتهي اليوم', both: 'تبدأ وتنتهي اليوم', mid: 'مستمرة' };

/**
 * تقويم شهري عام: يضع كل حدث في يوم بدايته ويوم نهايته (◆ إن كانا يوماً واحداً)، فيُعرف متى تبدأ المهام ومتى تُسلَّم بلا ازدحام.
 * التأشير (أو التركيز بلوحة المفاتيح) على حدث يفتح فقاعة بتفاصيله، والنقر عليه يُصدر pick بمعرّفه.
 * النقر على اليوم يعرض قائمته: ما يبدأ فيه وما ينتهي، وما هو جارٍ فيه بين الطرفين («مستمرة»).
 * الأحداث بلا تاريخ لا تظهر (يُذكَر عددها). لا يعرف شيئاً عن نوع السجل: الصفحة تحوّل سجلاتها إلى CalendarEvent.
 */
@Component({
  selector: 'app-month-calendar', standalone: true,
  template: `
    <section class="cal" [attr.aria-label]="label()">
      <header class="cal-head">
        <div class="nav">
          <button type="button" class="btn btn-ghost btn-sm" (click)="shift(-1)" aria-label="الشهر السابق">›</button>
          <h2>{{ monthName() }}</h2>
          <button type="button" class="btn btn-ghost btn-sm" (click)="shift(1)" aria-label="الشهر التالي">‹</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="today()">اليوم</button>
        @if (noDate()) { <small class="muted">{{ noDate() }} {{ noDateText() }}</small> }
      </header>

      <div class="grid" role="grid">
        @for (d of dayNames; track d) { <div class="dow" role="columnheader">{{ d }}</div> }
        @for (c of cells(); track c.key) {
          <div class="cell" role="gridcell" [class.out]="!c.inMonth" [class.today]="c.today" [class.sel]="selected() === c.key" (click)="select(c)">
            <span class="num">{{ c.date.getDate() }}</span>
            @for (m of c.entries.slice(0, 2); track m.key) {
              <button type="button" class="chip t-{{ m.event.tone }}" [class.late]="m.event.late" (click)="open(m.event, $event)"
                      (mouseenter)="show(m, $event)" (mouseleave)="hide()" (focus)="show(m, $event)" (blur)="hide()">
                <b class="mk">{{ glyph[m.mark] }}</b> {{ m.event.title }}</button>
            }
            @if (c.entries.length > 2) { <small class="more">+{{ c.entries.length - 2 }} أخرى</small> }
          </div>
        }
      </div>

      <p class="legend"><span><b class="mk">▸</b> تبدأ</span><span><b class="mk">■</b> تنتهي</span><span><b class="mk">◆</b> تبدأ وتنتهي في اليوم نفسه</span></p>

      @if (selectedCell(); as c) {
        <div class="day">
          <h3>{{ c.date.getDate() }} {{ monthNames[c.date.getMonth()] }} — {{ dayEntries().length }} {{ countText() }}</h3>
          <ul>
            @for (m of dayEntries(); track m.key) {
              <li><button type="button" (click)="open(m.event, $event)"><span class="dot t-{{ m.event.tone }}"></span><span class="t">{{ m.event.title }}</span>
                <small>{{ m.event.sub }}@if (m.event.late) { · متأخرة }</small><small class="state">{{ markText[m.mark] }}</small></button></li>
            } @empty { <li class="muted">لا شيء في هذا اليوم.</li> }
          </ul>
        </div>
      }

      @if (tip(); as t) {
        <div class="bubble" role="tooltip" [style.left.px]="t.x" [style.top.px]="t.y" [class.above]="t.above">
          <strong>{{ t.entry.event.title }}</strong>
          <span class="state">{{ markText[t.entry.mark] }}@if (t.entry.event.late) { · متأخرة }</span>
          <dl>
            @for (d of t.entry.event.details; track d.label) { <dt>{{ d.label }}</dt><dd>{{ d.value }}</dd> }
          </dl>
        </div>
      }
    </section>
  `,
  styleUrl: './month-calendar.scss'
})
export class MonthCalendar {
  events = input.required<CalendarEvent[]>();
  label = input('التقويم');
  /** نص عدّاد اليوم المحدّد: «3 مهام» */
  countText = input('مهمة');
  /** نص الأحداث بلا تاريخ: «مهمة بلا موعد لا تظهر هنا» */
  noDateText = input('مهمة بلا موعد لا تظهر هنا');
  pick = output<number>();

  dayNames = DAYS;
  monthNames = MONTHS;
  glyph = GLYPH;
  markText = MARK_TEXT;
  /** أول يوم من الشهر المعروض */
  month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  selected = signal<string | null>(null);
  tip = signal<{ entry: Entry; x: number; y: number; above: boolean } | null>(null);

  monthName = computed(() => `${MONTHS[this.month().getMonth()]} ${this.month().getFullYear()}`);
  noDate = computed(() => this.events().filter(e => !e.start && !e.end).length);

  cells = computed<Cell[]>(() => {
    const byDay = new Map<string, Entry[]>();
    const put = (day: string, event: CalendarEvent, mark: Mark) => byDay.set(day, [...(byDay.get(day) ?? []), { key: `${event.id}-${mark}`, event, mark }]);
    for (const e of this.events()) {
      const s = e.start?.slice(0, 10), f = e.end?.slice(0, 10);
      if (s && f && s !== f) { put(s, e, 'start'); put(f, e, 'end'); }
      else if (s || f) put((s ?? f) as string, e, s && f ? 'both' : s ? 'start' : 'end');
    }
    const first = this.month();
    const start = new Date(first); start.setDate(1 - first.getDay());         // الأحد أول الأسبوع
    const todayKey = key(new Date());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const k = key(date);
      return { date, key: k, inMonth: date.getMonth() === first.getMonth(), today: k === todayKey, entries: byDay.get(k) ?? [] };
    });
  });

  selectedCell = computed(() => this.cells().find(c => c.key === this.selected()) ?? null);

  /** قائمة اليوم المحدد: ما يبدأ وينتهي فيه، ثم الجاري بين طرفيه */
  dayEntries = computed<Entry[]>(() => {
    const c = this.selectedCell();
    if (!c) return [];
    const ongoing = this.events()
      .filter(e => !!e.start && !!e.end && e.start.slice(0, 10) < c.key && e.end.slice(0, 10) > c.key)
      .map<Entry>(e => ({ key: `${e.id}-mid`, event: e, mark: 'mid' }));
    return [...c.entries, ...ongoing];
  });

  shift(delta: number) { const m = this.month(); this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1)); this.selected.set(null); this.hide(); }
  today() { const n = new Date(); this.month.set(new Date(n.getFullYear(), n.getMonth(), 1)); this.selected.set(key(n)); }
  select(c: Cell) { this.selected.set(this.selected() === c.key ? null : c.key); }
  open(e: CalendarEvent, event: Event) { event.stopPropagation(); this.hide(); this.pick.emit(e.id); }

  /** الفقاعة أسفل الشريحة، وتنقلب فوقها قرب أسفل الشاشة، ويُقصّ مركزها لتبقى داخل الشاشة */
  show(entry: Entry, event: Event) {
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, BUBBLE_HALF), Math.max(BUBBLE_HALF, window.innerWidth - BUBBLE_HALF));
    const above = r.bottom + BUBBLE_HEIGHT > window.innerHeight && r.top > BUBBLE_HEIGHT;
    this.tip.set({ entry, x, y: above ? r.top - 6 : r.bottom + 6, above });
  }
  hide() { this.tip.set(null); }
}
