import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DeviceService } from '../../core/services/device.service';

/** تنقل بين صفحات توثيق الأجهزة + تنبيه وضع المشاهدة */
@Component({
  selector: 'app-devices-nav', standalone: true, imports: [RouterLink, RouterLinkActive],
  template: `
    <a class="back" routerLink="/">→ العودة للوحة المتابعة</a>
    <nav class="subnav" aria-label="توثيق الأجهزة">
      <a routerLink="/devices/installations" routerLinkActive="active">التركيبات</a>
      <a routerLink="/devices/regions" routerLinkActive="active">المناطق</a>
      <a routerLink="/devices/sites" routerLinkActive="active">المواقع</a>
      <a routerLink="/devices/catalog" routerLinkActive="active">الأجهزة</a>
    </nav>
    @if (!access().canManage) { <p class="readonly-note">وضع المشاهدة — الإضافة والتعديل لرئيس قسم العمليات</p> }`,
  styleUrl: './devices.scss',
  styles: [`:host { display: grid; gap: 12px; } .back { justify-self: start; font-size: 12px; font-weight: 700; color: var(--brand-700); text-decoration: none; } .back:hover { text-decoration: underline; }`]
})
export class DevicesNav {
  access = inject(DeviceService).access;
}
