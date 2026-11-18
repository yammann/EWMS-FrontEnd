import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { StudyResponse } from '../data-access/studies.models';
import { StudyResponseFormDialog } from './response-form-dialog';

function open(response?: Partial<StudyResponse>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(StudyResponseFormDialog);
  fixture.componentRef.setInput('parent', { assignmentId: 5, assignmentNumber: 'IPA-26-001', followingDepartmentName: 'القسم', branchId: 7 });
  if (response) fixture.componentRef.setInput('response', response);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/StudyLookups/Employees?branchId=7').flush([]);
  return { fixture, http, dialog: fixture.componentInstance };
}

describe('StudyResponseFormDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('binds the site area and initial cost inputs to the form', () => {
    const { fixture, dialog } = open();
    const root: HTMLElement = fixture.nativeElement;
    const type = (name: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`input[formControlName=${name}]`);
      expect(input, name).not.toBeNull();
      input!.value = value;
      input!.dispatchEvent(new Event('input'));
    };
    type('siteArea', '5200');
    type('initialCost', '22000000');
    const v = dialog.form.getRawValue();
    expect(v.siteArea).toBe(5200);
    expect(v.initialCost).toBe(22000000);
  });

  it('previews Syrian equivalents from the manual rate and keeps the table total in dollars', () => {
    const { fixture, http, dialog } = open();
    dialog.form.patchValue({ initialCost: 120, usdToSypRate: 150 });
    dialog.addCost();
    dialog.form.controls.costItems.at(0).setValue({ description: 'بند', unit: 'م²', quantity: 3, unitPrice: 12.5 });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[formControlName=usdToSypRate]')).not.toBeNull();
    expect(root.querySelectorAll('.currency-equivalent')[0].textContent).toContain('18,000 ل.س');
    expect(root.querySelectorAll('.currency-equivalent')[1].textContent).toContain('5,625 ل.س');
    expect(root.querySelector('.table-cost-total')?.textContent).toContain('37.5 دولار');

    dialog.form.controls.usdToSypRate.setValue(0);
    dialog.save();
    http.expectNone('/api/StudyResponses/Create');
    dialog.form.controls.usdToSypRate.setValue(160);
    fixture.detectChanges();
    expect(root.querySelectorAll('.currency-equivalent')[1].textContent).toContain('6,000 ل.س');

    dialog.save();
    const request = http.expectOne('/api/StudyResponses/Create');
    expect(request.request.body).toMatchObject({ costsInUsd: true, usdToSypRate: 160, initialCost: 120, costItems: [{ unitPrice: 12.5 }] });
    request.flush({ id: 9 });
  });

  it('requires re-entering old Syrian amounts when switching a response to dollars', () => {
    const { fixture, http, dialog } = open({
      id: 9, responseDate: '2026-11-18', recommendation: 1, buildings: [],
      costsInUsd: false, usdToSypRate: null, initialCost: 1200,
      costItems: [{ id: 5, sortOrder: 1, description: 'بند', unit: 'م²', quantity: 2, unitPrice: 200, total: 400 }]
    });
    expect(fixture.nativeElement.querySelector('.table-cost-total').textContent).toContain('400 ل.س');
    dialog.save();
    const legacy = http.expectOne('/api/StudyResponses/Update/9');
    expect(legacy.request.body).toMatchObject({ costsInUsd: false, usdToSypRate: null, initialCost: 1200 });
    legacy.flush({ id: 9 });

    dialog.enableUsdPricing();
    expect(dialog.form.controls.initialCost.value).toBeNull();
    expect(dialog.form.controls.costItems.at(0).controls.unitPrice.value).toBeNull();
    dialog.save();
    http.expectNone('/api/StudyResponses/Update/9');
  });

  it('requires one row per building, preserves rows while changing the count, and submits the sum', () => {
    const { fixture, http, dialog } = open();
    const building = dialog.form.controls.buildings.at(0);
    building.patchValue({ included: true, buildingCount: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.building-detail')).toHaveLength(0);
    building.controls.buildingCount.setValue(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.building-detail')).toHaveLength(2);
    dialog.save();
    http.expectNone('/api/StudyResponses/Create');

    const first = { code: 'A-01', function: 'إدارة', area: 10.15 };
    const second = { code: 'A-02', function: 'مختبر', area: 5.2 };
    building.controls.details.at(0).setValue(first);
    building.controls.details.at(1).setValue(second);
    building.controls.buildingCount.setValue(1);
    expect(dialog.form.valid).toBe(true);
    building.controls.buildingCount.setValue(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.building-total').value).toBe('15.35');
    dialog.save();
    const request = http.expectOne('/api/StudyResponses/Create');
    expect(request.request.body.buildings).toEqual([{ buildingType: 1, buildingCount: 2, buildingsArea: 15.35, details: [first, second] }]);
    request.flush({ id: 9 });
  });

  it('retains a saved summary with no details and allows opting into individual rows', () => {
    const { fixture, http, dialog } = open({
      id: 9, responseDate: '2026-11-18', recommendation: 1, costItems: [],
      buildings: [{ buildingType: 1, buildingTypeName: 'إعادة تأهيل', buildingCount: 2, buildingsArea: 25 }]
    });
    expect(fixture.nativeElement.querySelector('.building-total').value).toBe('25');
    dialog.save();
    const request = http.expectOne('/api/StudyResponses/Update/9');
    expect(request.request.body.buildings).toEqual([{ buildingType: 1, buildingCount: 2, buildingsArea: 25, details: [] }]);
    request.flush({ id: 9 });

    dialog.enterBuildingDetails();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.building-detail')).toHaveLength(2);
    expect(dialog.form.invalid).toBe(true);
  });
});
