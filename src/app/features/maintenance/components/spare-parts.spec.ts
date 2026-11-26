import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from '@core/interceptors/api-error.interceptor';
import { localDateInput } from '@core/utils/format';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { MaintenanceRequest } from '../data-access/maintenance.models';
import { RequestPart, SparePart } from '../data-access/spare-part.models';
import { SparePartStockDialog } from './spare-part-dialogs';
import { RequestPartsPanel } from './request-parts-panel';

const part = (over: Partial<SparePart> = {}) => ({ id: 3, name: 'فلتر', unit: 'قطعة', quantity: 10, averageCost: 5, ...over }) as SparePart;
const providers = [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()];

describe('SparePartStockDialog', () => {
  const open = (mode: 'receive' | 'adjust', p = part()) => {
    TestBed.configureTestingModule({ providers });
    const fixture = TestBed.createComponent(SparePartStockDialog);
    fixture.componentRef.setInput('part', p);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return { dialog: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  };
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('receive: needs a positive quantity, a cost and a date not in the future, and shows the new average cost', () => {
    const { dialog, http } = open('receive');
    expect(dialog.valid()).toBe(false);
    dialog.form.patchValue({ quantity: 10, unitCost: 7 });
    expect(dialog.valid()).toBe(true);
    expect(dialog.newAverage()).toBe(6);                       // (10×5 + 10×7) ÷ 20

    dialog.form.patchValue({ date: '2999-01-01' });
    expect(dialog.valid()).toBe(false);
    dialog.form.patchValue({ date: localDateInput(), quantity: 0 });
    expect(dialog.valid()).toBe(false);
    dialog.form.patchValue({ quantity: 2.555 });
    expect(dialog.valid()).toBe(false);                        // أكثر من خانتين عشريتين

    dialog.form.patchValue({ quantity: 4, unitCost: 2.5, note: ' مورد المدينة ' });
    dialog.save();
    const req = http.expectOne('/api/SpareParts/Receive/3');
    expect(req.request.body).toEqual({ quantity: 4, unitCost: 2.5, date: localDateInput(), source: 'مورد المدينة' });
    req.flush(part({ quantity: 14 }));
  });

  it('adjust by count: starts at the current stock, sends the difference, and requires a reason', () => {
    const { dialog, http } = open('adjust');
    expect(dialog.form.controls.quantity.value).toBe(10);
    expect(dialog.delta()).toBe(0);
    expect(dialog.valid()).toBe(false);                        // لا فرق

    dialog.form.patchValue({ quantity: 8 });
    expect(dialog.delta()).toBe(-2);
    expect(dialog.deltaText()).toBe('-2');
    expect(dialog.valid()).toBe(false);                        // بلا سبب
    dialog.form.patchValue({ note: 'جرد' });
    expect(dialog.valid()).toBe(true);
    dialog.save();
    expect(http.expectOne('/api/SpareParts/Adjust/3').request.body).toEqual({ delta: -2, reason: 'جرد' });
  });

  it('adjust as damaged: subtracts the entered quantity and never below zero stock', () => {
    const { dialog } = open('adjust');
    dialog.setKind('damaged');
    expect(dialog.form.controls.quantity.value).toBeNull();
    dialog.form.patchValue({ quantity: 3, note: 'تالف' });
    expect(dialog.delta()).toBe(-3);
    expect(dialog.valid()).toBe(true);
    dialog.form.patchValue({ quantity: 12 });
    expect(dialog.valid()).toBe(false);
  });
});

describe('RequestPartsPanel', () => {
  const request = { id: 5, isClosed: false } as MaintenanceRequest;
  const open = () => {
    TestBed.configureTestingModule({ providers });
    const fixture = TestBed.createComponent(RequestPartsPanel);
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/SpareParts/Request/5').flush({ items: [], total: 0, deviceLifetimeCost: 0, canIssue: true });
    return { fixture, panel: fixture.componentInstance, http };
  };
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('checks the quantity against precision and the stock of the selected part', () => {
    const { panel, http } = open();
    panel.openIssue();
    http.expectOne('/api/SpareParts/Request/5/Available').flush([part({ quantity: 2 })]);
    expect(panel.quantityError()).toBe('');                    // لا قطعة مختارة
    panel.select(part({ quantity: 2 }));
    panel.quantity.set(3);
    expect(panel.quantityError()).toBe('المتوفر 2 قطعة فقط');
    panel.quantity.set(1.234);
    expect(panel.quantityError()).toContain('بخانتين عشريتين');
    panel.quantity.set(0);
    expect(panel.quantityError()).toContain('كمية موجبة');
    panel.quantity.set(1.5);
    expect(panel.quantityError()).toBe('');
  });

  it('caps the quantity when a part with less stock is picked', () => {
    const { panel, http } = open();
    panel.openIssue();
    http.expectOne('/api/SpareParts/Request/5/Available').flush([]);
    panel.quantity.set(5);
    panel.select(part({ quantity: 0.5 }));
    expect(panel.quantity()).toBe(0.5);
  });

  it('issues the part, closes the dialog, refreshes the list and tells the request page', () => {
    const { panel, http } = open();
    const changed = vi.fn();
    panel.changed.subscribe(changed);
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    panel.openIssue();
    http.expectOne('/api/SpareParts/Request/5/Available').flush([part()]);
    panel.select(part());
    panel.quantity.set(2);
    panel.issue();
    const req = http.expectOne('/api/SpareParts/Request/5/Issue');
    expect(req.request.body).toEqual({ sparePartId: 3, quantity: 2 });
    req.flush({ items: [{ id: 11 }], total: 10, deviceLifetimeCost: 10, canIssue: true });
    expect(panel.issueOpen()).toBe(false);
    expect(panel.data()?.items.length).toBe(1);
    expect(success).toHaveBeenCalledWith('صُرف 2 قطعة من «فلتر»');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('returns an issued part to stock only after confirmation', async () => {
    const { panel, http } = open();
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);
    const issued = { id: 11, quantity: 2, unit: 'قطعة', partName: 'فلتر' } as RequestPart;
    await panel.returnPart(issued);
    http.expectNone('/api/SpareParts/RequestPart/11');
    ask.mockResolvedValue(true);
    await panel.returnPart(issued);
    expect(http.expectOne('/api/SpareParts/RequestPart/11').request.method).toBe('DELETE');
  });
});
