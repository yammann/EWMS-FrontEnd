import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { PermissionPreloadStrategy } from './permission-preload.strategy';

describe('PermissionPreloadStrategy', () => {
  let user: { permissions: string[] } | null;
  let loaded: number;
  const load = (): Observable<unknown> => { loaded++; return of('ok'); };

  beforeEach(() => {
    vi.useFakeTimers();
    user = { permissions: ['ViewBranches'] }; loaded = 0;
    const has = (p: string) => user?.permissions.includes(p) ?? false;
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: () => user, hasPermission: has, hasAnyPermission: (ps: string[]) => ps.some(has) } }]
    });
  });
  afterEach(() => vi.useRealTimers());

  const run = (route: Route) => { TestBed.inject(PermissionPreloadStrategy).preload(route, load).subscribe(); vi.advanceTimersByTime(2000); };

  it('preloads routes the user may open, after a short delay', () => {
    run({ path: 'branches', data: { permission: 'ViewBranches' } });
    run({ path: 'any', data: { anyPermission: ['X', 'ViewBranches'] } });
    run({ path: 'open' });
    expect(loaded).toBe(3);
  });

  it('skips routes without permission, print routes, and signed-out users', () => {
    run({ path: 'users', data: { permission: 'ViewUsers' } });
    run({ path: 'print', data: { noPreload: true } });
    user = null;
    run({ path: 'open' });
    expect(loaded).toBe(0);
  });
});
