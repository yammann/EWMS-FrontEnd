import { Component, ElementRef, inject, signal } from '@angular/core';
import { MODES, PALETTES, ThemeService } from '@core/services/theme.service';
import { Icon } from '@shared/ui/icon';

/** زر المظهر في النافبار: لوحة الألوان (كدوائر الهوية) + فاتح/داكن/تلقائي */
@Component({
  selector: 'app-appearance-menu', standalone: true, imports: [Icon],
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'open.set(false)' },
  templateUrl: './appearance-menu.html',
  styleUrl: './appearance-menu.scss'
})
export class AppearanceMenu {
  protected theme = inject(ThemeService);
  protected palettes = PALETTES;
  protected modes = MODES;
  protected open = signal(false);
  private host = inject(ElementRef<HTMLElement>);

  protected onDocumentClick(event: Event) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
