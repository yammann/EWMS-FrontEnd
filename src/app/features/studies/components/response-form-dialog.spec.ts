import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StudyResponseFormDialog } from './response-form-dialog';

/** حقلا مساحة الموقع والتكلفة المبدئية يجب أن يصلا إلى النموذج (كانا داخل formArrayName فضاعت قيمتهما) */
describe('StudyResponseFormDialog', () => {
  function open() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(StudyResponseFormDialog);
    fixture.componentRef.setInput('parent', { assignmentId: 1, assignmentNumber: 'IPA-26-0001', followingDepartmentName: 'قسم', branchId: 1 });
    fixture.detectChanges();
    return fixture;
  }

  it('binds the site area and initial cost inputs to the form', () => {
    const fixture = open();
    const root: HTMLElement = fixture.nativeElement;
    const type = (name: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`input[formControlName=${name}]`);
      expect(input, name).not.toBeNull();
      input!.value = value;
      input!.dispatchEvent(new Event('input'));
    };
    type('siteArea', '5200');
    type('initialCost', '22000000');
    const v = fixture.componentInstance.form.getRawValue();
    expect(v.siteArea).toBe(5200);
    expect(v.initialCost).toBe(22000000);
    TestBed.inject(HttpTestingController).match(() => true).forEach(r => r.flush([]));
  });
});
