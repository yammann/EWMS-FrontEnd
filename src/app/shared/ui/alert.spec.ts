import { TestBed } from '@angular/core/testing';
import { Alert } from './alert';

describe('Alert inside a scrolling dialog', () => {
  afterEach(() => vi.restoreAllMocks());

  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  it('scrolls itself into view when a message appears, so an error is not missed after scrolling down', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const fixture = TestBed.createComponent(Alert);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    await flush();
    expect(scrollIntoView).not.toHaveBeenCalled();                    // بلا رسالة لا تمرير

    fixture.componentRef.setInput('message', 'تاريخ التسليم لا يمكن أن يكون في الماضي');
    fixture.detectChanges();
    await flush();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect((fixture.nativeElement as HTMLElement).querySelector('.alert-error')?.textContent).toContain('الماضي');
  });

  it('draws nothing for an empty message', () => {
    const fixture = TestBed.createComponent(Alert);
    fixture.componentRef.setInput('message', null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.alert')).toBeNull();
  });
});
