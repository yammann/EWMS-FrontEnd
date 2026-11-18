import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ConfirmService } from '@shared/ui/confirm.service';
import { ToastService } from '@shared/ui/toast.service';
import { StudyAccess } from '../../data-access/study-access';
import { StudySettingsPage } from './study-settings-page';

const URL = '/api/StudyLookups/Beneficiaries';
const BENEFICIARY = { id: 7, name: 'جهة مستفيدة', code: '0007', isActive: true };

describe('StudySettingsPage beneficiaries', () => {
  const route = new BehaviorSubject(convertToParamMap({ tab: 'beneficiaries' }));

  function open(manage = true) {
    TestBed.resetTestingModule();
    route.next(convertToParamMap({ tab: 'beneficiaries' }));
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { queryParamMap: route } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: StudyAccess, useValue: { can: signal({ createLookup: manage, editLookup: manage, deleteLookup: manage }) } },
      { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), show: vi.fn() } }
    ] });
    const fixture = TestBed.createComponent(StudySettingsPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${URL}/GetAll`).flush([BENEFICIARY]);
    fixture.detectChanges();
    return { fixture, http, c: fixture.componentInstance };
  }

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('opens the beneficiaries tab and creates names up to 200 characters', () => {
    const { fixture, http, c } = open();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('الجهات المستفيدة');
    c.crud.openCreate();
    c.form.controls.name.setValue(' ج'.repeat(75));
    c.form.controls.code.setValue(' 0008 ');
    expect(c.form.valid).toBe(true);
    c.save();
    const create = http.expectOne(`${URL}/Create`);
    expect(create.request.body).toEqual({ name: ' ج'.repeat(75).trim(), code: '0008', isActive: true });
    create.flush({ ...BENEFICIARY, id: 8 });
    http.expectOne(`${URL}/GetAll`).flush([BENEFICIARY]);
  });

  it('renames or disables a beneficiary and deletes an unused one through its own routes', async () => {
    const { http, c } = open();
    c.crud.openEdit(BENEFICIARY);
    c.form.patchValue({ name: 'اسم جديد', isActive: false });
    c.save();
    const update = http.expectOne(`${URL}/Update/7`);
    expect(update.request.body).toEqual({ name: 'اسم جديد', code: '0007', isActive: false });
    update.flush({ ...BENEFICIARY, name: 'اسم جديد', isActive: false });
    http.expectOne(`${URL}/GetAll`).flush([BENEFICIARY]);
    await c.crud.remove(BENEFICIARY);
    const remove = http.expectOne(`${URL}/Delete/7`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ message: 'تم الحذف' });
    expect(c.crud.items()).toEqual([]);
  });

  it('keeps management actions unavailable without their permissions', async () => {
    const { http, c } = open(false);
    c.crud.openCreate();
    c.crud.openEdit(BENEFICIARY);
    await c.crud.remove(BENEFICIARY);
    expect(c.crud.dialog()).toBeNull();
    http.expectNone(`${URL}/Delete/7`);
  });

  it('retains the 100 character limit for the existing catalogs after switching tabs', () => {
    const { http, c } = open();
    route.next(convertToParamMap({ tab: 'disciplines' }));
    http.expectOne('/api/StudyLookups/Disciplines/GetAll').flush([]);
    c.crud.openCreate();
    c.form.controls.name.setValue('ج'.repeat(101));
    expect(c.form.controls.name.invalid).toBe(true);
    c.form.controls.name.setValue('اختصاص');
    expect(c.form.valid).toBe(true);
    c.save();
    const create = http.expectOne('/api/StudyLookups/Disciplines/Create');
    expect(create.request.body).toEqual({ name: 'اختصاص', isActive: true });
    create.flush({ id: 1, name: 'اختصاص', isActive: true });
    http.expectOne('/api/StudyLookups/Disciplines/GetAll').flush([]);
  });

  it('requires a nonblank code of at most 30 characters when adding a beneficiary', () => {
    const { fixture, http, c } = open();
    c.crud.openCreate();
    c.form.controls.name.setValue('جهة جديدة');
    for (const code of ['', '   ', '1'.repeat(31)]) {
      c.form.controls.code.setValue(code);
      c.save();
      expect(c.form.controls.code.invalid).toBe(true);
      http.expectNone(`${URL}/Create`);
    }
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('أدخل رمز الجهة');
    c.form.controls.code.setValue('0008');
    expect(c.form.valid).toBe(true);
  });
});
