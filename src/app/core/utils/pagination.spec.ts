import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';

describe('Pagination (client-side lists)', () => {
  beforeEach(() => {
    try { localStorage.removeItem('ewms_page_size'); } catch { /* غير متاح */ }
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const make = (count: number) => {
    const source = signal(Array.from({ length: count }, (_, i) => i + 1));
    const pagination = TestBed.runInInjectionContext(() => new Pagination(() => source(), { size: 10 }));
    return { source, pagination };
  };

  it('slices the current page and counts pages', () => {
    const { pagination } = make(25);
    expect(pagination.items()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pagination.pages()).toBe(3);
    pagination.go(3);
    expect(pagination.items()).toEqual([21, 22, 23, 24, 25]);
  });

  it('clamps the page when the list shrinks (delete or filter)', () => {
    const { source, pagination } = make(25);
    pagination.go(3);
    source.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(pagination.page()).toBe(2);
    expect(pagination.items()).toEqual([11]);
    source.set([1]);
    expect(pagination.page()).toBe(1);
  });

  it('changing the page size resets to page 1', () => {
    const { pagination } = make(60);
    pagination.go(3);
    pagination.setSize(25);
    expect(pagination.page()).toBe(1);
    expect(pagination.items().length).toBe(25);
    expect(pagination.size()).toBe(25);
  });
});

describe('Pager component', () => {
  const render = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(Pager);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  };

  it('hides itself when one page is enough', () => {
    const fixture = render({ page: 1, pageSize: 10, total: 8 });
    expect(fixture.nativeElement.querySelector('.pager')).toBeNull();
  });

  it('shows the range and collapses long page lists with ellipses', () => {
    const fixture = render({ page: 10, pageSize: 10, total: 200 });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.range')?.textContent?.replace(/\s+/g, ' ')).toContain('91–100');
    expect(fixture.componentInstance.numbers()).toEqual([1, 0, 9, 10, 11, 0, 20]);
  });

  it('emits the clamped page only when it actually changes', () => {
    const fixture = render({ page: 1, pageSize: 10, total: 30 });
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p: number) => emitted.push(p));
    fixture.componentInstance.go(0);       // قبل الأولى → 1 = نفس الحالية فلا يصدر
    fixture.componentInstance.go(9);       // بعد الأخيرة → 3
    expect(emitted).toEqual([3]);
  });
});
