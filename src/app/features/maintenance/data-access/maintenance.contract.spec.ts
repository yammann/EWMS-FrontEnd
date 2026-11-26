import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { AuthService } from '@core/services/auth.service';
import { MaintenanceService } from './maintenance.service';

/**
 * عقد الصيانة مع الباكاند: المسارات والطرق كما في MaintenanceRequests/MaintenanceDevices/MaintenanceTasks/SpareParts
 * Controllers (طوبقت معها 2026-11-25). فلاتر هذه الصفحات: الصفر يعني «الكل» فيُسقط مع الفارغ.
 */
describe('Maintenance API contract', () => {
  let http: HttpTestingController;
  let service: MaintenanceService;
  const page = { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MaintenanceService);
  });
  afterEach(() => http.verify());

  const expect1 = (method: string, url: string) => {
    const req = http.expectOne(url);
    expect(req.request.method, url).toBe(method);
    return req;
  };

  it('drops zero, null and empty filter values (0 = «all») and keeps real ones', () => {
    service.requests({ serialNumber: 'SN-7', clientName: '', deviceCompanyId: 0, technicianId: null, deviceTypeId: 3, page: 2, pageSize: 20 }).subscribe();
    expect1('GET', '/api/MaintenanceRequests/GetAll?serialNumber=SN-7&deviceTypeId=3&page=2&pageSize=20').flush(page);

    service.requests({}).subscribe();
    expect1('GET', '/api/MaintenanceRequests/GetAll').flush(page);

    service.parts({ search: 'فلتر زيت', departmentId: 0, lowStock: true, page: 1, pageSize: 50 }).subscribe();
    expect1('GET', '/api/SpareParts/GetAll?search=%D9%81%D9%84%D8%AA%D8%B1+%D8%B2%D9%8A%D8%AA&lowStock=true&page=1&pageSize=50').flush(page);

    service.devices({ serialNumber: '', model: 'X1', deviceTypeId: 0 }).subscribe();
    expect1('GET', '/api/MaintenanceDevices/GetAll?model=X1').flush(page);

    service.tasks({ userId: 0, page: 1 }).subscribe();
    expect1('GET', '/api/MaintenanceTasks/GetAll?page=1').flush(page);

    service.assignees(null).subscribe();
    expect1('GET', '/api/MaintenanceRequests/Assignees').flush([]);
    service.assignees(4).subscribe();
    expect1('GET', '/api/MaintenanceRequests/Assignees?departmentId=4').flush([]);
  });

  it('maps the request lifecycle to its routes and bodies', () => {
    const body = { deviceMaintenanceId: 9 } as never;
    service.request(5).subscribe(); expect1('GET', '/api/MaintenanceRequests/Get/5').flush({});
    service.createRequest(body).subscribe();
    expect(expect1('POST', '/api/MaintenanceRequests/Create').request.body).toBe(body);
    service.updateRequest(5, body).subscribe(); expect1('PUT', '/api/MaintenanceRequests/Update/5').flush({});
    service.deleteRequest(5).subscribe(); expect1('DELETE', '/api/MaintenanceRequests/Delete/5').flush({});

    service.changeStatus(5, 3).subscribe();
    expect(expect1('PUT', '/api/MaintenanceRequests/Status/5').request.body).toEqual({ statusId: 3 });
    service.assignRequest(5, 12).subscribe();
    expect(expect1('PUT', '/api/MaintenanceRequests/Assign/5').request.body).toEqual({ userId: 12 });

    service.activities(5).subscribe(); expect1('GET', '/api/MaintenanceRequests/Activities/5').flush([]);
    service.printData(5).subscribe(); expect1('GET', '/api/MaintenanceRequests/Print/5').flush({});
    service.technicians().subscribe(); expect1('GET', '/api/MaintenanceRequests/Technicians').flush([]);
    service.stats().subscribe(); expect1('GET', '/api/MaintenanceRequests/Stats').flush({});
    service.myRequests().subscribe(); expect1('GET', '/api/MaintenanceRequests/Mine').flush([]);

    service.clientLookup('محمد الأحمد').subscribe();
    expect1('GET', '/api/MaintenanceRequests/ClientLookup?query=%D9%85%D8%AD%D9%85%D8%AF+%D8%A7%D9%84%D8%A3%D8%AD%D9%85%D8%AF').flush([]);
  });

  it('sends transfer requests and decisions with their bodies', () => {
    service.requestTransfer(5, { reason: 'خارج الاختصاص', suggestedUserId: null }).subscribe();
    expect(expect1('POST', '/api/MaintenanceRequests/TransferRequest/5').request.body).toEqual({ reason: 'خارج الاختصاص', suggestedUserId: null });
    service.decideTransfer(8, { approve: true, userId: 3, note: null }).subscribe();
    expect(expect1('PUT', '/api/MaintenanceRequests/Transfer/8/Decide').request.body).toEqual({ approve: true, userId: 3, note: null });
    service.pendingTransfer(5).subscribe(); expect1('GET', '/api/MaintenanceRequests/Transfer/5').flush(null);
    service.pendingTransfers().subscribe(); expect1('GET', '/api/MaintenanceRequests/Transfers/Pending').flush([]);
    service.transferColleagues().subscribe(); expect1('GET', '/api/MaintenanceRequests/Transfers/Colleagues').flush([]);
  });

  it('finds a device by exact serial number and manages devices and tasks', () => {
    service.deviceBySerial('AB 12/3').subscribe();
    expect1('GET', '/api/MaintenanceDevices/BySerial?serialNumber=AB+12%2F3').flush({});
    service.device(2).subscribe(); expect1('GET', '/api/MaintenanceDevices/Get/2').flush({});
    service.createDevice({} as never).subscribe(); expect1('POST', '/api/MaintenanceDevices/Create').flush({});
    service.updateDevice(2, {} as never).subscribe(); expect1('PUT', '/api/MaintenanceDevices/Update/2').flush({});
    service.deleteDevice(2).subscribe(); expect1('DELETE', '/api/MaintenanceDevices/Delete/2').flush({});

    service.createTask({} as never).subscribe(); expect1('POST', '/api/MaintenanceTasks/Create').flush({});
    service.updateTask(6, {} as never).subscribe(); expect1('PUT', '/api/MaintenanceTasks/Update/6').flush({});
    service.deleteTask(6).subscribe(); expect1('DELETE', '/api/MaintenanceTasks/Delete/6').flush({});
    service.assignTask(6, 9).subscribe();
    expect(expect1('PUT', '/api/MaintenanceTasks/Assign/6').request.body).toEqual({ userId: 9 });
  });

  it('routes every lookup table to its own controller', () => {
    const routes = { deviceTypes: '/api/DeviceTypes', companies: '/api/DeviceCompanies', damageTypes: '/api/DamageTypes', statuses: '/api/MaintenanceRequestStatuses' } as const;
    for (const [kind, base] of Object.entries(routes) as [keyof typeof routes, string][]) {
      service.lookup(kind).subscribe(); expect1('GET', `${base}/GetAll`).flush([]);
      service.createLookup(kind, { name: 'س' }).subscribe(); expect1('POST', `${base}/Create`).flush({});
      service.updateLookup(kind, 4, { name: 'ص' }).subscribe(); expect1('PUT', `${base}/Update/4`).flush({});
      service.deleteLookup(kind, 4).subscribe(); expect1('DELETE', `${base}/Delete/4`).flush({});
    }
  });

  it('moves spare-part stock through receive, adjust, issue and return', () => {
    service.partDepartments().subscribe(); expect1('GET', '/api/SpareParts/Departments').flush([]);
    service.receivePart(3, { quantity: 10, unitCost: 2.5, date: null, source: 'مورد' }).subscribe();
    expect(expect1('POST', '/api/SpareParts/Receive/3').request.body).toEqual({ quantity: 10, unitCost: 2.5, date: null, source: 'مورد' });
    service.adjustPart(3, { delta: -2, reason: 'تالف' }).subscribe();
    expect(expect1('POST', '/api/SpareParts/Adjust/3').request.body).toEqual({ delta: -2, reason: 'تالف' });
    service.partMovements(3).subscribe(); expect1('GET', '/api/SpareParts/Movements/3?page=1&pageSize=20').flush(page);
    service.partReport({ departmentId: 0, from: '2026-11-01', to: '' }).subscribe();
    expect1('GET', '/api/SpareParts/Report?from=2026-11-01').flush({});
    service.requestParts(5).subscribe(); expect1('GET', '/api/SpareParts/Request/5').flush({});
    service.availableParts(5, '').subscribe(); expect1('GET', '/api/SpareParts/Request/5/Available').flush([]);
    service.issuePart(5, { sparePartId: 3, quantity: 1.5 }).subscribe();
    expect(expect1('POST', '/api/SpareParts/Request/5/Issue').request.body).toEqual({ sparePartId: 3, quantity: 1.5 });
    service.returnPart(11).subscribe(); expect1('DELETE', '/api/SpareParts/RequestPart/11').flush({});
  });

  it('derives what the user can do from permissions and follows a user switch', () => {
    const auth = TestBed.inject(AuthService);
    const as = (permissions: string[]) => auth.currentUser.set({
      email: 'u@e.test', fullName: 'ف', role: 'x', branchId: 1, departmentId: 2, officeId: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(), permissions
    });
    as(['ViewMaintenanceRequests', 'IssueSparePart']);
    expect(service.can()).toMatchObject({ viewRequests: true, issueParts: true, createRequest: false, deleteTask: false });
    as(['CreateMaintenanceRequest']);
    expect(service.can()).toMatchObject({ viewRequests: false, issueParts: false, createRequest: true });
  });
});
