import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { NotificationService, RELOAD_QUIET_MS } from '@core/services/notification.service';
import { AppNotification } from '@core/models/notification.models';
import { DashboardService } from './data-access/dashboard.service';
import { DashboardCountItem, DashboardVacationRow } from './data-access/dashboard.models';
import { ActionsTable, CountBars, VacationRows } from './components/dashboard-widgets';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { BranchDashboardPage } from './pages/branch-dashboard/branch-dashboard';
import { DepartmentDashboardPage } from './pages/department-dashboard/department-dashboard';
import { OfficeDashboardPage } from './pages/office-dashboard/office-dashboard';
import { OverviewDashboardPage } from './pages/overview-dashboard/overview-dashboard';
import { EmployeeDashboardPage } from './pages/employee-dashboard/employee-dashboard';

const providers = [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting(), provideRouter([])];
const signIn = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
  email: 't@e.test', fullName: 'م', role: 'x', branchId: 1, departmentId: 2, officeId: 3,
  expiresAt: new Date(Date.now() + 60_000).toISOString(), permissions
});

describe('Dashboard API contract', () => {
  it('reads each dashboard from its route, with or without a unit id', () => {
    TestBed.configureTestingModule({ providers });
    const service = TestBed.inject(DashboardService);
    const http = TestBed.inject(HttpTestingController);
    const calls: [() => unknown, string][] = [
      [() => service.overview(), '/api/Dashboard/Overview'],
      [() => service.branch(null), '/api/Dashboard/Branch'],
      [() => service.branch(4), '/api/Dashboard/Branch/4'],
      [() => service.department(null), '/api/Dashboard/Department'],
      [() => service.department(9), '/api/Dashboard/Department/9'],
      [() => service.office(null), '/api/Dashboard/Office'],
      [() => service.office(12), '/api/Dashboard/Office/12'],
      [() => service.me(), '/api/Dashboard/Me'],
      [() => service.vacations(null), '/api/Dashboard/Vacations'],
      [() => service.vacations(4), '/api/Dashboard/Vacations?branchId=4']
    ];
    for (const [call, url] of calls) {
      (call() as { subscribe(): void }).subscribe();
      const req = http.expectOne(url);
      expect(req.request.method, url).toBe('GET');
      req.flush({});
    }
    http.verify();
  });
});

describe('DashboardHome', () => {
  const kindFor = (permissions: string[] | null) => {
    TestBed.configureTestingModule({ providers });
    if (permissions) signIn(permissions);
    return TestBed.createComponent(DashboardHome);
  };

  it('shows the widest dashboard the permissions allow', () => {
    const cases: [string[], string][] = [
      [['ViewMyDashboard', 'ViewOfficeDashboard', 'ViewDepartmentDashboard', 'ViewBranchDashboard', 'ViewOrganizationDashboard'], 'overview'],
      [['ViewMyDashboard', 'ViewDepartmentDashboard', 'ViewBranchDashboard'], 'branch'],
      [['ViewOfficeDashboard', 'ViewDepartmentDashboard'], 'department'],
      [['ViewMyDashboard', 'ViewOfficeDashboard'], 'office'],
      [['ViewMyDashboard'], 'employee']
    ];
    for (const [permissions, kind] of cases) {
      TestBed.resetTestingModule();
      expect(kindFor(permissions).componentInstance.kind(), kind).toBe(kind);
    }
  });

  it('sends a user without any dashboard to their profile', async () => {
    const fixture = kindFor(['ViewVacations']);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    expect(fixture.componentInstance.kind()).toBe('none');
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/profile');
  });
});

describe('unit dashboards (branch / department / office)', () => {
  type UnitPage = { showMap(): boolean };
  const pages: { name: string; page: Type<UnitPage>; url: string }[] = [
    { name: 'branch', page: BranchDashboardPage, url: '/api/Dashboard/Branch' },
    { name: 'department', page: DepartmentDashboardPage, url: '/api/Dashboard/Department' },
    { name: 'office', page: OfficeDashboardPage, url: '/api/Dashboard/Office' }
  ];

  const open = (page: Type<UnitPage>, id: string | null, permissions: string[]) => {
    const params = new BehaviorSubject(convertToParamMap(id ? { id } : {}));
    TestBed.configureTestingModule({ providers: [...providers, { provide: ActivatedRoute, useValue: { paramMap: params } }] });
    signIn(permissions);
    const instance = TestBed.createComponent(page).componentInstance;
    return { instance, params, http: TestBed.inject(HttpTestingController) };
  };

  for (const p of pages) {
    it(`${p.name}: my own unit by default (with its map), another unit from the link (without it)`, () => {
      const { instance, params, http } = open(p.page, null, ['ViewBranchMap']);
      http.expectOne(p.url).flush(null);
      expect(instance.showMap()).toBe(true);

      params.next(convertToParamMap({ id: '17' }));
      http.expectOne(`${p.url}/17`).flush(null);
      expect(instance.showMap()).toBe(false);
      http.verify();
    });

    it(`${p.name}: a burst of notifications reloads once, after it settles`, () => {
      vi.useFakeTimers();
      try {
        const { http } = open(p.page, null, []);
        http.expectOne(p.url).flush(null);
        const notifications = TestBed.inject(NotificationService);
        for (let i = 1; i <= 4; i++) notifications.incoming$.next({ id: i } as AppNotification);
        http.expectNone(p.url);
        vi.advanceTimersByTime(RELOAD_QUIET_MS);
        http.expectOne(p.url).flush(null);
        http.verify();
      } finally { vi.useRealTimers(); }
    });
  }
});

describe('organization and personal dashboards', () => {
  const pages = [
    { name: 'overview', page: OverviewDashboardPage, url: '/api/Dashboard/Overview' },
    { name: 'employee', page: EmployeeDashboardPage, url: '/api/Dashboard/Me' }
  ];
  for (const p of pages) {
    it(`${p.name}: loads on open and once after a burst of notifications`, () => {
      vi.useFakeTimers();
      try {
        TestBed.configureTestingModule({ providers });
        signIn([]);
        TestBed.createComponent(p.page as Type<unknown>);
        const http = TestBed.inject(HttpTestingController);
        http.expectOne(p.url).flush(null);
        const notifications = TestBed.inject(NotificationService);
        notifications.incoming$.next({ id: 1 } as AppNotification);
        vi.advanceTimersByTime(RELOAD_QUIET_MS / 2);
        notifications.incoming$.next({ id: 2 } as AppNotification);
        vi.advanceTimersByTime(RELOAD_QUIET_MS / 2);
        http.expectNone(p.url);                                // ما زالت تصل
        vi.advanceTimersByTime(RELOAD_QUIET_MS / 2);
        http.expectOne(p.url).flush(null);
        http.verify();
      } finally { vi.useRealTimers(); }
    });
  }
});

describe('dashboard widgets', () => {
  it('CountBars scales bars to the largest value and labels counts or days', async () => {
    TestBed.configureTestingModule({});
    const f = TestBed.createComponent(CountBars);
    const items: DashboardCountItem[] = [{ label: 'سنوية', count: 3, days: 20 }, { label: 'مرضية', count: 6, days: 5 }];
    f.componentRef.setInput('items', items);
    f.componentRef.setInput('unit', 'موظف');
    await f.whenStable();
    const bars = f.componentInstance;
    expect(bars.percent(items[1])).toBe(100);
    expect(bars.percent(items[0])).toBe(50);
    expect(bars.valueText(items[0])).toBe('3 موظف');

    f.componentRef.setInput('mode', 'days');
    await f.whenStable();
    expect(bars.percent(items[0])).toBe(100);
    expect(bars.valueText(items[1])).toBe('5 يوم');
    expect((f.nativeElement as HTMLElement).querySelectorAll('.bar-row')).toHaveLength(2);

    f.componentRef.setInput('items', [{ label: 'لا شيء', count: 0, days: 0 }]);
    f.componentRef.setInput('mode', 'count');
    await f.whenStable();
    expect(bars.percent({ label: 'لا شيء', count: 0, days: 0 })).toBe(0);   // لا قسمة على صفر
  });

  it('VacationRows marks an approved vacation that covers today as «now»', () => {
    TestBed.configureTestingModule({});
    const rows = TestBed.createComponent(VacationRows).componentInstance;
    const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
    const row = (status: string, start: number, end: number) => ({ status, startVac: day(start), endVac: day(end) }) as DashboardVacationRow;
    expect(rows.isNow(row('Approved', -1, 1))).toBe(true);
    expect(rows.isNow(row('Approved', 2, 4))).toBe(false);
    expect(rows.isNow(row('PendingManager', -1, 1))).toBe(false);
  });

  it('ActionsTable colours each vacation action by its type', () => {
    TestBed.configureTestingModule({});
    const table = TestBed.createComponent(ActionsTable).componentInstance;
    expect(['Approved', 'Forwarded', 'Rejected', 'Cancelled', 'Submitted', 'Unknown'].map(t => table.badgeClass(t)))
      .toEqual(['status-active', 'status-completed', 'status-rejected', 'status-draft', 'status-pending', 'status-pending']);
  });
});
