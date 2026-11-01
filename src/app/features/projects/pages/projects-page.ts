import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Department } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { SelectValue } from '@shared/ui/select-value';
import { ToastService } from '@shared/ui/toast.service';
import { latestRequest, trackRequest } from '@shared/ui/track-request';
import { UtcPipe } from '@shared/pipes/format.pipes';
import { ProjectFormDialog } from '../components/project-form-dialog';
import { PROJECT_STAGES, Project, ProjectFilter, ProjectInput } from '../data-access/projects.models';
import { ProjectsService } from '../data-access/projects.service';

const PAGE_SIZE = 20;

/**
 * قائمة المشاريع بحدّ رؤية المستخدم (مشاريعي ← قسمي ← فرعي ← المؤسسة): بحث وفلاتر وترقيم من الخادم.
 * الصف يفتح صفحة المشروع (إضبارته). `?siteId=` (من الخريطة) يقيّد القائمة بمشاريع موقع واحد مع شريط يمسح التقييد.
 */
@Component({
  selector: 'app-projects-page', standalone: true,
  imports: [DatePipe, PageHeader, Alert, EmptyState, Pager, SelectValue, UtcPipe, ProjectFormDialog],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', './projects-page.scss'],
  templateUrl: './projects-page.html'
})
export class ProjectsPage {
  private service = inject(ProjectsService);
  private lookups = inject(LookupsService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private latest = latestRequest();

  access = this.service.access;
  stages = PROJECT_STAGES;

  items = signal<Project[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  departments = signal<Department[]>([]);

  filter = signal<ProjectFilter>({ search: '', branchId: null, departmentId: null, siteId: null, stage: null, page: 1, pageSize: PAGE_SIZE });
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** اسم الموقع المقيَّد به (يأتي مع الرابط من الخريطة) */
  siteName = signal('');

  dialog = signal(false);
  saving = signal(false);
  formError = signal('');

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const siteId = Number(params.get('siteId'));
    if (siteId > 0) { this.filter.update(f => ({ ...f, siteId })); this.siteName.set(params.get('site') ?? ''); }
    this.load();
    if (this.access().canListDepartments) {
      this.lookups.departments().subscribe({ next: list => this.departments.set(list), error: () => this.departments.set([]) });
    }
  }

  load() {
    this.latest(this.service.search(this.filter()), this.loading, this.error, page => { this.items.set(page.items); this.total.set(page.totalCount); });
  }

  setFilter(patch: Partial<ProjectFilter>) {
    this.filter.update(f => ({ ...f, ...patch, page: 'page' in patch ? patch.page! : 1 }));
    this.load();
  }

  /** بحث بالنص بعد توقف الكتابة (لا طلب لكل حرف) */
  typing(value: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.setFilter({ search: value }), 300);
  }

  hasFilters() { const f = this.filter(); return !!(f.search || f.departmentId || f.stage || f.siteId); }
  clearFilters() { this.clearSite(false); this.setFilter({ search: '', departmentId: null, stage: null, siteId: null }); }

  /** رفع التقييد بموقع (من الشريط أو مسح الفلاتر) ويُنظَّف الرابط */
  clearSite(reload = true) {
    this.siteName.set('');
    void this.router.navigate([], { queryParams: { siteId: null, site: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (reload) this.setFilter({ siteId: null });
  }

  open(p: Project) { void this.router.navigate(['/projects', p.id]); }

  openCreate() { this.formError.set(''); this.dialog.set(true); }

  create(body: ProjectInput) {
    trackRequest(this.service.create(body), this.saving, this.formError, p => {
      this.dialog.set(false);
      this.toast.success('أُنشئ المشروع');
      this.open(p);
    });
  }

  stageClass(stage: number) {
    return stage === 6 || stage === 7 ? 'pill muted' : stage === 3 ? 'pill pill-active' : 'pill';
  }
}
