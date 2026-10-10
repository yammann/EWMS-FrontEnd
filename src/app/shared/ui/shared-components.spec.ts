import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';
import { NavHistory } from '@core/services/nav-history.service';
import { MoneyPipe, QtyPipe, UtcPipe } from '@shared/pipes/format.pipes';
import { Alert } from './alert';
import { BackButton } from './back-button';
import { EmptyState } from './empty-state';
import { FormActions } from './form-actions';
import { PageHeader } from './page-header';
import { StatTile } from './stat-tile';

@Component({ template: '', standalone: true }) class Blank {}

describe('shared components', () => {
  it('Alert renders only when there is a message', async () => {
    const f = TestBed.createComponent(Alert);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.alert-error')).toBeNull();
    f.componentRef.setInput('message', 'تعذر الحفظ');
    await f.whenStable();
    expect(f.nativeElement.querySelector('.alert.alert-error[role=alert]').textContent).toContain('تعذر الحفظ');
  });

  it('EmptyState projects content and adds the panel frame on request', async () => {
    @Component({ imports: [EmptyState], template: '<app-empty-state panel>لا توجد بيانات</app-empty-state>', standalone: true }) class Host {}
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const el = f.nativeElement.querySelector('.empty-state');
    expect(el.classList.contains('panel')).toBe(true);
    expect(el.textContent).toContain('لا توجد بيانات');
  });

  it('PageHeader shows eyebrow/heading/subtitle and projected actions', async () => {
    @Component({ imports: [PageHeader], template: '<app-page-header eyebrow="الإدارة" heading="الفروع" subtitle="وصف"><button>جديد</button></app-page-header>', standalone: true }) class Host {}
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const root: HTMLElement = f.nativeElement;
    expect(root.querySelector('.eyebrow')?.textContent).toBe('الإدارة');
    expect(root.querySelector('h1')?.textContent).toBe('الفروع');
    expect(root.querySelector('p.muted')?.textContent).toBe('وصف');
    expect(root.querySelector('.header-actions button')?.textContent).toBe('جديد');
  });

  it('FormActions disables submit while busy and emits dismissed', async () => {
    const dismissed = vi.fn();
    @Component({
      imports: [FormActions], standalone: true,
      template: '<app-form-actions [busy]="busy()" [disabled]="invalid()" label="حفظ" busyLabel="جارٍ…" (dismissed)="dismissed()" />'
    }) class Host { busy = signal(false); invalid = signal(true); dismissed = dismissed; }
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const submit = () => f.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(submit().disabled).toBe(true);                    // غير صالح
    f.componentInstance.invalid.set(false); await f.whenStable();
    expect(submit().disabled).toBe(false);
    expect(submit().textContent).toBe('حفظ');
    f.componentInstance.busy.set(true); await f.whenStable();
    expect(submit().disabled).toBe(true);
    expect(submit().textContent).toBe('جارٍ…');
    (f.nativeElement.querySelector('button.ghost') as HTMLButtonElement).click();
    // الإلغاء معطّل أثناء الانشغال → لا يصدر
    expect(dismissed).not.toHaveBeenCalled();
    f.componentInstance.busy.set(false); await f.whenStable();
    (f.nativeElement.querySelector('button.ghost') as HTMLButtonElement).click();
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('StatTile shows label, value and optional hint', async () => {
    const f = TestBed.createComponent(StatTile);
    f.componentRef.setInput('label', 'متأخرة'); f.componentRef.setInput('value', 7); f.componentRef.setInput('hint', 'تجاوزت الموعد');
    await f.whenStable();
    const text = f.nativeElement.textContent;
    expect(text).toContain('متأخرة'); expect(text).toContain('7'); expect(text).toContain('تجاوزت الموعد');
  });
});

describe('format pipes', () => {
  it('UtcPipe treats timezone-less server dates as UTC', () => {
    const d = new UtcPipe().transform('2026-10-08T10:00:00')!;
    expect(d.toISOString()).toBe('2026-10-08T10:00:00.000Z');
    expect(new UtcPipe().transform(null)).toBeNull();
  });
  it('MoneyPipe/QtyPipe format numbers', () => {
    expect(new MoneyPipe().transform(12500)).toBe('12,500 ل.س');
    expect(new MoneyPipe().transform(null)).toBe('—');
    expect(new QtyPipe().transform(1.239)).toBe('1.24');
  });
});

describe('NavHistory + BackButton', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter([
      { path: '', component: Blank },
      { path: 'list', component: Blank },
      { path: 'list/:id', component: Blank, data: { back: '/list' } }
    ])]
  }));

  it('exposes the deepest route data.back as the fallback', async () => {
    const nav = TestBed.inject(NavHistory); const router = TestBed.inject(Router);
    await router.navigateByUrl('/list/5');
    expect(nav.fallback()).toBe('/list');
    await router.navigateByUrl('/list');
    expect(nav.fallback()).toBeNull();
  });

  it('goes to the fallback when the page was opened directly, else uses history', async () => {
    const nav = TestBed.inject(NavHistory); const router = TestBed.inject(Router); const location = TestBed.inject(Location);
    const back = vi.spyOn(location, 'back').mockImplementation(() => {});
    await router.navigateByUrl('/list/5');                // أول تنقل: فتح مباشر
    nav.back();
    await new Promise(r => setTimeout(r, 20));
    expect(back).not.toHaveBeenCalled();
    expect(router.url).toBe('/list');
    await router.navigateByUrl('/list/6');                // الآن يوجد تاريخ داخل التطبيق
    nav.back();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('BackButton renders only on routes that declare a back target', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/list');
    const f = TestBed.createComponent(BackButton);
    await f.whenStable();
    expect(f.nativeElement.querySelector('button')).toBeNull();
    await router.navigateByUrl('/list/9');
    await f.whenStable();
    expect(f.nativeElement.querySelector('button.back-btn')?.textContent).toContain('رجوع');
  });
});
