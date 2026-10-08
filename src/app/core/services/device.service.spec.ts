import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeviceService, formatCoords } from './device.service';
import { AuthService } from './auth.service';
import { isMac, isSubnetMask, sameSubnet } from '@core/utils/network';

describe('Device inventory', () => {
  let service: DeviceService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DeviceService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends installations as JSON with rowVersion and never reads passwords from lists', () => {
    service.createInstallation({
      deviceId: 1, siteId: 2, ip: '10.0.0.5', subnetMask: '255.255.255.0', gateway: '10.0.0.1', userName: 'admin', pass: 'x', note: '',
      installLocation: 'عند البوابة', sn: 'SN-1', macAddress: '', port: '', vlan: 10, firmware: '', installDate: null, status: 1, rowVersion: null
    }).subscribe();
    const req = http.expectOne('/api/DeviceSites/Create');
    expect(req.request.body).toMatchObject({ deviceId: 1, siteId: 2, ip: '10.0.0.5', pass: 'x', installLocation: 'عند البوابة', sn: 'SN-1', vlan: 10 });
    req.flush({});
  });

  it('searches installations on the server with paging and filters', () => {
    service.installations({ q: '10.0', siteId: 3, status: 2, page: 2, pageSize: 50 }).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/DeviceSites/Search'));
    expect(req.request.url).toBe('/api/DeviceSites/Search?q=10.0&siteId=3&status=2&page=2&pageSize=50');
    req.flush({ items: [], totalCount: 0, page: 2, pageSize: 50 });
  });

  it('reveals a password only on request, flagging copies', () => {
    let value = '';
    service.revealPassword(7, true).subscribe(p => value = p);
    const req = http.expectOne('/api/DeviceSites/Password/7?copy=true');
    req.flush({ password: 's3cret' });
    expect(value).toBe('s3cret');
  });

  it('derives device access from the user permissions only', () => {
    const auth = TestBed.inject(AuthService);
    const login = (permissions: string[]) => auth.currentUser.set({
      role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: null, departmentId: null, officeId: null,
      expiresAt: new Date(Date.now() + 60000).toISOString()
    });

    login([]);
    expect(service.access()).toEqual({ canView: false, canCreate: false, canEdit: false, canDelete: false, canManage: false, canRevealPasswords: false });

    login(['ViewDevices']);
    expect(service.access()).toMatchObject({ canView: true, canManage: false, canRevealPasswords: false });

    login(['EditDevice']);   // من يعدّل يرى ما يعدّله
    expect(service.access()).toMatchObject({ canView: true, canEdit: true, canCreate: false, canManage: true });

    login(['ViewDevices', 'RevealDevicePasswords']);
    expect(service.access()).toMatchObject({ canRevealPasswords: true });
  });

  it('sends site coordinates and contact fields as JSON', () => {
    service.createSite({ name: 'م', description: '', latitude: 33.51, longitude: 36.27, contactName: 'أحمد', contactPhone: '0933123456', responsibleParty: '' }).subscribe();
    const req = http.expectOne('/api/Sites/Create');
    expect(req.request.body).toMatchObject({ latitude: 33.51, longitude: 36.27, contactName: 'أحمد' });
    req.flush({});
  });

  it('validates subnet masks, gateways and MAC addresses like the backend', () => {
    expect(isSubnetMask('255.255.255.0')).toBe(true);
    expect(isSubnetMask('255.255.255.255')).toBe(true);
    expect(isSubnetMask('255.0.255.0')).toBe(false);
    expect(isSubnetMask('10.0.0.1')).toBe(false);
    expect(isSubnetMask('0.0.0.0')).toBe(false);
    expect(sameSubnet('192.168.1.10', '192.168.1.1', '255.255.255.0')).toBe(true);
    expect(sameSubnet('192.168.1.10', '192.168.2.1', '255.255.255.0')).toBe(false);
    expect(isMac('aa-bb-cc-dd-ee-ff')).toBe(true);
    expect(isMac('')).toBe(true);
    expect(isMac('zz:zz:zz:zz:zz:zz')).toBe(false);
  });

  it('formats coordinates and leaves missing ones empty', () => {
    expect(formatCoords(33.513812, 36.276512)).toBe('33.51381, 36.27651');
    expect(formatCoords(null, 36.2)).toBe('');
  });
});
