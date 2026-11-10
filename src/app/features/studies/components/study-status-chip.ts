import { Component, computed, input } from '@angular/core';

/** نوع الحالة: مستند (1 مسودة … 5 ملغى)، قرار موقّع (1 بانتظار … 4 مرفوض)، مشروع (1 جارٍ … 4 ملغى)، أو مرحلة/مهمة (1 لم تبدأ، 2 جارية، 3 منجزة) */
type ChipKind = 'document' | 'decision' | 'project' | 'progress';

const DOCUMENT_TONES: Record<number, string> = { 1: 'draft', 2: 'pending', 3: 'approved', 4: 'rejected', 5: 'cancelled' };
const DECISION_TONES: Record<number, string> = { 1: 'pending', 2: 'approved', 3: 'noted', 4: 'rejected' };
const PROJECT_TONES: Record<number, string> = { 1: 'noted', 2: 'pending', 3: 'approved', 4: 'cancelled' };
const PROGRESS_TONES: Record<number, string> = { 1: 'draft', 2: 'noted', 3: 'approved' };
const TONES: Record<ChipKind, Record<number, string>> = { document: DOCUMENT_TONES, decision: DECISION_TONES, project: PROJECT_TONES, progress: PROGRESS_TONES };

/** شارة حالة مستند دراسة أو قرار توقيع: لون ونقطة ونص (الاسم العربي من الخادم) — لا تعتمد على اللون وحده */
@Component({
  selector: 'app-study-status-chip',
  standalone: true,
  template: `<span class="status-badge tone-{{ tone() }}"><span class="status-badge-dot" aria-hidden="true"></span>{{ name() }}</span>`,
  styles: [`
    :host { display: inline-flex; }
    .status-badge { white-space: nowrap; }
    .tone-draft { color: var(--ink-600); background: var(--fill); }
    .tone-draft .status-badge-dot { background: var(--ink-400); }
    .tone-pending { color: var(--warning-700); background: var(--warning-100); }
    .tone-pending .status-badge-dot { background: var(--warning-500); }
    .tone-approved { color: var(--brand-700); background: var(--brand-100); }
    .tone-approved .status-badge-dot { background: var(--brand-500); }
    .tone-noted { color: var(--info-700); background: var(--info-100); }
    .tone-noted .status-badge-dot { background: var(--info-500); }
    .tone-rejected { color: var(--danger-700); background: var(--danger-100); }
    .tone-rejected .status-badge-dot { background: var(--danger-500); }
    .tone-cancelled { color: var(--ink-500); background: var(--fill); text-decoration: line-through; }
    .tone-cancelled .status-badge-dot { background: var(--ink-300); }
  `]
})
export class StudyStatusChip {
  status = input.required<number>();
  name = input.required<string>();
  kind = input<ChipKind>('document');
  tone = computed(() => TONES[this.kind()][this.status()] ?? 'draft');
}
