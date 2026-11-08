import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SelectValue } from '@shared/ui/select-value';
import { ProjectStage, StageTask } from '../data-access/studies.models';

const DAY = 86_400_000;
/** عرض اليوم بالبكسل لكل مستوى تكبير: أسبوع (مقرّب)، شهر، ربع (مبعَّد) */
const ZOOM_W = { week: 28, month: 10, quarter: 4 } as const;
type Zoom = keyof typeof ZOOM_W;
const ZOOMS: { key: Zoom; label: string }[] = [{ key: 'week', label: 'أسبوع' }, { key: 'month', label: 'شهر' }, { key: 'quarter', label: 'ربع' }];
const HEAD_H = 52;
const FOOT_H = 30;
const ROW_H = { milestone: 28, stage: 36, task: 28 } as const;
/** أقل عرض شريط يتسع لنسبة الإنجاز داخله */
const MIN_PERCENT_W = 34;
const TIP_W = 250;
const COMPACT_QUERY = '(max-width: 640px)';

type RowKind = 'milestone' | 'stage' | 'task';
type BarState = 'closed' | 'active' | 'todo' | 'late';

interface Row {
  key: string; kind: RowKind; stageId: number; label: string; sub: string; dept: string; statusName: string;
  start: number | null; end: number | null; progress: number; state: BarState; lateDays: number; hasTasks: boolean; taskCount: number;
}
interface Placed extends Row {
  y: number; h: number; cy: number;
  /** الشريط: الحافة اليمنى (الأبكر)، العرض، عرض الإنجاز */
  right: number; w: number; fillW: number;
  /** نسبة الإنجاز داخل الشريط (إن اتسع) */
  pct: { x: number; text: string; onFill: boolean } | null;
}
interface Month { x: number; w: number; text: string; }
interface Tick { x: number; text: string; }

/** التاريخ (yyyy-MM-dd) كعدد أيام من 1970 بلا انزياح المناطق */
const toDay = (value: string | null | undefined) => {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
const todayDay = () => { const n = new Date(); return Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY); };
const LOCALE = 'ar-SY-u-ca-gregory-nu-latn';
const monthName = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtDay = (d: number) => dayMonth.format(new Date(d * DAY));

/**
 * مخطط Gantt للمشروع (SVG يدوي، RTL): الأسماء في عمود ثابت لا يتحرك مع التمرير الأفقي، والزمن يجري من اليمين إلى اليسار.
 * - المراحل المرتبطة بمستند (طلب، تكليف، رد، أمر بدء) معالم ◆ في تاريخ مستندها؛ مراحل العمل أشرطة أسمك من أشرطة المهام.
 * - الحالة بالشكل: مغلقة صلبة، جارية بتعبئة إنجاز، لم تبدأ بإطار منقّط، متأخرة بتهشير أحمر.
 * - نسبة الإنجاز داخل الشريط فقط (إن اتسع)، وباقي التفاصيل في بطاقة عند التأشير أو التركيز بالمفتاح.
 * - المحور بأسماء الشهور وأسابيع وتظليل الجمعة وخط «اليوم»؛ تكبير (أسبوع/شهر/ربع)، طيّ المراحل، وفلتر «المتأخر فقط» و«حسب القسم».
 * - الجوال (≤ 640px): قائمة مبسّطة بالمراحل وشريط إنجاز لكل منها (والمهام بالفتح).
 * - وضع الطباعة (`printMode` + `fit`): بلا أدوات ولا تمرير، ويُضبط عرض اليوم ليتسع المخطط في عرض الورقة.
 */
@Component({
  selector: 'app-study-gantt',
  standalone: true,
  imports: [RouterLink, SelectValue],
  template: `
    @if (!all().length) {
      <p class="muted">لا مراحل بعد لعرضها.</p>
    } @else {
      @if (!printMode()) {
        <div class="toolbar">
          @if (!compact()) {
            <div class="seg" role="group" aria-label="مستوى التكبير">
              @for (z of zooms; track z.key) { <button type="button" [class.on]="zoom() === z.key" [attr.aria-pressed]="zoom() === z.key" (click)="setZoom(z.key)">{{ z.label }}</button> }
            </div>
          }
          @if (depts().length > 1) {
            <select #dsel class="dept" [appSelectValue]="dept()" (change)="dept.set(dsel.value)" aria-label="القسم المسؤول">
              <option value="">كل الأقسام</option>
              @for (d of depts(); track d) { <option [value]="d">{{ d }}</option> }
            </select>
          }
          <button type="button" class="btn btn-ghost btn-sm" [class.on]="lateOnly()" [attr.aria-pressed]="lateOnly()" (click)="lateOnly.set(!lateOnly())">المتأخر فقط</button>
          @if (anyTasks()) { <button type="button" class="btn btn-ghost btn-sm" (click)="toggleAll()">{{ allCollapsed() ? 'فتح كل المراحل' : 'طيّ كل المراحل' }}</button> }
          @if (hasToday() && !compact()) { <button type="button" class="btn btn-ghost btn-sm" (click)="scrollToToday(true)">الانتقال إلى اليوم</button> }
          @if (projectId() && !compact()) { <a class="btn btn-ghost btn-sm" [routerLink]="['/studies/print/project-gantt', projectId()]">طباعة</a> }
          @if (filtersActive()) { <button type="button" class="btn btn-ghost btn-sm" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>
      }

      @if (!rows().length) {
        <p class="muted none">لا نتائج مطابقة للفلاتر الحالية.</p>
      } @else if (compact() && !printMode()) {
        <!-- عرض الجوال: المراحل بشريط إنجاز، والمهام بالفتح -->
        <ul class="m-list">
          @for (r of rows(); track r.key) {
            <li class="m-item" [class.task]="r.kind === 'task'" [class.milestone]="r.kind === 'milestone'">
              <div class="m-head">
                @if (r.kind === 'stage' && r.hasTasks) {
                  <button type="button" class="fold" [attr.aria-expanded]="!isCollapsed(r.stageId)" [attr.aria-label]="(isCollapsed(r.stageId) ? 'فتح مهام ' : 'طيّ مهام ') + r.label" (click)="toggle(r.stageId)">
                    <svg class="chev" [class.closed]="isCollapsed(r.stageId)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                } @else if (r.kind === 'milestone') { <span class="diamond" aria-hidden="true"></span> }
                <strong class="m-name">{{ r.label }}</strong>
                @if (r.kind === 'stage' && r.hasTasks && isCollapsed(r.stageId)) { <small class="count">{{ r.taskCount }} مهام</small> }
              </div>
              @if (r.kind !== 'milestone') {
                <div class="m-meta"><span>{{ dateText(r) }}</span><span class="m-status" [class.late]="r.state === 'late'">{{ r.state === 'late' ? 'متأخرة ' + r.lateDays + ' يوم' : r.statusName }}</span></div>
                <div class="m-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="r.progress" [attr.aria-label]="'إنجاز ' + r.label">
                  <span class="m-fill" [class.late]="r.state === 'late'" [class.closed]="r.state === 'closed'" [style.width.%]="r.state === 'closed' ? 100 : r.progress"></span>
                  <span class="m-pct" [class.on-fill]="r.state === 'closed' || r.state === 'late' || r.progress >= 85">{{ r.state === 'closed' ? 100 : r.progress }}%</span>
                </div>
              } @else { <div class="m-meta"><span>{{ dateText(r) }}</span></div> }
            </li>
          }
        </ul>
      } @else {
        <div #wrap class="wrap" [class.print]="printMode()" (mouseleave)="tip.set(null)">
          <div class="gantt">
            <div class="labels" [style.width.px]="labelW()" [style.height.px]="totalH()">
              <div class="lab-head" [style.height.px]="headH">المرحلة أو المهمة</div>
              @for (r of placed(); track r.key) {
                <div class="lab" [class.stage]="r.kind === 'stage'" [class.task]="r.kind === 'task'" [class.milestone]="r.kind === 'milestone'"
                     [class.hover]="hoverKey() === r.key" [style.height.px]="r.h" (mouseenter)="hoverKey.set(r.key)" (mouseleave)="hoverKey.set(null)">
                  @if (r.kind === 'stage' && r.hasTasks && !printMode()) {
                    <button type="button" class="fold" [attr.aria-expanded]="!isCollapsed(r.stageId)" [attr.aria-label]="(isCollapsed(r.stageId) ? 'فتح مهام ' : 'طيّ مهام ') + r.label" (click)="toggle(r.stageId)">
                      <svg class="chev" [class.closed]="isCollapsed(r.stageId)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  } @else if (r.kind === 'milestone') { <span class="diamond" aria-hidden="true"></span> }
                  <span class="name" [title]="r.label">
                    <span class="nm">{{ parts(r.label).head }}</span>@if (parts(r.label).tail; as tail) { <bdi class="latin">{{ tail }}</bdi> }
                  </span>
                  @if (r.kind === 'stage' && r.hasTasks && isCollapsed(r.stageId) && !printMode()) { <small class="count">{{ r.taskCount }} مهام</small> }
                </div>
              }
            </div>

            <div #scroller class="scroller" [attr.tabindex]="printMode() ? null : 0" role="region" aria-label="المخطط الزمني: يُمرَّر أفقياً">
              <svg [attr.width]="W()" [attr.height]="totalH()" [attr.viewBox]="'0 0 ' + W() + ' ' + totalH()" role="img" aria-label="مخطط زمني للمراحل والمهام">
                <defs>
                  <pattern id="gantt-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" class="hatch-bg" />
                    <line x1="0" y1="0" x2="0" y2="6" class="hatch-line" />
                  </pattern>
                </defs>

                <!-- رأس المحور: الشهور ثم الأسابيع -->
                <rect class="head-bg" x="0" y="0" [attr.width]="W()" [attr.height]="headH" />
                @for (m of months(); track $index) {
                  <line class="month-line" [attr.x1]="m.x + m.w" [attr.x2]="m.x + m.w" y1="0" [attr.y2]="bodyBottom()" />
                  @if (m.w >= 56) { <text class="month-text" [attr.x]="m.x + m.w / 2" y="17" text-anchor="middle">{{ m.text }}</text> }
                }
                <line class="head-line" x1="0" [attr.x2]="W()" y1="26" y2="26" />
                @for (t of weeks(); track $index) {
                  <line class="week-line" [attr.x1]="t.x" [attr.x2]="t.x" y1="26" [attr.y2]="bodyBottom()" />
                  @if (dayW() * 7 >= 24) { <text class="week-text" [attr.x]="t.x - 4" y="43" text-anchor="end">{{ t.text }}</text> }
                }
                <line class="head-line" x1="0" [attr.x2]="W()" [attr.y1]="headH" [attr.y2]="headH" />

                <!-- الجمعة -->
                @for (f of fridays(); track $index) { <rect class="friday" [attr.x]="f" [attr.y]="headH" [attr.width]="dayW()" [attr.height]="bodyH()" /> }

                <!-- الصفوف -->
                @for (r of placed(); track r.key) {
                  <g class="row" [class.hover]="hoverKey() === r.key" (mouseenter)="hoverKey.set(r.key)" (mouseleave)="hoverKey.set(null)">
                    <rect class="row-bg" x="0" [attr.y]="r.y" [attr.width]="W()" [attr.height]="r.h" />
                    <line class="row-line" x1="0" [attr.x2]="W()" [attr.y1]="r.y + r.h" [attr.y2]="r.y + r.h" />
                    @if (r.start != null) {
                      @if (r.kind === 'milestone') {
                        <g class="mark" tabindex="0" role="img" [attr.aria-label]="r.label + ': ' + dateText(r)"
                           (mouseenter)="showTip(r, $event)" (mousemove)="moveTip($event)" (mouseleave)="tip.set(null)" (focus)="focusTip(r, $event)" (blur)="tip.set(null)">
                          <rect class="hit" [attr.x]="r.right - 14" [attr.y]="r.y" width="28" [attr.height]="r.h" />
                          <polygon class="diamond-mark" [attr.points]="diamond(r.right, r.cy)" />
                        </g>
                      } @else {
                        <g class="mark" tabindex="0" role="img" [attr.aria-label]="r.label + ': ' + dateText(r) + '، ' + r.progress + '%'"
                           (mouseenter)="showTip(r, $event)" (mousemove)="moveTip($event)" (mouseleave)="tip.set(null)" (focus)="focusTip(r, $event)" (blur)="tip.set(null)">
                          <rect class="hit" [attr.x]="r.right - r.w" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h" />
                          @switch (r.state) {
                            @case ('closed') { <rect class="bar closed grow" [class.thin]="r.kind === 'task'" [attr.x]="r.right - r.w" [attr.y]="r.cy - barH(r) / 2" [attr.width]="r.w" [attr.height]="barH(r)" rx="4" /> }
                            @case ('todo') { <rect class="bar todo" [attr.x]="r.right - r.w" [attr.y]="r.cy - barH(r) / 2" [attr.width]="r.w" [attr.height]="barH(r)" rx="4" /> }
                            @case ('late') {
                              <rect class="bar late" [attr.x]="r.right - r.w" [attr.y]="r.cy - barH(r) / 2" [attr.width]="r.w" [attr.height]="barH(r)" rx="4" fill="url(#gantt-hatch)" />
                              @if (r.fillW > 0) { <rect class="fill late grow" [attr.x]="r.right - r.fillW" [attr.y]="r.cy - barH(r) / 2" [attr.width]="r.fillW" [attr.height]="barH(r)" rx="4" /> }
                            }
                            @default {
                              <rect class="bar track" [attr.x]="r.right - r.w" [attr.y]="r.cy - barH(r) / 2" [attr.width]="r.w" [attr.height]="barH(r)" rx="4" />
                              @if (r.fillW > 0) { <rect class="fill grow" [class.thin]="r.kind === 'task'" [attr.x]="r.right - r.fillW" [attr.y]="r.cy - barH(r) / 2" [attr.width]="r.fillW" [attr.height]="barH(r)" rx="4" /> }
                            }
                          }
                          @if (r.pct; as p) { <text class="pct" [class.on-fill]="p.onFill" [class.small]="r.kind === 'task'" [attr.x]="p.x" [attr.y]="r.cy + 3.5" text-anchor="end">{{ p.text }}</text> }
                        </g>
                      }
                    }
                  </g>
                }

                <!-- اليوم -->
                @if (todayX(); as x) {
                  <line class="today" [attr.x1]="x" [attr.x2]="x" [attr.y1]="26" [attr.y2]="bodyBottom()" />
                  <rect class="today-chip" [attr.x]="x - 30" [attr.y]="bodyBottom() + 4" width="60" height="20" rx="10" />
                  <text class="today-text" [attr.x]="x" [attr.y]="bodyBottom() + 18" text-anchor="middle">اليوم {{ todayText }}</text>
                }
              </svg>
            </div>
          </div>

          @if (tip(); as t) {
            <div class="tip" role="tooltip" [style.left.px]="t.x" [style.top.px]="t.y">
              <strong>{{ t.row.label }}</strong>
              @if (t.row.sub) { <span class="tip-sub">{{ t.row.sub }}</span> }
              <span class="tip-line">{{ dateText(t.row) }}</span>
              @if (t.row.kind !== 'milestone') {
                <span class="tip-line">الإنجاز {{ t.row.progress }}% · {{ t.row.statusName }}</span>
                @if (t.row.state === 'late') { <span class="tip-late">متأخرة {{ t.row.lateDays }} {{ t.row.lateDays === 1 ? 'يوم' : 'أيام' }}</span> }
              } @else { <span class="tip-line">{{ t.row.statusName }}</span> }
            </div>
          }
        </div>
      }

      <ul class="legend">
        <li><span class="sw closed"></span> مغلقة</li>
        <li><span class="sw active"></span> جارية (تعبئة الإنجاز)</li>
        <li><span class="sw todo"></span> لم تبدأ</li>
        <li><span class="sw late"></span> متأخرة</li>
        <li><span class="sw diamond-sw"></span> مستند</li>
      </ul>
      @if (undated().length) { <p class="muted note">بلا تواريخ مخططة (لا شريط لها): {{ undated().join('، ') }}.</p> }
    }
  `,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
    .toolbar .on { background: var(--brand-100); color: var(--brand-700); }
    .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--fill); }
    .seg button { min-height: 28px; padding: 0 12px; background: transparent; color: var(--ink-600); font-size: 12px; font-weight: 700; border-radius: 8px; box-shadow: none; }
    .seg button:hover { background: var(--surface); transform: none; box-shadow: none; }
    .seg button.on { background: var(--surface); color: var(--ink-900); box-shadow: 0 1px 2px rgba(0, 0, 0, .12); }
    .dept { width: auto; min-width: 150px; max-width: 240px; min-height: 32px; font-size: 12px; }
    .none { margin: 12px 0; }
    .wrap { position: relative; border-radius: 12px; background: var(--fill); overflow: hidden; }
    .gantt { display: flex; min-width: 0; }
    .labels { flex: none; background: var(--surface); box-shadow: -1px 0 0 var(--separator) inset; z-index: 1; }
    .lab-head { display: flex; align-items: flex-end; padding: 0 12px 8px; font-size: 12px; font-weight: 700; color: var(--ink-700); border-bottom: 1px solid var(--separator); box-sizing: border-box; background: var(--fill); }
    .lab { display: flex; align-items: center; gap: 6px; padding: 0 10px; border-bottom: 1px solid var(--separator); box-sizing: border-box; min-width: 0; }
    .lab.stage { font-weight: 700; font-size: 13px; color: var(--ink-900); }
    .lab.task { font-size: 12px; color: var(--ink-600); padding-inline-start: 30px; }
    .lab.milestone { font-size: 12px; color: var(--ink-600); }
    .lab.hover { background: var(--fill); }
    .name { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 4px; overflow: hidden; white-space: nowrap; }
    /* الجزء العربي يُقتطع بنقاط، والذيل اللاتيني (Concept) يبقى كاملاً: القطع داخل مقطع لاتيني في سياق RTL يُظهر «(ncept)» */
    .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .latin { flex: none; direction: ltr; unicode-bidi: isolate; }
    .count { color: var(--ink-500); font-size: 11px; font-weight: 400; white-space: nowrap; }
    .fold { display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border-radius: 6px; background: transparent; color: var(--ink-600); box-shadow: none; flex: none; }
    .fold:hover { background: var(--fill-strong); transform: none; box-shadow: none; }
    .chev { display: block; transition: transform .18s; }
    .chev.closed { transform: rotate(90deg); }
    .diamond { width: 9px; height: 9px; background: var(--brand-700); transform: rotate(45deg); flex: none; margin-inline: 6px 8px; border-radius: 1px; }

    .scroller { flex: 1; min-width: 0; overflow-x: auto; direction: rtl; background: var(--surface); }
    .scroller:focus-visible { outline: 2px solid var(--brand-500); outline-offset: -2px; }
    svg { display: block; direction: ltr; }
    .head-bg { fill: var(--fill); }
    .head-line, .row-line { stroke: var(--separator); stroke-width: 1; }
    .month-line { stroke: var(--ink-300); stroke-width: 1; }
    .week-line { stroke: var(--separator); stroke-width: 1; }
    .month-text { fill: var(--ink-800); font-size: 12px; font-weight: 700; }
    .week-text { fill: var(--ink-500); font-size: 11px; }
    .friday { fill: var(--fill); opacity: .6; }
    .row-bg { fill: transparent; }
    .row.hover .row-bg { fill: var(--fill); opacity: .7; }

    .hit { fill: transparent; }
    .mark { cursor: default; outline: none; }
    .mark:focus-visible .hit, .mark:hover .hit { fill: var(--brand-100); opacity: .6; }
    .bar.closed { fill: var(--brand-700); }
    .bar.closed.thin { fill: var(--brand-500); }
    .bar.track { fill: var(--brand-100); stroke: var(--brand-300); stroke-width: 1; }
    .bar.todo { fill: transparent; stroke: var(--ink-400); stroke-width: 1; stroke-dasharray: 4 3; }
    .bar.late { stroke: var(--danger-500); stroke-width: 1; }
    .hatch-bg { fill: var(--danger-100); }
    .hatch-line { stroke: var(--danger-500); stroke-width: 2.2; opacity: .75; }
    .fill { fill: var(--brand-600); }
    .fill.thin { fill: var(--brand-500); }
    .fill.late { fill: var(--danger-500); }
    /* تنمو التعبئة من اليمين (بداية الزمن) عند ظهورها */
    .grow { transform-box: fill-box; transform-origin: 100% 50%; animation: gantt-grow .55s cubic-bezier(.2, .8, .2, 1) both; }
    @keyframes gantt-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .diamond-mark { fill: var(--brand-700); }
    .pct { fill: var(--ink-900); font-size: 11px; font-weight: 700; pointer-events: none; }
    .pct.small { font-size: 10px; }
    .pct.on-fill { fill: var(--on-brand, #fff); }

    .today { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
    .today-chip { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1; }
    .today-text { fill: var(--ink-800); font-size: 11px; font-weight: 700; }

    .tip { position: absolute; z-index: 5; width: 250px; display: grid; gap: 3px; padding: 10px 12px; border-radius: 10px; pointer-events: none;
      background: var(--surface-raised, var(--surface)); border: 1px solid var(--ink-300); box-shadow: 0 8px 24px rgba(0, 0, 0, .14); font-size: 12px; color: var(--ink-700); }
    .tip strong { font-size: 13px; color: var(--ink-900); overflow-wrap: anywhere; }
    .tip-sub { color: var(--ink-500); }
    .tip-line { color: var(--ink-700); }
    .tip-late { color: var(--danger-600); font-weight: 700; }

    /* الجوال: قائمة المراحل */
    .m-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .m-item { display: grid; gap: 6px; padding: 10px 12px; border-radius: 12px; background: var(--fill); }
    .m-item.task { margin-inline-start: 18px; background: var(--surface-alt, var(--fill)); }
    .m-item.milestone { padding: 8px 12px; }
    .m-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .m-name { flex: 1; min-width: 0; font-size: 13px; color: var(--ink-900); overflow-wrap: anywhere; }
    .m-item.task .m-name { font-size: 12px; font-weight: 400; color: var(--ink-700); }
    .m-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--ink-500); }
    .m-status.late { color: var(--danger-600); font-weight: 700; }
    .m-bar { position: relative; height: 16px; border-radius: 8px; background: var(--brand-100); overflow: hidden; }
    .m-fill { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 8px; background: var(--brand-600); transition: width .5s cubic-bezier(.2, .8, .2, 1); }
    .m-fill.closed { background: var(--brand-700); }
    .m-fill.late { background: var(--danger-500); }
    .m-pct { position: absolute; inset-block: 0; inset-inline-end: 8px; display: grid; align-items: center; font-size: 11px; font-weight: 700; color: var(--ink-900); }
    .m-pct.on-fill { color: var(--on-brand, #fff); }

    .legend { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 12px 0 0; padding: 0; font-size: 12px; color: var(--ink-600); }
    .legend li { display: inline-flex; align-items: center; gap: 6px; }
    .sw { width: 16px; height: 9px; border-radius: 3px; display: inline-block; }
    .sw.closed { background: var(--brand-700); }
    .sw.active { background: linear-gradient(to left, var(--brand-600) 55%, var(--brand-100) 55%); border: 1px solid var(--brand-300); box-sizing: border-box; }
    .sw.todo { border: 1px dashed var(--ink-400); box-sizing: border-box; }
    .sw.late { background: repeating-linear-gradient(135deg, var(--danger-500) 0 2px, var(--danger-100) 2px 5px); border: 1px solid var(--danger-500); box-sizing: border-box; }
    .sw.diamond-sw { width: 9px; height: 9px; background: var(--brand-700); transform: rotate(45deg); border-radius: 1px; margin-inline: 3px; }
    .note { margin: 10px 0 0; font-size: 13px; }

    /* الطباعة: بلا تمرير ولا ظلال، وخلفية بيضاء */
    .wrap.print { background: #fff; border-radius: 0; overflow: visible; }
    .wrap.print .scroller { overflow: visible; }
    @media (prefers-reduced-motion: reduce) { .chev, .m-fill { transition: none; } .grow { animation: none; } }
    @media print { .grow { animation: none; } .wrap { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `]
})
export class StudyGantt {
  stages = input.required<ProjectStage[]>();
  tasks = input<StageTask[]>([]);
  /** حدّا المشروع المخططان (يوسّعان المحور إن خرجت عنهما المراحل) */
  projectStart = input<string | null>(null);
  projectEnd = input<string | null>(null);
  /** معرّف المشروع: يُظهر زر الطباعة */
  projectId = input<number | null>(null);
  /** وضع الطباعة: بلا أدوات ولا تمرير ولا تلميحات */
  printMode = input(false);
  /** عرض الورقة المتاح للمحور بالبكسل: يُضبط عرض اليوم ليتسع المخطط كله (مع printMode) */
  fit = input<number | null>(null);
  /** إظهار المهام (الطباعة تُظهر المراحل وحدها افتراضياً ليتسع المخطط في صفحة) */
  tasksVisible = input(true);

  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private wrap = viewChild<ElementRef<HTMLElement>>('wrap');

  readonly zooms = ZOOMS;
  readonly headH = HEAD_H;
  readonly todayText = (() => { const n = new Date(); return `${n.getDate()}/${n.getMonth() + 1}`; })();

  zoom = signal<Zoom>('month');
  lateOnly = signal(false);
  dept = signal('');
  compact = signal(false);
  /** مراحل مطويّة (تظهر بلا مهامها) */
  private collapsed = signal<ReadonlySet<number>>(new Set());
  hoverKey = signal<string | null>(null);
  tip = signal<{ row: Placed; x: number; y: number } | null>(null);
  private scrolled = false;
  private compactInit = false;

  isCollapsed = (stageId: number) => this.collapsed().has(stageId);
  toggle(stageId: number) {
    this.collapsed.update(s => { const n = new Set(s); n.has(stageId) ? n.delete(stageId) : n.add(stageId); return n; });
  }

  /** كل الصفوف قبل الطي والفلاتر: معلم لكل مرحلة مستند، مرحلة عمل ثم مهامها */
  all = computed<Row[]>(() => {
    const today = todayDay();
    const byStage = new Map<number, StageTask[]>();
    for (const t of this.tasks()) (byStage.get(t.stageId) ?? byStage.set(t.stageId, []).get(t.stageId)!).push(t);
    const rows: Row[] = [];
    for (const s of this.stages()) {
      const tasks = byStage.get(s.id) ?? [];
      const dept = s.responsibleDepartmentName ?? '';
      if (s.linkedDocument) {
        rows.push({
          key: 's' + s.id, kind: 'milestone', stageId: s.id, label: s.stageTypeName, sub: '', dept, statusName: s.statusName,
          start: toDay(s.plannedStartDate) ?? toDay(s.actualStartDate) ?? toDay(s.plannedEndDate), end: null, progress: 100, state: 'closed', lateDays: 0, hasTasks: false, taskCount: 0
        });
        continue;
      }
      const end = toDay(s.plannedEndDate);
      const late = s.status !== 3 && end != null && end < today && s.progress < 100;
      rows.push({
        key: 's' + s.id, kind: 'stage', stageId: s.id, label: s.stageTypeName, sub: dept, dept, statusName: s.statusName,
        start: toDay(s.plannedStartDate), end, progress: s.progress,
        state: s.status === 3 ? 'closed' : late ? 'late' : s.progress > 0 || s.status === 2 ? 'active' : 'todo',
        lateDays: late && end != null ? today - end : 0, hasTasks: tasks.length > 0, taskCount: tasks.length
      });
      for (const t of tasks) {
        const e = toDay(t.plannedEndDate);
        const tl = t.status !== 3 && e != null && e < today;
        rows.push({
          key: 't' + t.id, kind: 'task', stageId: s.id, label: t.title, sub: `${t.targetTypeName}: ${t.targetName}`, dept, statusName: t.statusName,
          start: toDay(t.plannedStartDate), end: e, progress: t.progress,
          state: t.status === 3 ? 'closed' : tl ? 'late' : t.progress > 0 || t.status === 2 ? 'active' : 'todo',
          lateDays: tl && e != null ? today - e : 0, hasTasks: false, taskCount: 0
        });
      }
    }
    return rows;
  });

  /** الأقسام المسؤولة عن المراحل (لفلتر «حسب القسم») */
  depts = computed(() => [...new Set(this.all().filter(r => r.kind === 'stage' && r.dept).map(r => r.dept))].sort((a, b) => a.localeCompare(b, 'ar')));
  filtersActive = computed(() => !!this.dept() || this.lateOnly());
  clearFilters() { this.dept.set(''); this.lateOnly.set(false); }

  /**
   * الصفوف الظاهرة: الفلاتر ثم الطي. فلتر القسم يُبقي مراحل ذلك القسم بمهامها؛ و«المتأخر فقط» يُبقي المرحلة المتأخرة
   * أو التي فيها مهمة متأخرة (والمتأخر من مهامها). وأي فلتر فعّال يُخفي معالم المستندات ليتركّز العرض.
   */
  rows = computed<Row[]>(() => {
    const all = this.all(), dept = this.dept(), lateOnly = this.lateOnly(), collapsed = this.collapsed(), tasksVisible = this.tasksVisible();
    const out: Row[] = [];
    for (let i = 0; i < all.length;) {
      const r = all[i];
      if (r.kind === 'milestone') { if (!dept && !lateOnly) out.push(r); i++; continue; }
      const tasks: Row[] = [];
      let j = i + 1;
      while (j < all.length && all[j].kind === 'task' && all[j].stageId === r.stageId) tasks.push(all[j++]);
      i = j;
      if (dept && r.dept !== dept) continue;
      const lateTasks = tasks.filter(t => t.state === 'late');
      if (lateOnly && r.state !== 'late' && !lateTasks.length) continue;
      out.push(r);
      if (!tasksVisible || collapsed.has(r.stageId)) continue;
      out.push(...(lateOnly ? lateTasks : tasks));
    }
    return out;
  });
  anyTasks = computed(() => this.all().some(r => r.kind === 'task'));
  allCollapsed = computed(() => {
    const ids = this.all().filter(r => r.kind === 'stage' && r.hasTasks).map(r => r.stageId);
    return ids.length > 0 && ids.every(id => this.collapsed().has(id));
  });
  toggleAll() {
    const ids = this.all().filter(r => r.kind === 'stage' && r.hasTasks).map(r => r.stageId);
    this.collapsed.set(this.allCollapsed() ? new Set() : new Set(ids));
  }

  /** مدى المحور: أبكر تاريخ إلى أبعده (مع هامش)، ويشمل اليوم إن كان قريباً من المدى */
  private range = computed(() => {
    const days = this.all().flatMap(r => [r.start, r.end]).concat([toDay(this.projectStart()), toDay(this.projectEnd())]).filter((d): d is number => d != null);
    if (!days.length) return null;
    let min = Math.min(...days) - 3, max = Math.max(...days) + 3;
    const today = todayDay();
    if (today >= min - 30 && today <= max + 30) { min = Math.min(min, today - 3); max = Math.max(max, today + 3); }
    return { min, max, span: Math.max(14, max - min + 1) };
  });
  /** عرض اليوم: من التكبير المختار، أو يُحسب ليتسع المحور في عرض الورقة عند الطباعة */
  dayW = computed(() => {
    const fit = this.fit(), span = this.range()?.span ?? 14;
    return fit && this.printMode() ? Math.max(2, Math.min(14, Math.floor(fit / span))) : ZOOM_W[this.zoom()];
  });
  W = computed(() => (this.range()?.span ?? 14) * this.dayW());
  labelW = computed(() => (this.printMode() ? 190 : 250));

  /** يفصل الذيل اللاتيني الأخير («(Concept)» أو «BIM») عن بقية الاسم ليبقى كاملاً عند الاقتطاع */
  parts(label: string): { head: string; tail: string } {
    const m = /^(.*?)\s*(\([^()]*[A-Za-z][^()]*\)|[A-Za-z][A-Za-z0-9 .-]*)$/.exec(label);
    return m && m[1] ? { head: m[1], tail: m[2] } : { head: label, tail: '' };
  }

  /** الحافة اليمنى لخلية يوم (الزمن يجري يميناً ← يساراً) */
  private xr(day: number) { return this.W() - (day - this.range()!.min) * this.dayW(); }

  placed = computed<Placed[]>(() => {
    const r = this.range();
    if (!r) return [];
    const dw = this.dayW();
    let y = HEAD_H;
    return this.rows().map(row => {
      const h = ROW_H[row.kind];
      const out: Placed = { ...row, y, h, cy: y + h / 2, right: 0, w: 0, fillW: 0, pct: null };
      y += h;
      if (row.start == null) return out;
      if (row.kind === 'milestone') { out.right = this.xr(row.start) - dw / 2; return out; }
      const end = row.end ?? row.start;
      out.right = this.xr(row.start);
      out.w = Math.max(10, (Math.max(end, row.start) - row.start + 1) * dw);
      out.fillW = row.state === 'closed' ? out.w : (out.w * Math.max(0, Math.min(100, row.progress))) / 100;
      // نسبة الإنجاز داخل الشريط: على التعبئة إن اتسعت، وإلا في الجزء الفارغ، وإلا لا شيء
      const text = `${Math.round(row.state === 'closed' ? 100 : row.progress)}%`;
      if (row.state !== 'todo' && row.progress + (row.state === 'closed' ? 100 : 0) > 0) {
        if (out.fillW >= MIN_PERCENT_W) out.pct = { x: out.right - 6, text, onFill: true };
        else if (out.w - out.fillW >= MIN_PERCENT_W) out.pct = { x: out.right - out.fillW - 6, text, onFill: false };
      }
      return out;
    });
  });
  bodyH = computed(() => this.placed().reduce((s, p) => s + p.h, 0));
  bodyBottom = computed(() => HEAD_H + this.bodyH());
  totalH = computed(() => this.bodyBottom() + FOOT_H);
  barH = (r: Placed) => (r.kind === 'stage' ? 16 : 12);
  diamond = (cx: number, cy: number) => `${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`;

  hasToday = computed(() => this.todayX() != null);
  todayX = computed(() => {
    const r = this.range(), t = todayDay();
    return r && t >= r.min && t <= r.max ? this.xr(t) - this.dayW() / 2 : null;
  });

  months = computed<Month[]>(() => {
    const r = this.range();
    if (!r) return [];
    const dw = this.dayW();
    const out: Month[] = [];
    let d = r.min;
    while (d <= r.max) {
      const date = new Date(d * DAY);
      const next = Math.round(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY);
      const end = Math.min(next - 1, r.max);
      const first = out.length === 0 || date.getUTCMonth() === 0;
      out.push({ x: this.xr(end) - dw, w: (end - d + 1) * dw, text: monthName.format(date) + (first ? ' ' + date.getUTCFullYear() : '') });
      d = end + 1;
    }
    return out;
  });
  /** بدايات الأسابيع (الأحد) برقم اليوم من الشهر */
  weeks = computed<Tick[]>(() => {
    const r = this.range();
    if (!r) return [];
    const out: Tick[] = [];
    for (let d = r.min; d <= r.max; d++) if (new Date(d * DAY).getUTCDay() === 0) out.push({ x: this.xr(d), text: String(new Date(d * DAY).getUTCDate()) });
    return out;
  });
  fridays = computed(() => {
    const r = this.range();
    if (!r) return [];
    const out: number[] = [];
    for (let d = r.min; d <= r.max; d++) if (new Date(d * DAY).getUTCDay() === 5) out.push(this.xr(d) - this.dayW());
    return out;
  });
  undated = computed(() => this.all().filter(r => r.kind === 'stage' && (r.start == null || r.end == null)).map(r => r.label));

  dateText(r: Row) {
    if (r.start == null) return 'بلا تاريخ';
    if (r.kind === 'milestone' || r.end == null || r.end === r.start) return fmtDay(r.start);
    return `${fmtDay(r.start)} ← ${fmtDay(r.end)}`;
  }

  // ─────────── بطاقة التلميح ───────────
  showTip(row: Placed, ev: MouseEvent) { if (!this.printMode()) this.tip.set({ row, ...this.tipPos(ev.clientX, ev.clientY) }); }
  moveTip(ev: MouseEvent) { const t = this.tip(); if (t) this.tip.set({ ...t, ...this.tipPos(ev.clientX, ev.clientY) }); }
  /** عند التركيز بالمفتاح: بجوار الشريط */
  focusTip(row: Placed, ev: FocusEvent) {
    const b = (ev.target as SVGGraphicsElement).getBoundingClientRect();
    this.tip.set({ row, ...this.tipPos(b.left + b.width / 2, b.bottom) });
  }
  private tipPos(clientX: number, clientY: number) {
    const box = this.wrap()?.nativeElement.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    let x = clientX - box.left + 14, y = clientY - box.top + 16;
    if (x + TIP_W > box.width) x = Math.max(4, clientX - box.left - TIP_W - 14);
    if (y + 130 > box.height) y = Math.max(4, clientY - box.top - 130);
    return { x, y };
  }

  // ─────────── التكبير والتمرير إلى اليوم ───────────
  setZoom(z: Zoom) {
    this.zoom.set(z);
    requestAnimationFrame(() => this.scrollToToday(false));
  }

  constructor() {
    // عرض الجوال: يتبدّل مع عرض الشاشة، وأول مرة تُطوى المراحل لتبقى القائمة قصيرة
    const mq = window.matchMedia?.(COMPACT_QUERY);
    const apply = () => {
      this.compact.set(!!mq?.matches);
      if (mq?.matches && !this.compactInit) { this.compactInit = true; untracked(() => this.collapsed.set(new Set(this.all().filter(r => r.kind === 'stage' && r.hasTasks).map(r => r.stageId)))); }
    };
    mq?.addEventListener('change', apply);
    inject(DestroyRef).onDestroy(() => mq?.removeEventListener('change', apply));
    effect(() => { this.all(); untracked(apply); });

    effect(() => {
      const el = this.scroller()?.nativeElement;
      this.range();
      if (el && !this.scrolled && !this.printMode()) untracked(() => requestAnimationFrame(() => { this.scrollToToday(false); this.scrolled = true; }));
    });
  }

  /** يوسّط اليوم في الإطار (الحاوية RTL: الصفر عند اليمين والتمرير يسارياً سالب) */
  scrollToToday(smooth: boolean) {
    const el = this.scroller()?.nativeElement, x = this.todayX();
    if (!el) return;
    const fromRight = x == null ? 0 : this.W() - x;
    const max = Math.max(0, this.W() - el.clientWidth);
    const target = Math.min(max, Math.max(0, fromRight - el.clientWidth / 2));
    el.scrollTo?.({ left: -target, behavior: smooth ? 'smooth' : 'auto' });
  }
}
