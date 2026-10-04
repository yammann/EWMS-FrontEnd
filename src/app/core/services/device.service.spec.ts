import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeviceService, formatCoords } from './device.service';
import { AuthService } from './auth.service';

describe('Device inventory', () => {
  let service: DeviceService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DeviceService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends installations as form data with the backend field names', () => {
    service.createInstallation({ deviceId: 1, siteId: 2, ip: '10.0.0.5', subnetMask: '255.255.255.0', userName: 'admin', pass: 'x', note: '', installLocation: 'عند البوابة', sn: 'SN-1' }).subscribe();
    const req = http.expectOne('/api/DeviceSites/Create');
    const body = req.request.body as FormData;
    expect(body.get('DeviceId')).toBe('1');
    expect(body.get('SiteId')).toBe('2');
    expect(body.get('Ip')).toBe('10.0.0.5');
    expect(body.get('Pass')).toBe('x');
    expect(body.get('InstallLocation')).toBe('عند البوابة');
    expect(body.get('SN')).toBe('SN-1');
    req.flush({});
  });

  it('derives device access from the user permissions only', () => {
    const auth = TestBed.inject(AuthService);
    const login = (permissions: string[]) => auth.currentUser.set({
      role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: null, departmentId: null, officeId: null,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });

    login([]);
    expect(service.access()).toEqual({ canView: false, canCreate: false, canEdit: false, canDelete: false, canManage: false, inOwnerDepartment: false });

    login(['ViewDevices']);
    expect(service.access()).toMatchObject({ canView: true, canManage: false });

    login(['EditDevice']);   // من يعدّل يرى ما يعدّله
    expect(service.access()).toMatchObject({ canView: true, canEdit: true, canCreate: false, canManage: true });
  });

  it('sends site coordinates as Latitude/Longitude', () => {
    service.createSite({ name: 'م', description: '', latitude: 33.51, longitude: 36.27 }).subscribe();
    const req = http.expectOne('/api/Sites/Create');
    const body = req.request.body as FormData;
    expect(body.get('Latitude')).toBe('33.51');
    expect(body.get('Longitude')).toBe('36.27');
    expect(body.has('Location')).toBe(false);
    req.flush({});
  });

  it('formats coordinates and leaves missing ones empty', () => {
    expect(formatCoords(33.513812, 36.276512)).toBe('33.51381, 36.27651');
    expect(formatCoords(null, 36.2)).toBe('');
  });
});
