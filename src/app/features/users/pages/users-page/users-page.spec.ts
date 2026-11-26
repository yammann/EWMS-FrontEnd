import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { UsersPage } from './users-page';

const user = (id: number, roleId: number, roleName: string) => ({
  id, fullName: 'موظف ' + id, email: `u${id}@e.test`, personalIdNumber: null, phoneNumber: null, roleId, roleName,
  branchId: 1, branchName: 'الفرع التقني', departmentId: 2, departmentName: 'العمليات', officeId: null, officeName: '', isActive: true, createdAt: '2026-10-01T00:00:00'
});

describe('المستخدمون — القوائم المساعدة لا تُخفي الموظفين', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    // رئيس فرع يملك عرض المستخدمين والأقسام والمكاتب، لا عرض الأدوار
    TestBed.inject(AuthService).currentUser.set({
      role: 'x', permissions: ['ViewUsers', 'EditUser', 'ViewDepartments', 'ViewOffices'], fullName: 't', email: 't@e.test',
      branchId: 1, departmentId: null, officeId: null, expiresAt: new Date(Date.now() + 60000).toISOString()
    });
  });
  afterEach(() => http.verify());

  it('shows the branch employees even when the roles list is refused, and says what is missing', async () => {
    const fixture = TestBed.createComponent(UsersPage);
    const page = fixture.componentInstance;
    await Promise.resolve();   // التحميل الأول في microtask

    http.expectOne('/api/Users/GetAll').flush([user(1, 5, 'رئيس الفرع التقني'), user(2, 6, 'موظف'), user(3, 6, 'موظف')]);
    http.expectOne('/api/Department/GetAll').flush([{ id: 2, name: 'العمليات', description: '', branchId: 1, branchName: 'الفرع التقني' }]);
    http.expectOne('/api/Offices/GetAll').flush([]);
    http.expectOne('/api/Roles/GetAll').flush({ message: 'ليس لديك صلاحية' }, { status: 403, statusText: 'Forbidden' });

    expect(page.users().length).toBe(3);
    expect(page.crud.loadError()).toBe('');
    expect(page.missing()).toEqual(['الأدوار']);
    expect(page.stats().roles).toBe(2);                   // الأدوار المختلفة بين الموظفين المعروضين

    // التعديل يُبقي دور الموظف الحالي خياراً ظاهراً
    page.crud.openEdit(page.users()[0]);
    expect(page.roleList()).toEqual([{ id: 5, name: 'رئيس الفرع التقني' }]);
  });

  it('renders the shared role and placement fields in each dialog, bound to that dialog\'s form', async () => {
    const auth = TestBed.inject(AuthService);
    auth.currentUser.update(u => u && { ...u, permissions: [...u.permissions, 'CreateUser'] });
    const fixture = TestBed.createComponent(UsersPage);
    const page = fixture.componentInstance;
    await Promise.resolve();
    http.expectOne('/api/Users/GetAll').flush([user(1, 5, 'رئيس الفرع التقني')]);
    http.expectOne('/api/Department/GetAll').flush([{ id: 2, name: 'العمليات', description: '', branchId: 1, branchName: 'الفرع التقني' }]);
    http.expectOne('/api/Offices/GetAll').flush([]);
    http.expectOne('/api/Roles/GetAll').flush([{ id: 5, name: 'رئيس الفرع التقني', permissions: [] }, { id: 6, name: 'موظف', permissions: [] }]);
    const root = fixture.nativeElement as HTMLElement;

    page.crud.openEdit(page.users()[0]);
    await fixture.whenStable();
    http.match(() => true).forEach(r => r.flush([]));
    await fixture.whenStable();
    expect(root.querySelector('#create-role')).toBeNull();
    expect(root.querySelector('#edit-role')?.textContent).toContain('رئيس الفرع التقني');
    expect(root.querySelector('label[for="edit-role"]')).not.toBeNull();
    // تغيير الدور في نافذة التعديل يغيّر نموذج التعديل وحده
    page.editForm.controls.roleId.setValue(6 as never);
    await fixture.whenStable();
    expect(root.querySelector('#edit-role')?.textContent).toContain('موظف');
    expect(page.createForm.controls.roleId.value).toBeFalsy();

    page.crud.close();
    page.crud.openCreate();
    await fixture.whenStable();
    expect(root.querySelector('#edit-role')).toBeNull();
    expect(root.querySelector('#create-role')?.textContent).toContain('اختر الدور');
  });

  it('shows the load error when the employees list itself fails', async () => {
    const page = TestBed.createComponent(UsersPage).componentInstance;
    await Promise.resolve();
    http.expectOne('/api/Users/GetAll').flush({ message: 'ليس لديك صلاحية' }, { status: 403, statusText: 'Forbidden' });
    http.match(() => true).forEach(r => r.flush([]));
    expect(page.crud.loadError()).toBe('ليس لديك صلاحية');
  });
});
