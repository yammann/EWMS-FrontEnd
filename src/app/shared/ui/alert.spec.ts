import { TestBed } from '@angular/core/testing';
import { Alert } from './alert';

describe('Alert', () => {
  afterEach(() => vi.useRealTimers());

  it('renders only a non-empty message and scrolls it into view when it appears', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Alert);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.alert')).toBeNull();

    const scroll = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
    fixture.componentRef.setInput('message', 'تعذّر الحفظ');
    fixture.detectChanges();
    vi.runAllTimers();
    expect((fixture.nativeElement as HTMLElement).querySelector('.alert')?.textContent).toContain('تعذّر الحفظ');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
