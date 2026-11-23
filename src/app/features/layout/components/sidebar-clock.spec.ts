import { TestBed } from '@angular/core/testing';
import { SidebarClock } from './sidebar-clock';

describe('SidebarClock — ساعة رأس القائمة', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 23, 22, 3, 58, 400));   // الاثنين، العاشرة وثلاث دقائق مساءً
  });
  afterEach(() => vi.useRealTimers());

  const render = (rail = false) => {
    const f = TestBed.createComponent(SidebarClock);
    f.componentRef.setInput('rail', rail);
    f.detectChanges();
    return f;
  };
  const sec = (el: HTMLElement) => Number(el.style.getPropertyValue('--sec'));

  it('shows the time, «مساء + day» and the Levantine date in Eastern Arabic digits', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('.hm')?.textContent).toBe('١٠:٠٣');
    expect(el.querySelector('.part')?.textContent).toBe('مساء الاثنين');
    expect(el.querySelector('.date')?.textContent).toBe('٢٣ تشرين الثاني ٢٠٢٦');
    expect(el.querySelector('.period')).toBeNull();
  });

  it('moves the star with the seconds and jumps back without animation at a new minute', () => {
    const f = render();
    const el: HTMLElement = f.nativeElement;
    expect(sec(el)).toBeCloseTo(58 / 59);

    vi.advanceTimersByTime(600); f.detectChanges();                 // 22:03:59
    expect(sec(el)).toBe(1);
    expect(el.classList).not.toContain('new-minute');

    vi.advanceTimersByTime(1000); f.detectChanges();                // 22:04:00
    expect(sec(el)).toBe(0);
    expect(el.classList).toContain('new-minute');
    expect(el.querySelector('.hm')?.textContent).toBe('١٠:٠٤');
  });

  it('rail: the time with «صباحاً/مساءً» only', () => {
    const el: HTMLElement = render(true).nativeElement;
    expect(el.classList).toContain('rail');
    expect(el.querySelector('.period')?.textContent).toBe('مساءً');
    expect(el.querySelector('.date')).toBeNull();
  });

  it('stops ticking when destroyed', () => {
    const f = render();
    const clock = f.componentInstance;
    f.destroy();
    vi.advanceTimersByTime(3000);
    expect(clock.seconds()).toBe(58);
  });
});
