import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppNotification } from '@core/models/notification.models';
import { NotificationService, RELOAD_QUIET_MS } from './notification.service';

const note = (id: number) => ({ id, type: 'TaskAssigned', title: 'مهمة', message: '', isRead: false, createdAt: '2026-11-25T08:00:00' }) as unknown as AppNotification;

describe('NotificationService.changes$', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => vi.useRealTimers());

  it('collapses a burst of notifications into one reload after things go quiet', () => {
    const service = TestBed.inject(NotificationService);
    const reloads = vi.fn();
    const sub = service.changes$.subscribe(reloads);

    for (let i = 1; i <= 5; i++) { service.incoming$.next(note(i)); vi.advanceTimersByTime(200); }
    expect(reloads).not.toHaveBeenCalled();                 // ما زالت تصل
    vi.advanceTimersByTime(RELOAD_QUIET_MS);
    expect(reloads).toHaveBeenCalledTimes(1);
    expect(reloads).toHaveBeenLastCalledWith(expect.objectContaining({ id: 5 }));

    service.incoming$.next(note(6));                        // إشعار منفرد لاحقاً → تحميل آخر
    vi.advanceTimersByTime(RELOAD_QUIET_MS);
    expect(reloads).toHaveBeenCalledTimes(2);
    sub.unsubscribe();
  });

  it('leaves incoming$ immediate for pages that update one record', () => {
    const service = TestBed.inject(NotificationService);
    const seen = vi.fn();
    const sub = service.incoming$.subscribe(seen);
    service.incoming$.next(note(1));
    expect(seen).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
  });
});
