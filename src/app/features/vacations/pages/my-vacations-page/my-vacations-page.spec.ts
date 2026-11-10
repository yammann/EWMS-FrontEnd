import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { notificationRoute } from '@core/services/notification.service';
import { localDateInput } from '@core/utils/format';
import { MyVacationsPage } from './my-vacations-page';

const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return localDateInput(d) + 'T00:00:00'; };

describe('«إجازاتي»', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).currentUser.set({
      role: 'x', permissions: ['ViewVacations', 'CreateVacation'], fullName: 't', email: 't@e.test',
      branchId: 1, departmentId: 2, officeId: null, expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  });
  afterEach(() => http.verify());

  it('counts this month paid days, this year approved days, pending requests and the next vacation', () => {
    const page = TestBed.createComponent(MyVacationsPage).componentInstance;
    const month = localDateInput().slice(0, 7);
    const vacation = (id: number, status: string, start: string, end: string, segments: { startDate: string; isPaid: boolean; days: number }[] = []) =>
      ({ id, status, startVac: start, endVac: end, vacationTypeName: 'إدارية', vacDayCount: 2, segments: segments.map(s => ({ ...s, endDate: s.startDate })) });
    http.expectOne('/api/Vacations/My').flush([
      vacation(1, 'Approved', `${month}-01T00:00:00`, `${month}-02T00:00:00`, [{ startDate: `${month}-01T00:00:00`, isPaid: true, days: 1 }, { startDate: `${month}-02T00:00:00`, isPaid: false, days: 1 }]),
      vacation(2, 'PendingManager', shift(10), shift(11)),
      vacation(3, 'Approved', shift(5), shift(6), [{ startDate: shift(5), isPaid: true, days: 2 }]),
      vacation(4, 'Cancelled', shift(3), shift(3))
    ]);
    // الشهر الحالي: يوم مدفوع من الإجازة 1، وقد تقع الإجازة 3 في الشهر نفسه أيضاً
    const sameMonth = shift(5).slice(0, 7) === month;
    expect(page.paidThisMonth()).toBe(1 + (sameMonth ? 2 : 0));
    expect(page.pending()).toBe(1);
    expect(page.next()?.id).toBe(3);                     // الملغاة لا تُعدّ، والأقرب أولاً
    expect(page.yearDays()).toBeGreaterThanOrEqual(2);
  });

  it('opens the employee vacation notices on «إجازاتي» and review notices on the review page', () => {
    const n = (type: string) => ({ id: 1, type, relatedEntityType: 'Vacation', relatedEntityId: 5 }) as never;
    expect(notificationRoute(n('VacationApproved'), true)).toBe('/vacations/my');
    expect(notificationRoute(n('VacationSubmitted'), true)).toBe('/vacations/review');
    expect(notificationRoute(n('VacationSubmitted'), false)).toBe('/vacations/my');
  });
});
