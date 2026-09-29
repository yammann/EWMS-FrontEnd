import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Palette = 'forest' | 'wheat' | 'charcoal' | 'umber';
export type AppearanceMode = 'system' | 'light' | 'dark';

export interface PaletteOption {
  id: Palette;
  label: string;
  name: string;
  /** لون الدائرة في منتقي الألوان */
  swatch: string;
}

/** لوحات الهوية البصرية (الأسماء الإنجليزية كما في دليل الهوية) */
export const PALETTES: readonly PaletteOption[] = [
  { id: 'forest', label: 'أخضر الغابة', name: 'Forest', swatch: '#054239' },
  { id: 'wheat', label: 'القمح الذهبي', name: 'Golden Wheat', swatch: '#988561' },
  { id: 'charcoal', label: 'الفحمي', name: 'Charcoal', swatch: '#161616' },
  { id: 'umber', label: 'الأحمر الترابي', name: 'Deep Umber', swatch: '#6b1f2a' }
];

export const MODES: readonly { id: AppearanceMode; label: string }[] = [
  { id: 'system', label: 'تلقائي' },
  { id: 'light', label: 'فاتح' },
  { id: 'dark', label: 'داكن' }
];

/** نفس المفتاح والمنطق في السكربت داخل index.html (يطبّق المظهر قبل تحميل Angular فلا يومض اللون) */
const STORAGE_KEY = 'ewms_appearance';
const DEFAULT = { palette: 'forest' as Palette, mode: 'system' as AppearanceMode };

/**
 * مظهر التطبيق: لوحة الألوان والوضع (فاتح/داكن/تلقائي) — لكل متصفح.
 * يُطبَّق كسمتين على &lt;html&gt;: data-theme و data-mode (بلا data-mode = يتبع النظام) — انظر styles/_tokens.scss.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly palette = signal<Palette>(DEFAULT.palette);
  readonly mode = signal<AppearanceMode>(DEFAULT.mode);

  private systemDark = signal(false);
  /** الوضع الداكن فعلياً (بعد حساب "تلقائي") */
  readonly isDark = computed(() => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()));

  constructor() {
    const saved = this.read();
    this.palette.set(saved.palette);
    this.mode.set(saved.mode);

    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    if (media) {
      this.systemDark.set(media.matches);
      const onChange = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
      media.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
    }

    effect(() => this.apply(this.palette(), this.mode(), this.isDark()));
  }

  setPalette(palette: Palette) { this.palette.set(palette); this.save(); }
  setMode(mode: AppearanceMode) { this.mode.set(mode); this.save(); }

  private apply(palette: Palette, mode: AppearanceMode, dark: boolean) {
    const root = document.documentElement;
    root.dataset['theme'] = palette;
    if (mode === 'system') delete root.dataset['mode'];
    else root.dataset['mode'] = mode;

    // لون شريط المتصفح على الجوال
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    meta?.setAttribute('content', dark ? '#000000' : '#f5f5f7');
  }

  private read(): { palette: Palette; mode: AppearanceMode } {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      return {
        palette: PALETTES.some(p => p.id === value?.palette) ? value.palette : DEFAULT.palette,
        mode: MODES.some(m => m.id === value?.mode) ? value.mode : DEFAULT.mode
      };
    } catch {
      return DEFAULT;
    }
  }

  private save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette: this.palette(), mode: this.mode() })); }
    catch { /* التخزين غير متاح — يبقى الاختيار للجلسة الحالية */ }
  }
}
