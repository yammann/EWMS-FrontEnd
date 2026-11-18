import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { StudyRequestFormDialog } from './request-form-dialog';
import { StudyLookup, StudyRequest } from '../data-access/studies.models';

const BENEFICIARIES: StudyLookup[] = [
  { id: 7, name: 'الجهة الأولى', code: '0007', isActive: true },
  { id: 8, name: 'الجهة الثانية', code: '0008', isActive: true }
];
const BENEFICIARY_URL = '/api/StudyLookups/Beneficiaries/GetAll?activeOnly=true';

const SITES = [
  { id: 1, name: 'موقع دمشق', governorateCode: 'SY02', governorateName: 'دمشق' },
  { id: 2, name: 'موقع حلب', governorateCode: 'SY07', governorateName: 'حلب' },
  { id: 3, name: 'موقع ثانٍ في دمشق', governorateCode: 'SY02', governorateName: 'دمشق' }
];

function open(canSeeSites: boolean, request: Partial<StudyRequest> | null = null, beneficiaries: StudyLookup[] | null = BENEFICIARIES) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { hasPermission: () => false, hasAnyPermission: () => canSeeSites } }]
  });
  const fixture = TestBed.createComponent(StudyRequestFormDialog);
  if (request) fixture.componentRef.setInput('request', request);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  if (beneficiaries) http.expectOne(request ? '/api/StudyLookups/Beneficiaries/GetAll' : BENEFICIARY_URL).flush(beneficiaries);
  return { fixture, http, form: fixture.componentInstance.form, c: fixture.componentInstance };
}

describe('StudyRequestFormDialog site picking', () => {
  it('offers only the sites of the chosen governorate and clears a site that no longer fits', () => {
    const { fixture, http, form, c } = open(true);
    http.expectOne('/api/Sites/GetAll').flush(SITES);
    form.controls.governorateCode.setValue('SY02');
    expect(c.siteOptions().map(s => s.id)).toEqual([1, 3]);
    form.controls.siteId.setValue(3);
    form.controls.governorateCode.setValue('SY07');
    expect(form.controls.siteId.value).toBe(0);
    expect(c.siteOptions().map(s => s.id)).toEqual([2]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('select[formControlName=siteId]')).not.toBeNull();
  });

  it('hides the field and never loads sites without the site permission', () => {
    const { fixture, http } = open(false);
    http.expectNone('/api/Sites/GetAll');
    expect((fixture.nativeElement as HTMLElement).querySelector('select[formControlName=siteId]')).toBeNull();
  });
});

describe('StudyRequestFormDialog beneficiaries', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('requires a selection and sends its numeric id and name when the user selects an active beneficiary', () => {
    const { fixture, http, form, c } = open(false);
    form.patchValue({ governorateCode: 'SY02', requestNumber: '001/د/2026' });
    c.save();
    expect(form.controls.mainBeneficiaryId.invalid).toBe(true);
    http.expectNone('/api/StudyRequests/Create');

    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('select[formControlName=mainBeneficiaryId]')!;
    select.selectedIndex = 2;
    select.dispatchEvent(new Event('change'));
    expect(form.controls.mainBeneficiaryId.value).toBe(8);
    expect(form.controls.entityCode.value).toBe('0008');
    fixture.detectChanges();
    const codeInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[formControlName=entityCode]')!;
    expect(codeInput.readOnly).toBe(true);
    expect(codeInput.value).toBe('0008');
    c.save();
    const create = http.expectOne('/api/StudyRequests/Create');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toMatchObject({ mainBeneficiaryId: 8, mainBeneficiary: 'الجهة الثانية', entityCode: '0008' });
    create.flush({ id: 1 });
  });

  it('keeps a saved inactive beneficiary and its original name when editing', () => {
    const { fixture, http, form, c } = open(false, {
      id: 10, requestNumber: '001/د/2026', mainBeneficiaryId: 9, mainBeneficiary: 'الجهة القديمة', requestDate: '2026-11-18',
      governorateCode: 'SY02', urgency: 2, workType: 1, branchId: 1, entityCode: 'OLD'
    }, [...BENEFICIARIES, { id: 9, name: 'جهة معطلة', code: '0009', isActive: false }]);
    fixture.detectChanges();
    expect(form.controls.mainBeneficiaryId.value).toBe(9);
    expect(form.controls.entityCode.value).toBe('0009');
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('select[formControlName=mainBeneficiaryId]')!;
    expect(select.selectedOptions[0].textContent).toContain('الجهة القديمة');
    c.save();
    const update = http.expectOne('/api/StudyRequests/Update/10');
    expect(update.request.body).toMatchObject({ mainBeneficiaryId: 9, mainBeneficiary: 'الجهة القديمة', entityCode: '0009' });
    update.flush({ id: 10 });
  });

  it('preserves the saved name after a beneficiary is renamed in settings', () => {
    const { c } = open(false, { mainBeneficiaryId: 7, mainBeneficiary: 'الاسم عند تسجيل الطلب' });
    expect(c.beneficiaryOptions().find(b => b.id === 7)?.name).toBe('الاسم عند تسجيل الطلب');
  });

  it('excludes inactive beneficiaries from a new request and explains an empty list', () => {
    const { fixture, c } = open(false, null, [
      { id: 9, name: 'جهة معطلة', code: '0009', isActive: false },
      { id: 10, name: 'جهة بلا رمز', code: null, isActive: true }
    ]);
    fixture.detectChanges();
    expect(c.beneficiaryOptions()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('لا توجد جهات مستفيدة فعالة');
  });

  it('shows a load error and supports retrying without losing the other form values', () => {
    const { fixture, http, form, c } = open(false, null, null);
    form.controls.subBeneficiary.setValue('الجهة الفرعية');
    http.expectOne(BENEFICIARY_URL).flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(c.beneficiaryError()).toContain('تعذّر تحميل');
    const retry = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'))
      .find(b => b.textContent?.includes('إعادة المحاولة'))!;
    retry.click();
    http.expectOne(BENEFICIARY_URL).flush(BENEFICIARIES);
    expect(c.beneficiaryError()).toBe('');
    expect(c.beneficiariesLoading()).toBe(false);
    expect(c.beneficiaryOptions()).toHaveLength(2);
    expect(form.controls.subBeneficiary.value).toBe('الجهة الفرعية');
  });

  it('updates the code when switching beneficiary and clears it when no beneficiary is selected', () => {
    const { form } = open(false);
    form.controls.mainBeneficiaryId.setValue(7);
    expect(form.controls.entityCode.value).toBe('0007');
    form.controls.mainBeneficiaryId.setValue(8);
    expect(form.controls.entityCode.value).toBe('0008');
    form.controls.mainBeneficiaryId.setValue(0);
    expect(form.controls.entityCode.value).toBe('');
    expect(form.controls.entityCode.hasError('required')).toBe(true);
  });

  it('uses the configured code even if the readonly form control is changed programmatically', () => {
    const { http, form, c } = open(false);
    form.patchValue({ mainBeneficiaryId: 7, governorateCode: 'SY02', requestNumber: '001/د/2026' });
    form.controls.entityCode.setValue('FORGED');
    c.save();
    const create = http.expectOne('/api/StudyRequests/Create');
    expect(create.request.body.entityCode).toBe('0007');
    create.flush({ id: 1 });
  });

  it('requires completing the code in settings when a saved beneficiary has no configured code', () => {
    const { fixture, http, form, c } = open(false, {
      id: 10, mainBeneficiaryId: 9, mainBeneficiary: 'جهة قديمة', entityCode: 'OLD', requestDate: '2026-11-18',
      governorateCode: 'SY02', urgency: 2, workType: 1, branchId: 1
    }, [{ id: 9, name: 'جهة قديمة', code: null, isActive: true }]);
    fixture.detectChanges();
    expect(form.controls.entityCode.value).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('أكمل رمز هذه الجهة');
    c.save();
    http.expectNone('/api/StudyRequests/Update/10');
  });
});

describe('StudyRequestFormDialog manual request number', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it.each([
    ['', 'أدخل رقم الطلب.'],
    ['   ', 'أدخل رقم الطلب.'],
    ['1'.repeat(31), 'الحد الأقصى 30 حرفاً.']
  ])('blocks saving an invalid request number: %j', (requestNumber, message) => {
    const { fixture, http, form, c } = open(false);
    form.patchValue({ mainBeneficiaryId: 7, governorateCode: 'SY02', requestNumber });
    c.save();
    fixture.detectChanges();
    expect(form.controls.requestNumber.invalid).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('#study-request-number-error')?.textContent).toBe(message);
    http.expectNone('/api/StudyRequests/Create');
  });

  it('sends the number entered by the user with leading zeros and punctuation preserved', () => {
    const { fixture, http, form, c } = open(false);
    form.patchValue({ mainBeneficiaryId: 7, governorateCode: 'SY02' });
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[formControlName=requestNumber]')!;
    expect(input.required).toBe(true);
    expect(input.readOnly).toBe(false);
    input.value = '  ٠٠١/د/2026  ';
    input.dispatchEvent(new Event('input'));
    c.save();
    const create = http.expectOne('/api/StudyRequests/Create');
    expect(create.request.body.requestNumber).toBe('٠٠١/د/2026');
    create.flush({ id: 1, requestNumber: '٠٠١/د/2026' });
  });

  it('loads and updates the manual number while preserving historical archive data', () => {
    const { http, form, c } = open(false, {
      id: 10, requestNumber: '001/2026', diwanRequestNumber: 'رقم أرشيف سابق',
      mainBeneficiaryId: 7, mainBeneficiary: BENEFICIARIES[0].name, requestDate: '2026-11-18',
      governorateCode: 'SY02', urgency: 2, workType: 1, branchId: 1, rowVersion: 'version'
    });
    expect(form.controls.requestNumber.value).toBe('001/2026');
    form.controls.requestNumber.setValue(' 002/2026 ');
    c.save();
    const update = http.expectOne('/api/StudyRequests/Update/10');
    expect(update.request.body).toMatchObject({ requestNumber: '002/2026', diwanRequestNumber: 'رقم أرشيف سابق', rowVersion: 'version' });
    update.flush({ id: 10, requestNumber: '002/2026' });
  });
});
