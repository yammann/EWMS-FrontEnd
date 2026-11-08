import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services/auth.service';
import { StudyRequestFormDialog } from './request-form-dialog';

const SITES = [
  { id: 1, name: 'موقع دمشق', governorateCode: 'SY02', governorateName: 'دمشق' },
  { id: 2, name: 'موقع حلب', governorateCode: 'SY07', governorateName: 'حلب' },
  { id: 3, name: 'موقع ثانٍ في دمشق', governorateCode: 'SY02', governorateName: 'دمشق' }
];

function open(canSeeSites: boolean) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { hasPermission: () => false, hasAnyPermission: () => canSeeSites } }]
  });
  const fixture = TestBed.createComponent(StudyRequestFormDialog);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
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
