import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { RegisterDialog, RegisterMode, RegisterPayload } from '../components/register-dialog';
import { CorrespondenceFilter, CorrespondenceItem, CorrespondenceStatus, CorrespondenceType, STAGES } from '../data-access/diwan.models';
import { DiwanService } from '../data-access/diwan.service';

const PAGE_SIZE = 20;
type View = 'inbox' | 'incoming' | 'outgoing' | 'all';

/**
 * ديوان الفرع: «صندوقي» (ما تحمله وحدتي الآن)، والوارد، والصادر، والكل — بحدّ رؤية المستخدم (معاملاتي ← قسمي ← فرعي ← المؤسسة).
 * بحث وفلاتر وترقيم من الخادم. الصف يفتح المعاملة. التسجيل والمسودة لمن يملك صلاحيتهما.
 */
@Component({
  selector: 'app-diwan-page', standalone: true,
  imports: [DatePipe, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe, RegisterDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './diwan-page.scss'],
  templateUrl: './diwan-page.html'
})
export class DiwanPage {
  private service = inject(DiwanService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private latest = latestRequest();

  access = this.service.access;
  stages = STAGES;

  items = signal<CorrespondenceItem[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  types = signal<CorrespondenceType[]>([]);
  statuses = signal<CorrespondenceStatus[]>([]);

  /** «صندوقي» الافتراضي لمن يعالج المعاملات، وإلا الكل */
  view = signal<View>(this.service.access().canHandle ? 'inbox' : 'all');
  filter = signal<CorrespondenceFilter>({
    direction: null, typeId: null, statusId: null, stage: null, projectId: null, search: '', from: '', to: '', overdueOnly: false, inbox: false, page: 1, pageSize: PAGE_SIZE
  });
  private searchTimer?: ReturnType<typeof setTimeout>;

  views = computed<{ key: View; label: string }[]>(() => [
    ...(this.access().canHandle ? [{ key: 'inbox' as const, label: 'صندوقي' }] : []),
    { key: 'all', label: 'الكل' }, { key: 'incoming', label: 'الوارد' }, { key: 'outgoing', label: 'الصادر' }
  ]);

  dialog = signal<RegisterMode | null>(null);
  saving = signal(false);
  formError = signal('');

  constructor() {
    this.load();
    this.service.types(null, false).subscribe({ next: t => this.types.set(t), error: () => this.types.set([]) });
    this.service.statuses(null, false).subscribe({ next: s => this.statuses.set(s), error: () => this.statuses.set([]) });
  }

  private request(): CorrespondenceFilter {
    const f = this.filter();
    const v = this.view();
    return { ...f, inbox: v === 'inbox', direction: v === 'incoming' ? 1 : v === 'outgoing' ? 2 : f.direction };
  }

  load() {
    this.latest(this.service.search(this.request()), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setView(view: View) { this.view.set(view); this.filter.update(f => ({ ...f, page: 1 })); this.load(); }

  setFilter(patch: Partial<CorrespondenceFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  /** بحث بالنص بعد توقف الكتابة (لا طلب لكل حرف) */
  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  hasFilters() { const f = this.filter(); return !!(f.search || f.typeId || f.statusId || f.stage || f.from || f.to || f.overdueOnly); }
  clearFilters() { this.setFilter({ search: '', typeId: null, statusId: null, stage: null, from: '', to: '', overdueOnly: false }); }

  open(c: CorrespondenceItem) { void this.router.navigate(['/diwan', c.id]); }

  openDialog(mode: RegisterMode) { this.formError.set(''); this.dialog.set(mode); }

  create(body: RegisterPayload) {
    const mode = this.dialog();
    const request = mode === 'draft'
      ? this.service.createDraft({ ...body, replyToId: null })
      : this.service.registerIncoming(body);
    trackRequest(request, this.saving, this.formError, c => {
      this.dialog.set(null);
      this.toast.success(mode === 'draft' ? 'حُفظت المسودة' : `سُجّلت المعاملة ${c.number ?? ''}`);
      this.open(c);
    });
  }

  emptyText() {
    if (this.hasFilters()) return 'لا توجد معاملات مطابقة';
    return this.view() === 'inbox' ? 'صندوقك فارغ — لا معاملات تحملها وحدتك الآن' : 'لا توجد معاملات ضمن صلاحياتك بعد';
  }

  stateLabel(c: CorrespondenceItem) { return c.direction === 1 ? c.statusName ?? '—' : c.outgoingStateAr ?? '—'; }
  stateClass(c: CorrespondenceItem) { return c.isClosed ? 'pill muted' : c.isOverdue ? 'pill pill-late' : 'pill'; }
}
