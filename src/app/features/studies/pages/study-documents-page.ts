import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, debounceTime, map } from 'rxjs';
import { AppPermission } from '@core/constants/access';
import { orEmpty } from '@core/http/or-empty';
import { Branch } from '@core/models/ewms.models';
import { PagedResult } from '@core/models/paged-result.model';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';
import { money } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { latestRequest } from '@shared/ui/track-request';
import { StudyRequestFormDialog } from '../components/request-form-dialog';
import { StudyStatusChip } from '../components/study-status-chip';
import { StudyAccess } from '../data-access/study-access';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import {
  DOCUMENT_STATUSES, StudyAssignment, StudyDocumentKind, StudyDocumentStatus, StudyRequest, StudyResponse, StudyStartOrder
} from '../data-access/studies.models';
import { DOCUMENT_KINDS, DOCUMENT_META, documentDate, documentNumber } from '../utils/document-meta';

const PAGE_SIZE = 20;

/** سطر موحّد للجداول الأربعة: رقم، تاريخ، عنوان وسطر ثانٍ، وأعمدة إضافية حسب النوع */
interface ListRow {
  id: number; number: string; date: string; title: string; subtitle: string;
  extra: string[]; status: StudyDocumentStatus; statusName: string; branchName: string;
}

const EXTRA_COLUMNS: Record<StudyDocumentKind, string[]> = {
  requests: ['المحافظة', 'نوع العمل', 'الاستعجال'],
  assignments: ['القسم المتابع', 'الأهمية', 'الحد الأقصى للرد'],
  responses: ['القسم المتابع', 'التوصية', 'التكلفة المبدئية'],
  startOrders: ['القسم المختص', 'مدير المشروع', 'البدء ← الحد الأقصى']
};

const day = (value: string | null | undefined) => value ? value.slice(0, 10).replaceAll('-', '/') : '—';

function toRows(kind: StudyDocumentKind, result: PagedResult<unknown>): ListRow[] {
  return result.items.map(item => {
    const base = item as StudyRequest;
    const row = { id: base.id, status: base.status, statusName: base.statusName, branchName: base.branchName };
    const number = documentNumber(kind, item as StudyRequest);
    const date = documentDate(kind, item as StudyRequest);
    switch (kind) {
      case 'requests': {
        const r = item as StudyRequest;
        return { ...row, number, date, title: r.mainBeneficiary, subtitle: r.subBeneficiary ?? '', extra: [r.governorateName, r.workTypeName, r.urgencyName] };
      }
      case 'assignments': {
        const a = item as StudyAssignment;
        return { ...row, number, date, title: a.mainBeneficiary, subtitle: 'الطلب ' + a.requestNumber, extra: [a.followingDepartmentName, a.priorityName, day(a.responseDeadline)] };
      }
      case 'responses': {
        const r = item as StudyResponse;
        return { ...row, number, date, title: r.projectCode ? 'كود ' + r.projectCode : 'إشعار الرد', subtitle: '', extra: [r.followingDepartmentName, r.recommendationName, money(r.totalCost)] };
      }
      case 'startOrders': {
        const o = item as StudyStartOrder;
        return { ...row, number, date, title: o.projectCode ? 'كود ' + o.projectCode : 'التكليف ' + o.assignmentNumber, subtitle: o.projectCode ? 'التكليف ' + o.assignmentNumber : '',
          extra: [o.competentDepartmentName, o.projectManagerName, `${day(o.studyStartDate)} ← ${day(o.studyDeadline)}`] };
      }
    }
  });
}

/**
 * مستندات الدراسة: تبويب لكل نوع يملك المستخدم عرضه (الطلبات، التكليفات، الردود، أوامر البدء)، بحث بالرقم أو الجهة
 * أو الكود، وفلتر بالحالة والفترة، وفرع لمن يتصفح المؤسسة. الإنشاء هنا للطلب فقط؛ بقية المستندات تُنشأ من صفحة
 * المستند المعتمد السابق («إصدار تكليف»، «كتابة الرد»…) كي تبقى السلسلة مربوطة.
 */
@Component({
  selector: 'app-study-documents-page',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeader, Alert, EmptyState, Pager, StudyStatusChip, StudyRequestFormDialog],
  templateUrl: './study-documents-page.html',
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss'],
  styles: [`
    .segmented { justify-self: start; flex-wrap: wrap; }
    .filters-row input[type=date] { width: auto; }
    .inline-field { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-600); }
    .dim { opacity: .55; transition: opacity .15s; }
    td small { display: block; color: var(--ink-500); font-size: 12px; }
  `]
})
export class StudyDocumentsPage {
  private service = inject(StudyDocumentsService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private latest = latestRequest();

  can = inject(StudyAccess).can;
  meta = DOCUMENT_META;
  statuses = DOCUMENT_STATUSES;
  pageSize = PAGE_SIZE;

  /** الأنواع التي يملك المستخدم عرضها */
  kinds = computed(() => DOCUMENT_KINDS.filter(k => this.auth.hasPermission(DOCUMENT_META[k].view)));
  kind = signal<StudyDocumentKind>('requests');
  columns = computed(() => EXTRA_COLUMNS[this.kind()]);
  orgWide = computed(() => this.auth.hasPermission(AppPermission.ViewOrganizationDashboard));

  status = signal<StudyDocumentStatus | 0>(0);
  search = signal('');
  from = signal('');
  to = signal('');
  branchId = signal(0);
  branches = signal<Branch[]>([]);
  hasFilter = computed(() => !!(this.status() || this.search().trim() || this.from() || this.to() || this.branchId()));

  rows = signal<ListRow[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');
  creating = signal(false);

  private search$ = new Subject<void>();

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => { this.page.set(1); this.load(); });
    if (this.orgWide()) {
      inject(LookupsService).branchOptions().pipe(orEmpty(() => undefined)).subscribe(b => this.branches.set(b));
    }
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const allowed = this.kinds();
      const wanted = p.get('type') as StudyDocumentKind | null;
      const next = wanted && allowed.includes(wanted) ? wanted : allowed[0];
      if (!next) return;
      if (next !== this.kind()) { this.kind.set(next); this.rows.set([]); this.total.set(0); }
      this.page.set(1);
      this.load();
    });
  }

  setKind(kind: StudyDocumentKind) {
    this.router.navigate([], { queryParams: { type: kind === this.kinds()[0] ? null : kind }, queryParamsHandling: 'merge' });
  }

  changed() { this.search$.next(); }

  clearFilters() {
    this.status.set(0); this.search.set(''); this.from.set(''); this.to.set(''); this.branchId.set(0);
    this.page.set(1); this.load();
  }

  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    const kind = this.kind();
    const filter = {
      status: this.status() || null, search: this.search().trim() || null, from: this.from() || null, to: this.to() || null,
      branchId: this.branchId() || null, page: this.page(), pageSize: PAGE_SIZE
    };
    const call = this.service.list(kind, filter) as Observable<PagedResult<unknown>>;
    this.latest(call.pipe(map(r => ({ rows: toRows(kind, r), total: r.totalCount }))), this.loading, this.error, r => {
      this.rows.set(r.rows); this.total.set(r.total);
    });
  }

  link(row: ListRow) { return `/studies/${DOCUMENT_META[this.kind()].segment}/${row.id}`; }

  created(request: StudyRequest) {
    this.creating.set(false);
    this.router.navigate(['/studies/requests', request.id]);
  }
}
