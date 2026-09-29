import { Component, input } from '@angular/core';
import { LOGO_PATHS, LOGO_VIEWBOX } from './logo-paths';

/**
 * شعار الهوية البصرية السورية — لونه من CSS (currentColor)، افتراضياً الذهبي --accent.
 * الحجم من CSS للعنصر نفسه (width/height).
 */
@Component({
  selector: 'app-logo', standalone: true,
  template: `
    <svg [attr.viewBox]="viewBox" fill="currentColor" role="img" [attr.aria-label]="label()">
      @for (p of paths; track $index) { <path [attr.d]="p.d" [attr.transform]="p.transform" /> }
    </svg>`,
  styles: [`:host { display: inline-block; color: var(--accent); line-height: 0; } svg { width: 100%; height: 100%; }`]
})
export class Logo {
  label = input('شعار الجمهورية العربية السورية');
  protected viewBox = LOGO_VIEWBOX;
  protected paths = LOGO_PATHS;
}
