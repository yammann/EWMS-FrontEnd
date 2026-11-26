import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { MaintenanceDevice, MaintenanceRequest } from '../data-access/maintenance.models';
import { RequestFormDialog, RequestLookups } from './request-form-dialog';

const lookups: RequestLookups = {
  deviceTypes: [{ id: 1, name: 'طابعة' }], companies: [{ id: 2, name: 'HP' }],
  damageTypes: [{ id: 7, name: 'لا تعمل' }],
  statuses: [
    { id: 10, name: 'مستلم', color: '#888', stage: 1 }, { id: 11, name: 'قيد الإصلاح', color: '#08f', stage: 2 },
    { id: 14, name: 'مُسلَّم', color: '#0a0', stage: 4 }, { id: 15, name: 'غير قابل للصيانة', color: '#a00', stage: 5 }
  ]
};
const device: MaintenanceDevice = {
  id: 33, name: 'طابعة المكتب', serialNumber: 'SN-100', model: 'M1', description: '',
  deviceTypeId: 1, deviceTypeName: 'طابعة', deviceCompanyId: 2, deviceCompanyName: 'HP'
};

function setup(permissions: string[], request: Partial<MaintenanceRequest> | null = null) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
  TestBed.inject(AuthService).currentUser.set({
    email: 't@e.test', fullName: 'فني', role: 'x', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(), permissions
  });
  const fixture = TestBed.createComponent(RequestFormDialog);
  fixture.componentRef.setInput('lookups', lookups);
  if (request) fixture.componentRef.setInput('request', request);
  fixture.detectChanges();
  return { fixture, dialog: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
}

describe('RequestFormDialog (maintenance request)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('starts a new request in the first «new» status and never offers a final one', () => {
    const { dialog } = setup(['CreateMaintenanceRequest']);
    expect(dialog.form.controls.maintenanceRequestStatusId.value).toBe(10);
    expect(dialog.statusOptions().map(s => s.id)).toEqual([10, 11]);
    expect(dialog.form.controls.maintenanceRequestStatusId.enabled).toBe(true);
  });

  it('loads the assignees only when the user may assign on create', () => {
    const { http } = setup(['CreateMaintenanceRequest', 'AssignMaintenanceRequest']);
    http.expectOne('/api/MaintenanceRequests/Assignees').flush([{ id: 4, fullName: 'سامر' }]);
  });

  it('client search: one employee is picked, several are listed, none makes an external client', () => {
    const { dialog, http } = setup(['CreateMaintenanceRequest']);
    dialog.clientQuery.set('محمد الأحمد');
    dialog.findClient();
    http.expectOne(r => r.url.startsWith('/api/MaintenanceRequests/ClientLookup'))
      .flush([{ id: 8, fullName: 'محمد الأحمد', departmentName: 'العمليات', phone: '0933123456' }]);
    expect(dialog.client()?.id).toBe(8);
    expect(dialog.form.controls.clientName.value).toBe('محمد الأحمد');
    expect(dialog.form.controls.clientPhone.value).toBe('0933123456');
    expect(dialog.external()).toBe(false);

    dialog.changeClient();
    dialog.findClient();
    http.expectOne(r => r.url.startsWith('/api/MaintenanceRequests/ClientLookup'))
      .flush([{ id: 8, fullName: 'محمد الأحمد', departmentName: 'أ', phone: null }, { id: 9, fullName: 'محمد الأحمد', departmentName: 'ب', phone: null }]);
    expect(dialog.matches().length).toBe(2);
    expect(dialog.client()).toBeNull();

    dialog.clientQuery.set('زائر من خارج المؤسسة');
    dialog.findClient();
    http.expectOne(r => r.url.startsWith('/api/MaintenanceRequests/ClientLookup')).flush([]);
    expect(dialog.external()).toBe(true);
    expect(dialog.form.controls.clientName.value).toBe('زائر من خارج المؤسسة');
  });

  it('does not put a personal ID number into the client name when no employee matches', () => {
    const { dialog, http } = setup(['CreateMaintenanceRequest']);
    dialog.clientQuery.set('M201160');
    dialog.findClient();
    http.expectOne(r => r.url.startsWith('/api/MaintenanceRequests/ClientLookup')).flush([]);
    expect(dialog.external()).toBe(true);
    expect(dialog.form.controls.clientName.value).toBe('');
  });

  it('device search: found selects it, 404 offers to add it, other errors are shown', () => {
    const { dialog, http } = setup(['CreateMaintenanceRequest']);
    dialog.serialQuery.set('SN-100');
    dialog.findDevice();
    http.expectOne('/api/MaintenanceDevices/BySerial?serialNumber=SN-100').flush(device);
    expect(dialog.device()?.id).toBe(33);

    dialog.changeDevice();
    expect(dialog.serialQuery()).toBe('SN-100');
    dialog.serialQuery.set('SN-404');
    dialog.findDevice();
    http.expectOne('/api/MaintenanceDevices/BySerial?serialNumber=SN-404').flush({ message: 'غير موجود' }, { status: 404, statusText: 'Not Found' });
    expect(dialog.notFound()).toBe('SN-404');
    expect(dialog.lookupError()).toBe('');

    dialog.findDevice();
    http.expectOne('/api/MaintenanceDevices/BySerial?serialNumber=SN-404').flush({ message: 'تعذر البحث' }, { status: 500, statusText: 'Error' });
    expect(dialog.lookupError()).toBeTruthy();
  });

  it('saves a new request with the picked client, a normalised phone and the device id', async () => {
    const { dialog, http } = setup(['CreateMaintenanceRequest']);
    dialog.save();
    http.expectNone('/api/MaintenanceRequests/Create');            // بلا جهاز ولا عطل

    dialog.pickClient({ id: 8, fullName: 'محمد الأحمد', departmentName: 'العمليات', phone: null });
    dialog.device.set(device);
    dialog.form.patchValue({ clientPhone: '0933 123-456', damageTypeId: 7, accessories: ' شاحن ', description: ' لا تطبع ' });
    await dialog.save();
    const req = http.expectOne('/api/MaintenanceRequests/Create');
    expect(req.request.body).toEqual({
      clientUserId: 8, clientName: 'محمد الأحمد', clientPhone: '0933123456', deviceMaintenanceId: 33, damageTypeId: 7,
      assigneeId: null, accessories: 'شاحن', description: 'لا تطبع', maintenanceRequestStatusId: 10
    });
    req.flush({ id: 1 });
  });

  it('asks before moving an existing request to a final status, and stops when declined', async () => {
    const request = {
      id: 5, number: 'MR-26-005', clientUserId: null, clientName: 'زائر', clientPhone: '',
      deviceMaintenanceId: 33, deviceName: 'طابعة', serialNumber: 'SN-100', model: 'M1', deviceTypeId: 1, deviceTypeName: 'طابعة',
      deviceCompanyId: 2, deviceCompanyName: 'HP', damageTypeId: 7, maintenanceRequestStatusId: 11, accessories: '', description: '',
      canChangeStatus: true
    } as Partial<MaintenanceRequest>;
    const { dialog, http } = setup(['EditMaintenanceRequest', 'ChangeMaintenanceStatus'], request);
    expect(dialog.external()).toBe(true);
    expect(dialog.statusOptions().map(s => s.id)).toEqual([10, 11, 14, 15]);
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);
    dialog.form.controls.maintenanceRequestStatusId.setValue(14);
    await dialog.save();
    expect(ask).toHaveBeenCalledWith(expect.stringContaining('MR-26-005'), 'نعم، أقفل الطلب', 'حالة نهائية');
    http.expectNone('/api/MaintenanceRequests/Update/5');

    ask.mockResolvedValue(true);
    await dialog.save();
    const req = http.expectOne('/api/MaintenanceRequests/Update/5');
    expect(req.request.body).toMatchObject({ maintenanceRequestStatusId: 14, assigneeId: null, clientUserId: null, clientName: 'زائر' });
    req.flush({ id: 5 });
  });

  it('locks the status of an existing request for a user who cannot change statuses', () => {
    const { dialog } = setup(['EditMaintenanceRequest'], {
      id: 5, number: 'MR-26-005', clientUserId: 8, clientName: 'محمد', clientPhone: '', clientDepartmentName: 'أ',
      deviceMaintenanceId: 33, deviceName: 'ط', serialNumber: 'SN', model: '', deviceTypeId: 1, deviceTypeName: '', deviceCompanyId: 2,
      deviceCompanyName: '', damageTypeId: 7, maintenanceRequestStatusId: 11, accessories: '', description: '', canChangeStatus: true
    } as Partial<MaintenanceRequest>);
    expect(dialog.form.controls.maintenanceRequestStatusId.disabled).toBe(true);
    expect(dialog.client()?.id).toBe(8);
  });
});
