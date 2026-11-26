import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { AppPermission } from '@core/constants/access';
import { orEmpty } from '@core/http/or-empty';
import { Branch } from '@core/models/ewms.models';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { latestRequest } from '@shared/ui/track-request';
import { StudyProjectCard } from '../../components/project-card';
import { StudyProjectsService } from '../../data-access/study-projects.service';
import { StudyProject } from '../../data-access/studies.models';
import { SearchSelect, SelectOption } from '@shared/ui/search-select';

const PAGE_SIZE = 20;
const STATUSES = [{ value: 1, label: 'جارٍ' }, { value: 2, label: 'معلّق' }, { value: 3, label: 'مكتمل' }, { value: 4, label: 'ملغى' }];

/**
 * مشاريع الدراسات: بحث بالكود أو الاسم، وفلتر بالحالة والفرع (لنظرة المؤسسة)، والمشاريع بطاقات (قرار 2026-11-16):
 * نسبة الإنجاز، المتأخر، الأيام الباقية، وشريط مراحل العمل مع المرحلة الحالية (StudyProjectCard).
 * المشروع يُنشأ من صفحة أمر البدء المعتمد (زر «إنشاء مشروع») كي تبقى السلسلة مربوطة.
 */
@Component({
  selector: 'app-study-projects-page',
  imports: [SearchSelect, SelectOption, PageHeader, Alert, EmptyState, Pager, StudyProjectCard],
  templateUrl: './study-projects-page.html',
  styleUrls: ['../../../../shared/styles/page-base.scss', '../../../../shared/styles/data-tools.scss', '../../../../shared/styles/list-tools.scss'],
  styles: [`
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: 14px; }
    .dim { opacity: .55; transition: opacity .15s; }
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; font-size: 12px; color: var(--ink-500); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .k { width: 14px; height: 7px; border-radius: 3px; background: var(--fill-strong); }
    .k.s-closed { background: var(--brand-500); }
    .k.s-active { background: var(--info-500); }
    .k.s-late { background: var(--danger-500); }
  `]
})
export class StudyProjectsPage {
  private service = inject(StudyProjectsService);
  private latest = latestRequest();

  statuses = STATUSES;
  pageSize = PAGE_SIZE;
  orgWide = computed(() => inject(AuthService).hasPermission(AppPermission.ViewOrganizationDashboard));

  search = signal('');
  status = signal(0);
  branchId = signal(0);
  branches = signal<Branch[]>([]);
  hasFilter = computed(() => !!(this.search().trim() || this.status() || this.branchId()));

  rows = signal<StudyProject[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  private search$ = new Subject<void>();

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => { this.page.set(1); this.load(); });
    if (this.orgWide()) inject(LookupsService).branchOptions().pipe(orEmpty(() => undefined)).subscribe(b => this.branches.set(b));
    this.load();
  }

  changed() { this.search$.next(); }
  clear() { this.search.set(''); this.status.set(0); this.branchId.set(0); this.page.set(1); this.load(); }
  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    const filter = { status: this.status() || null, search: this.search().trim() || null, branchId: this.branchId() || null, page: this.page(), pageSize: PAGE_SIZE };
    this.latest(this.service.list(filter), this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.totalCount); });
  }
}
