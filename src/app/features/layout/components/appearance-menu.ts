import { Component, ElementRef, inject, signal } from '@angular/core';
import { MODES, PALETTES, ThemeService } from '@core/services/theme.service';
import { Icon } from '@shared/ui/icon';

/** زر المظهر في النافبار: لوحة الألوان (كدوائر الهوية) + فاتح/داكن/تلقائي */
@Component({
  selector: 'app-appearance-menu', standalone: true, imports: [Icon],
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="top-btn" [class.active]="open()" (click)="open.set(!open())"
            aria-haspopup="dialog" [attr.aria-expanded]="open()" aria-label="المظهر" title="المظهر">
      <app-icon name="palette" />
    </button>
    @if (open()) {
      <div class="menu" role="dialog" aria-label="المظهر">
        <p class="menu-title">لوحة الألوان</p>
        <div class="swatches" role="radiogroup" aria-label="لوحة الألوان">
          @for (p of palettes; track p.id) {
            <button type="button" class="swatch" role="radio" [attr.aria-checked]="theme.palette() === p.id"
                    [class.selected]="theme.palette() === p.id" (click)="theme.setPalette(p.id)" [title]="p.name">
              <span class="dot" [style.background]="p.swatch"></span>
              <span class="swatch-label">{{ p.label }}</span>
            </button>
          }
        </div>
        <p class="menu-title">المظهر</p>
        <div class="segmented" role="radiogroup" aria-label="الوضع">
          @for (m of modes; track m.id) {
            <button type="button" role="radio" [attr.aria-checked]="theme.mode() === m.id" [class.selected]="theme.mode() === m.id"
                    (click)="theme.setMode(m.id)">
              <app-icon [name]="m.id === 'system' ? 'auto' : m.id === 'light' ? 'sun' : 'moon'" />{{ m.label }}
            </button>
          }
        </div>
      </div>
    }`,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .menu {
      position: absolute; top: calc(100% + 10px); inset-inline-end: 0; z-index: 60; width: 300px; padding: 14px;
      border: 1px solid var(--border); border-radius: var(--radius-xl);
      background: var(--material); backdrop-filter: var(--material-blur); -webkit-backdrop-filter: var(--material-blur);
      box-shadow: var(--shadow-lg); animation: menuIn .28s var(--ease-spring); transform-origin: top left;
    }
    @keyframes menuIn { from { opacity: 0; transform: scale(.94) translateY(-4px); } to { opacity: 1; transform: none; } }
    .menu-title { margin: 0 4px 8px; font-size: 12px; font-weight: 700; color: var(--ink-500); }
    .menu-title:not(:first-child) { margin-top: 14px; }
    .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .swatch {
      display: grid; justify-items: center; gap: 6px; min-height: 0; padding: 10px 4px 8px;
      border-radius: var(--radius-md); background: transparent; color: var(--ink-700);
    }
    .swatch:hover:not(:disabled) { background: var(--fill); filter: none; }
    .swatch.selected { background: var(--fill); }
    .dot { width: 28px; height: 28px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), 0 1px 3px rgba(0,0,0,.2); transition: transform .25s var(--ease-spring); }
    .swatch.selected .dot { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--brand-500); transform: scale(1.06); }
    .swatch-label { font-size: 11px; font-weight: 700; line-height: 1.3; text-align: center; }
    .segmented { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 2px; border-radius: var(--radius-sm); background: var(--fill); }
    .segmented button {
      min-height: 32px; padding: 0 6px; gap: 5px; border-radius: 8px; background: transparent; color: var(--ink-700); font-size: 12px;
    }
    .segmented button:hover:not(:disabled) { filter: none; color: var(--ink-900); }
    .segmented button.selected { background: var(--surface-raised); color: var(--ink-900); box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 0 0 .5px rgba(0,0,0,.04); }
    .segmented app-icon { width: 15px; height: 15px; }
  `]
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
