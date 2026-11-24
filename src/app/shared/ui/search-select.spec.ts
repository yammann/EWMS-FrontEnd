import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SearchSelect, SelectOption, normalizeSearch } from './search-select';

@Component({
  standalone: true, imports: [SearchSelect, SelectOption, ReactiveFormsModule],
  template: `
    <app-select id="role" [formControl]="ctrl" (change)="changes.push($event)">
      <option value="">اختر الدور</option>
      @for (r of roles(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
    </app-select>
    <app-select #yr [value]="year()" aria-label="السنة">
      @for (y of years(); track y) { <option [value]="y">{{ y }}</option> }
    </app-select>`
})
class Host {
  ctrl = new FormControl<string | null>('');
  changes: unknown[] = [];
  roles = signal([{ id: 1, name: 'رئيس الديوان' }, { id: 2, name: 'رئيس قسم إدارة التصميم' }, { id: 3, name: 'رئيس قسم دراسة المشاريع الخاصة' }]);
  year = signal<number | null>(2026);
  years = signal<number[]>([]);
}

const tick = () => new Promise<void>(r => setTimeout(r, 0));
const triggers = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.ss-trigger')];
const options = () => [...document.querySelectorAll<HTMLElement>('.ss-option')].map(o => o.textContent!.trim());
const search = () => document.querySelector<HTMLInputElement>('.ss-search-input')!;

describe('normalizeSearch', () => {
  it('ignores diacritics, hamza forms, taa marbuta and alif maqsura', () => {
    expect(normalizeSearch('إدارةُ المُشْتَرَيات')).toBe(normalizeSearch('اداره المشتريات'));
    expect(normalizeSearch('آمنة')).toBe('امنه');
    expect(normalizeSearch('مستشفى')).toBe('مستشفي');
    expect(normalizeSearch('SuperAdmin')).toBe('superadmin');
  });
});

describe('SearchSelect', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach(e => e.remove()));

  it('shows the selected option label and moves the id to the focusable trigger', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const [role] = triggers(f.nativeElement);
    expect(role.id).toBe('role');
    expect(role.getAttribute('role')).toBe('combobox');
    expect(role.textContent!.trim()).toBe('اختر الدور');
    f.componentInstance.ctrl.setValue('2');
    await f.whenStable();
    expect(role.textContent!.trim()).toBe('رئيس قسم إدارة التصميم');
  });

  it('filters with Arabic-insensitive search, selects with keyboard and updates the form', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    triggers(f.nativeElement)[0].click();
    await f.whenStable(); await tick();
    expect(options().length).toBe(4);
    expect(document.activeElement).toBe(search());

    search().value = 'ادارة';
    search().dispatchEvent(new Event('input'));
    await f.whenStable();
    expect(options()).toEqual(['رئيس قسم إدارة التصميم']);

    search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await f.whenStable();
    expect(f.componentInstance.ctrl.value).toBe('2');
    expect(f.componentInstance.changes).toEqual(['2']);
    expect(document.querySelector('.ss-panel')).toBeNull();
  });

  it('shows "no results" and closes on Escape without bubbling', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    triggers(f.nativeElement)[0].click();
    await f.whenStable(); await tick();
    search().value = 'غير موجود';
    search().dispatchEvent(new Event('input'));
    await f.whenStable();
    expect(document.querySelector('.ss-empty')?.textContent).toContain('لا توجد نتائج');

    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.removeEventListener('keydown', outer);
    await f.whenStable();
    expect(outer).not.toHaveBeenCalled();
    expect(document.querySelector('.ss-panel')).toBeNull();
  });

  it('keeps a bound [value] when options arrive later and exposes it like <select>.value', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const year = triggers(f.nativeElement)[1];
    expect(year.getAttribute('aria-label')).toBe('السنة');
    f.componentInstance.years.set([2025, 2026, 2027]);
    await f.whenStable();
    expect(year.textContent!.trim()).toBe('2026');
    const yr = f.debugElement.children[1].componentInstance as SearchSelect;
    expect(yr.value).toBe('2026');
  });

  it('respects the disabled state of the form control', async () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.ctrl.disable();
    await f.whenStable();
    const [role] = triggers(f.nativeElement);
    expect(role.disabled).toBe(true);
  });
});
