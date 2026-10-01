import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** أيقونات خطية بسيطة (24×24، stroke) بأسلوب SF Symbols — الاسم → عناصر SVG */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r="1"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  landmark: '<path d="m3 9 9-6 9 6M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 8 7.5 9 4.3-1 7.5-4.5 7.5-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  logout: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 16 6 12l4-4M6 12h10"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18A9 9 0 0 0 12 3Z" fill="currentColor"/>',
  map: '<path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5Z"/><path d="M9 4v13.5M15 6.5V20"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/><path d="M17.5 8h1M17.5 11h1"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8.5 8.5a2.1 2.1 0 0 1-3-3L18 10"/><path d="M14.5 6.5 17 4a5.5 5.5 0 0 0-7.2 7.2L3.6 17.4a2.1 2.1 0 0 0 3 3l6.2-6.2"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>'
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon', standalone: true,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="markup()"></svg>`,
  styles: [`:host { display: inline-grid; width: 18px; height: 18px; flex: none; } svg { width: 100%; height: 100%; }`]
})
export class Icon {
  name = input.required<IconName>();
  private sanitizer = inject(DomSanitizer);
  /** نصوص ثابتة من هذا الملف فقط (لا مدخلات مستخدم) — آمنة للإدراج */
  protected markup = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]));
}
