import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';

interface Shortcut { path: string; icon: string; title: string; description: string; count: number | null; }

/**
 * مدخل توثيق الأجهزة في لوحة المتابعة (بدل القائمة الجانبية — قرار المستخدم 2026-09-28):
 * يظهر فقط في لوحات رئيس قسم العمليات وموظفيه (لا للسوبر ادمن ولا لمن مُنح ViewDevices من قسم آخر).
 */
@Component({
  selector: 'app-device-shortcuts', standalone: true, imports: [RouterLink],
  template: `
    @if (access().canView && access().inOwnerDepartment) {
      <section class="device-frame" aria-labelledby="device-frame-title">
        <header class="frame-head">
          <span class="frame-icon" aria-hidden="true">🖧</span>
          <div class="frame-title">
            <span class="kicker">قسم العمليات · الفرع التقني</span>
            <h2 id="device-frame-title">توثيق الأجهزة</h2>
            <p>{{ access().canManage ? 'إدارة ومتابعة الأجهزة المركّبة في مناطق المؤسسة' : 'الاطلاع على الأجهزة المركّبة في مناطق المؤسسة' }}</p>
          </div>
          <span class="mode" [class.manage]="access().canManage">{{ access().canManage ? 'إدارة' : 'مشاهدة' }}</span>
        </header>
        <div class="grid">
          @for (s of shortcuts(); track s.path) {
            <a class="card" [routerLink]="s.path">
              <span class="icon" aria-hidden="true">{{ s.icon }}</span>
              <span class="text">
                <strong>{{ s.title }}</strong>
                <span>{{ s.description }}</span>
              </span>
              @if (s.count !== null) { <span class="count">{{ s.count }}</span> }
            </a>
          }
        </div>
      </section>
    }`,
  styles: [`
    :host { display: block; }
    /* إطار خاص بتوثيق الأجهزة يميّزه عن باقي أقسام اللوحة */
    .device-frame { padding: 20px; border: 1px solid var(--brand-200); border-radius: var(--radius-xl); background: linear-gradient(180deg, var(--brand-50) 0%, var(--surface) 140px); box-shadow: var(--shadow-md); }
    .frame-head { display: flex; align-items: center; gap: 14px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px dashed var(--brand-200); }
    .frame-icon { flex: none; width: 48px; height: 48px; border-radius: var(--radius-lg); display: grid; place-items: center; background: var(--brand-600); color: var(--on-brand); font-size: 22px; box-shadow: 0 6px 16px var(--brand-300); }
    .frame-title { flex: 1; min-width: 0; }
    .frame-title .kicker { font-size: 11px; font-weight: 800; color: var(--brand-700); }
    .frame-title h2 { margin: 2px 0 0; font-size: 18px; }
    .frame-title p { margin: 4px 0 0; font-size: 12px; color: var(--ink-500); }
    .mode { flex: none; padding: 4px 12px; border-radius: var(--radius-full); background: var(--info-50); color: var(--info-700); font-size: 11px; font-weight: 800; border: 1px solid var(--info-300); }
    .mode.manage { background: var(--brand-600); color: var(--on-brand); border-color: transparent; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .card { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: inherit; text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease; }
    .card:hover { border-color: var(--brand-500); box-shadow: var(--shadow-md); }
    .card:focus-visible { outline: 2px solid var(--brand-600); outline-offset: 2px; }
    .icon { flex: none; width: 42px; height: 42px; border-radius: var(--radius-md); display: grid; place-items: center; background: var(--brand-50); font-size: 20px; }
    .text { flex: 1; display: grid; gap: 3px; min-width: 0; }
    .text strong { font-size: 14px; color: var(--ink-900); }
    .text span { font-size: 12px; color: var(--ink-500); line-height: 1.5; }
    .count { font-size: 22px; font-weight: 800; color: var(--ink-900); font-variant-numeric: tabular-nums; }
    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class DeviceShortcuts {
  private service = inject(DeviceService);
  access = this.service.access;

  shortcuts = signal<Shortcut[]>([
    { path: '/devices/installations', icon: '🔌', title: 'التركيبات', description: 'الأجهزة في المواقع وبيانات الاتصال', count: null },
    { path: '/devices/regions', icon: '🗺️', title: 'المناطق', description: 'مناطق المؤسسة', count: null },
    { path: '/devices/sites', icon: '📍', title: 'المواقع', description: 'مواقع التركيب داخل المناطق', count: null },
    { path: '/devices/catalog', icon: '🖧', title: 'الأجهزة', description: 'أنواع وموديلات الأجهزة', count: null }
  ]);

  constructor() {
    this.service.loadAccess().subscribe(a => {
      if (!a.canView || !a.inOwnerDepartment) return;
      forkJoin({
        installations: this.service.installations(), regions: this.service.regions(),
        sites: this.service.sites(), devices: this.service.devices()
      }).subscribe({
        next: r => {
          const counts = [r.installations.length, r.regions.length, r.sites.length, r.devices.length];
          this.shortcuts.update(list => list.map((s, i) => ({ ...s, count: counts[i] })));
        },
        error: () => { /* الأعداد اختيارية — البطاقات تعمل بدونها */ }
      });
    });
  }
}
