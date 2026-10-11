import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { MapLayersService } from './map-layers.service';
import { MapLayerField, formatFieldValue } from './map-layers.models';

describe('Branch map layers', () => {
  let service: MapLayersService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MapLayersService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const login = (permissions: string[]) => TestBed.inject(AuthService).currentUser.set({
    role: 'x', permissions, fullName: 't', email: 't@e.test', branchId: 1, departmentId: 2, officeId: null,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  });

  it('derives access from the permissions only (the server applies the branch/department boundary)', () => {
    login([]);
    expect(service.access()).toMatchObject({ canCreateLayer: false, canViewEntries: false, canCreate: false, canChooseUnit: false, canChooseBranch: false });

    login(['ViewDepartmentMapEntries']);
    expect(service.access()).toMatchObject({ canViewEntries: true, canCreate: false, canChooseUnit: false });

    login(['CreateMapEntry']);   // من يضيف يرى ما يضيفه
    expect(service.access()).toMatchObject({ canViewEntries: true, canCreate: true });

    login(['ViewBranchMapEntries']);   // سجلات الفرع كله: يختار قسم السجل
    expect(service.access()).toMatchObject({ canViewEntries: true, canChooseUnit: true, canChooseBranch: false });

    login(['ViewOrganizationDashboard', 'CreateMapLayer', 'EditMapLayer']);
    expect(service.access()).toMatchObject({ canCreateLayer: true, canEditLayer: true, canDeleteLayer: false, canChooseUnit: true, canChooseBranch: true });
  });

  it('lists layers of a chosen branch only when one is given', () => {
    service.layers(null).subscribe();
    http.expectOne('/api/MapLayers/GetAll').flush([]);
    service.layers(4).subscribe();
    http.expectOne('/api/MapLayers/GetAll?branchId=4').flush([]);
  });

  it('sends the layer with its fields in order and rowVersion', () => {
    service.updateLayer(3, {
      name: 'المشاريع', description: '', color: '#16A34A', allowMultiple: true, isActive: true, rowVersion: 'AAA=',
      fields: [{ id: 9, label: 'الحالة', type: 5, isRequired: true, options: ['قيد التنفيذ', 'منجز'] }, { id: null, label: 'الكلفة', type: 3, isRequired: false, options: [] }]
    }).subscribe();
    const req = http.expectOne('/api/MapLayers/Update/3');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.fields.map((f: { label: string }) => f.label)).toEqual(['الحالة', 'الكلفة']);
    expect(req.request.body).toMatchObject({ rowVersion: 'AAA=', color: '#16A34A' });
    req.flush({});
  });

  it('asks the server to hide or purge a used field explicitly', () => {
    service.deleteField(9, false).subscribe();
    expect(http.expectOne('/api/MapLayers/Field/9?purge=false').request.method).toBe('DELETE');
    service.deleteField(9, true).subscribe();
    http.expectOne('/api/MapLayers/Field/9?purge=true').flush({});
    service.restoreField(9).subscribe();
    expect(http.expectOne('/api/MapLayers/Field/9/Restore').request.method).toBe('PUT');
  });

  it('saves entry values keyed by field id', () => {
    service.createEntry({ layerId: 3, siteId: 7, values: { '9': 'منجز', '10': 1500, '11': true }, departmentId: null }).subscribe();
    const req = http.expectOne('/api/MapEntries/Create');
    expect(req.request.body).toEqual({ layerId: 3, siteId: 7, values: { '9': 'منجز', '10': 1500, '11': true }, departmentId: null });
    req.flush({});
  });

  it('formats field values for reading', () => {
    const field = (type: MapLayerField['type']): MapLayerField => ({ id: 1, label: 'x', type, isRequired: false, options: [], sortOrder: 0, isHidden: false });
    expect(formatFieldValue(field(1), undefined)).toBe('—');
    expect(formatFieldValue(field(1), '')).toBe('—');
    expect(formatFieldValue(field(6), true)).toBe('نعم');
    expect(formatFieldValue(field(6), false)).toBe('لا');
    expect(formatFieldValue(field(4), '2026-10-11')).toBe('2026-10-11');
    expect(formatFieldValue(field(5), 'منجز')).toBe('منجز');
  });
});
