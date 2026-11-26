import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { latestRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../../data-access/study-documents.service';
import { DIWAN_STAGES, StudyDiwanStage, StudyResponse } from '../../data-access/studies.models';
import { SearchSelect, SelectOption } from '@shared/ui/search-select';

const PAGE_SIZE = 20;
/** بعدها يُلوَّن الانتظار تحذيراً ثم خطراً (بالأيام) */
const WARN_DAYS = 7;
const LATE_DAYS = 21;

type DiwanAction = 'dispatch' | 'reply' | 'confirm';

const ACTION_LABELS: Record<DiwanAction, string> = {
  dispatch: 'تسجيل الصادر',
  reply: 'تسجيل الرد',
  confirm: 'إجراء رئيس الفرع'
};

/** أيام كاملة منذ تاريخ معيّن حتى اليوم (بالتاريخ المحلي) */
export function daysSince(value: string, today = new Date()): number {
  const start = new Date(value);
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * معاملات الديوان: قائمة عمل ديوان فرع الدراسات. تعرض افتراضياً المعاملات التي تنتظر إجراءً، الأطول انتظاراً أولاً،
 * مع رقم الصادر ومدة الانتظار وزر الإجراء التالي (يفتح الرد ونافذة الإجراء مباشرةً).
 */
@Component({
  selector: 'app-study-diwan-page',
  imports: [SearchSelect, SelectOption, DatePipe, RouterLink, PageHeader, Alert, EmptyState, Pager],
  templateUrl: './study-diwan-page.html',
  styleUrls: ['../../../../shared/styles/page-base.scss', '../../../../shared/styles/data-tools.scss', '../../../../shared/styles/list-tools.scss'],
  styles: [`
    .segmented { justify-self: start; }
    .dim { opacity: .55; transition: opacity .15s; }
    td small { display: block; color: var(--ink-500); font-size: 12px; }
    .wait { font-weight: 700; white-space: nowrap; }
    .wait.warn { color: var(--warning-700); }
    .wait.late { color: var(--danger-600); }
    .row-action { white-space: nowrap; }
  `]
})
export class StudyDiwanPage {
  private service = inject(StudyDocumentsService);
  private latest = latestRequest();

  pageSize = PAGE_SIZE;
  labels = ACTION_LABELS;
  /** true = المفتوحة فقط (الافتراضي) */
  openOnly = signal(true);
  stage = signal<StudyDiwanStage | 0>(0);
  search = signal('');
  stages = Object.entries(DIWAN_STAGES).map(([value, label]) => ({ value: Number(value) as StudyDiwanStage, label }));

  rows = signal<StudyResponse[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  private search$ = new Subject<void>();

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }

  setOpenOnly(value: boolean) {
    if (value === this.openOnly()) return;
    this.openOnly.set(value);
    this.stage.set(0);
    this.page.set(1);
    this.load();
  }

  changed() { this.search$.next(); }
  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    const open = this.openOnly();
    const call = this.service.list('responses', {
      diwanOnly: true, diwanOpen: open || undefined, diwanStage: open ? null : this.stage() || null,
      search: this.search().trim() || null, page: this.page(), pageSize: PAGE_SIZE
    });
    this.latest(call, this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.totalCount); });
  }

  stageName(r: StudyResponse) { return r.diwanStage ? DIWAN_STAGES[r.diwanStage] : '—'; }

  waitDays(r: StudyResponse): number | null { return r.diwanSince ? daysSince(r.diwanSince) : null; }

  waitClass(days: number) { return days >= LATE_DAYS ? 'late' : days >= WARN_DAYS ? 'warn' : ''; }

  /** الإجراء التالي المتاح للمستخدم على هذه المعاملة */
  action(r: StudyResponse): DiwanAction | null {
    return r.canRegisterDiwanDispatch ? 'dispatch' : r.canRegisterDiwanReply ? 'reply' : r.canReviewDiwan ? 'confirm' : null;
  }
}
