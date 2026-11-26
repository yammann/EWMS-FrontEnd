import { Route } from '@angular/router';
import { AppPermission } from '@core/constants/access';
import { permissionGuard } from '@core/guards/permission.guard';
import { MAINTENANCE_PRINT_ROUTES, MAINTENANCE_ROUTES } from './maintenance.routes';

const pages = (routes: Route[]): Route[] => routes.flatMap(r => [...(r.loadComponent ? [r] : []), ...pages(r.children ?? [])]);
const known = new Set<string>(Object.values(AppPermission));

describe('maintenance routes', () => {
  const all = pages([...MAINTENANCE_ROUTES, ...MAINTENANCE_PRINT_ROUTES]);

  it('guards every page with a real permission', () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
    for (const r of all) {
      expect(r.canActivate, r.path).toContain(permissionGuard);
      const needed = [r.data?.['permission'], ...(r.data?.['anyPermission'] ?? [])].filter(Boolean) as string[];
      expect(needed.length, r.path).toBeGreaterThan(0);
      for (const p of needed) expect(known.has(p), `${r.path}: ${p}`).toBe(true);
    }
  });

  it('keeps the print page out of background preloading and gives sub-pages a way back', () => {
    const print = all.find(r => r.path === 'maintenance/print/:id/:kind');
    expect(print?.data?.['noPreload']).toBe(true);
    expect(all.find(r => r.path === 'requests/:id')?.data?.['back']).toBe('/maintenance/requests');
    expect(all.find(r => r.path === 'parts/report')?.data?.['back']).toBe('/maintenance/parts');
  });

  it('loads each page component lazily', async () => {
    for (const r of all) {
      const component = await (r.loadComponent as () => Promise<unknown>)();
      expect(typeof component, r.path).toBe('function');
    }
  });
});
