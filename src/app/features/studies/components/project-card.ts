import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudyProject } from '../data-access/studies.models';
import { currentStage, daysLeft, daysLeftText, isProjectLate, stageStrip } from '../utils/project-card';
import { StudyStatusChip } from './study-status-chip';

const RING = 2 * Math.PI * 21;
const day = (v: string | null | undefined) => v ? v.slice(0, 10).replaceAll('-', '/') : '—';

/**
 * بطاقة مشروع دراسة في قائمة المشاريع: الكود والحالة (أو «متأخر»)، الاسم وأمر البدء، حلقة نسبة الإنجاز،
 * المدير والفترة المخططة والأيام الباقية، وشريط مراحل العمل ملوّناً بحالاتها مع المرحلة الحالية.
 * البطاقة كلها رابط لصفحة المشروع. من لا يرى المشروع كاملاً يرى مراحله المتاحة له فقط (يقولها سطر تحت الشريط).
 */
@Component({
  selector: 'app-study-project-card',
  imports: [RouterLink, StudyStatusChip],
  template: `
    @let p = project();
    <a class="card" [class.late]="late()" [routerLink]="['/studies/projects', p.id]" [attr.aria-label]="p.code + ' — ' + p.name">
      <div class="top">
        <span class="code mono">{{ p.code }}</span>
        @if (late()) { <span class="late-badge">متأخر</span> }
        @else { <app-study-status-chip kind="project" [status]="p.status" [name]="p.statusName" /> }
      </div>

      <div class="title">
        <strong>{{ p.name }}</strong>
        <small>أمر البدء {{ p.startOrderNumber }}@if (showBranch()) { · {{ p.branchName }} }</small>
      </div>

      <div class="body">
        <svg class="ring" viewBox="0 0 52 52" role="img" [attr.aria-label]="'نسبة الإنجاز ' + percent() + '%'">
          <circle class="ring-track" cx="26" cy="26" r="21" />
          <circle class="ring-fill" [class.done]="percent() >= 100" cx="26" cy="26" r="21"
                  [attr.stroke-dasharray]="dash()" transform="rotate(-90 26 26)" />
          <text x="26" y="30" text-anchor="middle">{{ percent() }}%</text>
        </svg>
        <dl class="facts">
          <div><dt>المدير</dt><dd>{{ p.managerName }}</dd></div>
          <div><dt>التخطيط</dt><dd class="nowrap">{{ fmt(p.plannedStartDate) }} ← {{ fmt(p.plannedEndDate) }}</dd></div>
          @if (remaining()) { <div><dt>المدة</dt><dd [class.warn]="late()">{{ remaining() }}</dd></div> }
        </dl>
      </div>

      @if (strip().length) {
        <div class="stages">
          <div class="strip" role="img" [attr.aria-label]="stripLabel()">
            @for (s of strip(); track s.id) { <i class="seg s-{{ s.state }}" [attr.title]="s.title"></i> }
          </div>
          <small class="now">
            @if (current(); as c) { المرحلة الحالية: <b [class.warn]="c.state === 'late'">{{ c.name }}</b> }
            @else { كل المراحل مغلقة }
            @if (!p.canViewFull) { <span class="partial"> · مراحلك فقط</span> }
          </small>
        </div>
      }
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .card {
      height: 100%; display: grid; grid-template-rows: auto auto 1fr auto; gap: 12px; padding: 16px;
      border-radius: var(--radius-xl); border: 1px solid var(--border); background: var(--surface);
      color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s, transform .15s;
    }
    .card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .card:focus-visible { outline: 2px solid var(--brand-600); outline-offset: 2px; }
    .card.late { border-color: color-mix(in srgb, var(--danger-500) 45%, var(--border)); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .code { font-size: 12px; color: var(--ink-500); }
    .late-badge { padding: 2px 10px; border-radius: var(--radius-full); background: var(--danger-100); color: var(--danger-700); font-size: 12px; font-weight: 700; }
    .title { display: grid; gap: 2px; min-width: 0; }
    .title strong { font-size: 15px; line-height: 1.6; color: var(--ink-900); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .title small { font-size: 12px; color: var(--ink-500); }
    .body { display: flex; align-items: center; gap: 14px; }
    .ring { flex: none; width: 56px; height: 56px; }
    .ring circle { fill: none; stroke-width: 5; }
    .ring-track { stroke: var(--fill-strong); }
    .ring-fill { stroke: var(--brand-500); stroke-linecap: round; transition: stroke-dasharray .3s; }
    .ring-fill.done { stroke: var(--brand-700); }
    .card.late .ring-fill { stroke: var(--danger-500); }
    .ring text { font-size: 12px; font-weight: 700; fill: var(--ink-800); }
    .facts { display: grid; gap: 3px; margin: 0; min-width: 0; font-size: 12.5px; }
    .facts div { display: flex; gap: 6px; min-width: 0; }
    .facts dt { color: var(--ink-500); flex: none; }
    .facts dd { margin: 0; color: var(--ink-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .warn { color: var(--danger-700); font-weight: 700; }
    .stages { display: grid; gap: 6px; }
    .strip { display: flex; gap: 3px; }
    .seg { flex: 1; height: 7px; border-radius: 3px; background: var(--fill-strong); }
    .s-closed { background: var(--brand-500); }
    .s-active { background: var(--info-500); }
    .s-late { background: var(--danger-500); }
    .now { font-size: 12px; color: var(--ink-500); line-height: 1.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .now b { color: var(--ink-800); font-weight: 700; }
    .partial { color: var(--ink-400); }
    @media (prefers-reduced-motion: reduce) { .card, .ring-fill { transition: none; } .card:hover { transform: none; } }
  `]
})
export class StudyProjectCard {
  project = input.required<StudyProject>();
  /** اسم الفرع لمن يتصفح المؤسسة */
  showBranch = input(false);

  fmt = day;
  percent = computed(() => Math.max(0, Math.min(100, Math.round(this.project().progress ?? 0))));
  dash = computed(() => `${(RING * this.percent()) / 100} ${RING}`);
  late = computed(() => isProjectLate(this.project()));
  remaining = computed(() => daysLeftText(daysLeft(this.project())));
  strip = computed(() => stageStrip(this.project().stages ?? []));
  current = computed(() => currentStage(this.strip()));
  stripLabel = computed(() => {
    const s = this.strip(), closed = s.filter(x => x.state === 'closed').length, late = s.filter(x => x.state === 'late').length;
    return `المراحل: ${closed} مغلقة من ${s.length}` + (late ? `، ${late} متأخرة` : '');
  });
}
