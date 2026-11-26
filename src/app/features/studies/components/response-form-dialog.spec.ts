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

const cost = (id: number, description: string, quantity: number, unitPrice: number) =>
  ({ id, sortOrder: id, description, unit: 'م²', quantity, unitPrice, total: quantity * unitPrice });

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
    dialog.addBuilding({ buildingType: 1, code: 'A-01', function: 'إدارة', area: 3, unitPrice: 12.5 });
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
    const detail = { code: 'A-01', function: 'إدارة', area: 2 };
    const { fixture, http, dialog } = open({
      id: 9, responseDate: '2026-11-18', recommendation: 1, costsInUsd: false, usdToSypRate: null, initialCost: 1200,
      buildings: [{ buildingType: 1, buildingTypeName: 'إعادة تأهيل', buildingCount: 1, buildingsArea: 2, details: [detail] }],
      costItems: [cost(5, 'إعادة تأهيل — A-01 — إدارة', 2, 200)]
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-cost-total').textContent).toContain('400 ل.س');
    dialog.save();
    const sypSave = http.expectOne('/api/StudyResponses/Update/9');
    expect(sypSave.request.body).toMatchObject({ costsInUsd: false, usdToSypRate: null, initialCost: 1200, costItems: [{ unitPrice: 200 }] });
    sypSave.flush({ id: 9 });

    dialog.enableUsdPricing();
    expect(dialog.form.controls.initialCost.value).toBeNull();
    expect(dialog.form.controls.pricedBuildings.at(0).controls.unitPrice.value).toBeNull();
    dialog.save();
    http.expectNone('/api/StudyResponses/Update/9');
  });

  it('sends one cost item per building, in building order, with the building area as quantity', () => {
    const { fixture, http, dialog } = open();
    dialog.addBuilding();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.building-detail')).toHaveLength(1);
    dialog.save();
    http.expectNone('/api/StudyResponses/Create');

    const first = { code: 'A-01', function: 'إدارة', area: 10.15 };
    const second = { code: 'B-01', function: 'مختبر', area: 5.2 };
    const third = { code: 'A-02', function: 'مستودع', area: 4 };
    dialog.form.controls.pricedBuildings.at(0).setValue({ ...first, buildingType: 1, unitPrice: 20 });
    dialog.addBuilding({ ...second, buildingType: 2, unitPrice: 10 });
    dialog.addBuilding({ ...third, buildingType: 1, unitPrice: 5 });
    dialog.save();
    const request = http.expectOne('/api/StudyResponses/Create');
    // النوع أولاً (إعادة تأهيل ثم إنشاء جديد)، ثم ترتيب الإدخال داخل النوع
    expect(request.request.body.buildings).toEqual([
      { buildingType: 1, buildingCount: 2, buildingsArea: 14.15, details: [first, third] },
      { buildingType: 2, buildingCount: 1, buildingsArea: 5.2, details: [second] }
    ]);
    expect(request.request.body.costItems).toEqual([
      { description: 'إعادة تأهيل — A-01 — إدارة', unit: 'م²', quantity: first.area, unitPrice: 20 },
      { description: 'إعادة تأهيل — A-02 — مستودع', unit: 'م²', quantity: third.area, unitPrice: 5 },
      { description: 'إنشاء جديد — B-01 — مختبر', unit: 'م²', quantity: second.area, unitPrice: 10 }
    ]);
    request.flush({ id: 9 });
  });

  it('reopens saved buildings of both types in saved order, each with its price', () => {
    const a = { code: 'A-01', function: 'إدارة', area: 10 };
    const b = { code: 'B-01', function: 'مختبر', area: 4 };
    const c = { code: 'B-02', function: 'مستودع', area: 6 };
    const { fixture, dialog } = open({
      id: 9, responseDate: '2026-11-18', recommendation: 1, costsInUsd: true,
      buildings: [
        { buildingType: 2, buildingTypeName: 'إنشاء جديد', buildingCount: 2, buildingsArea: 10, details: [b, c] },
        { buildingType: 1, buildingTypeName: 'إعادة تأهيل', buildingCount: 1, buildingsArea: 10, details: [a] }
      ],
      costItems: [cost(1, 'إعادة تأهيل — A-01 — إدارة', 10, 25), cost(2, 'إنشاء جديد — B-01 — مختبر', 4, 30), cost(3, 'إنشاء جديد — B-02 — مستودع', 6, 12)]
    });
    fixture.detectChanges();
    expect(dialog.form.controls.pricedBuildings.getRawValue()).toEqual([
      { ...a, buildingType: 1, unitPrice: 25 }, { ...b, buildingType: 2, unitPrice: 30 }, { ...c, buildingType: 2, unitPrice: 12 }
    ]);
    expect(dialog.incomplete()).toBe(false);
    expect(fixture.nativeElement.querySelector('.alert-warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-cost-total').textContent).toContain('442 دولار');
  });

  it('flags a saved response whose cost items do not match its buildings, and blocks saving until prices are entered', () => {
    const detail = { code: 'A-01', function: 'إدارة', area: 10 };
    const { fixture, http, dialog } = open({
      id: 9, responseDate: '2026-11-18', recommendation: 1, costsInUsd: true,
      buildings: [{ buildingType: 1, buildingTypeName: 'إعادة تأهيل', buildingCount: 1, buildingsArea: 10, details: [detail] }],
      costItems: [{ id: 5, sortOrder: 1, description: 'أعمال ترميم', unit: 'مقطوع', quantity: 1, unitPrice: 250, total: 250 }]
    });
    fixture.detectChanges();
    expect(dialog.incomplete()).toBe(true);
    expect(fixture.nativeElement.querySelector('.alert-warning')?.textContent).toContain('أكمل الأسطر الناقصة');
    expect(dialog.form.controls.pricedBuildings.getRawValue()).toEqual([{ ...detail, buildingType: 1, unitPrice: null }]);
    dialog.save();
    http.expectNone('/api/StudyResponses/Update/9');

    dialog.form.controls.pricedBuildings.at(0).controls.unitPrice.setValue(25);
    dialog.save();
    const request = http.expectOne('/api/StudyResponses/Update/9');
    expect(request.request.body.costItems).toEqual([{ description: 'إعادة تأهيل — A-01 — إدارة', unit: 'م²', quantity: 10, unitPrice: 25 }]);
    request.flush({ id: 9 });
  });

  it('flags buildings saved as a count without details', () => {
    const { fixture, dialog } = open({
      id: 9, responseDate: '2026-11-18', recommendation: 1, costsInUsd: true, costItems: [],
      buildings: [{ buildingType: 1, buildingTypeName: 'إعادة تأهيل', buildingCount: 2, buildingsArea: 25 }]
    });
    fixture.detectChanges();
    expect(dialog.incomplete()).toBe(true);
    expect(dialog.form.controls.pricedBuildings.length).toBe(0);
    expect(fixture.nativeElement.querySelector('.alert-warning')).not.toBeNull();
  });
});
