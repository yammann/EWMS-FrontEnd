import { Component, computed, input } from '@angular/core';
import { ICON_NAMES, ICON_SPRITE, IconName } from './icon-names';

/**
 * أيقونات التطبيق الموحّدة: خطية 24×24 بأسلوب SF Symbols (أطراف دائرية) مرسومة للمشروع — بلا مكتبة ولا ترخيص خارجي
 * (أيقونات Apple الأصلية لا يجيز ترخيصها الاستعمال خارج تطبيقات أجهزة Apple). تأخذ لون النص فتتبع الثيمات والوضع الداكن.
 * لا Emoji في الواجهة: أي رمز جديد = أيقونة في scripts/icons/icon-paths.mjs ثم npm run icons.
 * الرسومات في ملف واحد public/icons.svg خارج حزمة JavaScript (تخفيف الحزمة الأولى، 2026-10-14): يحمّله المتصفح
 * مرة ويخزّنه، وكل أيقونة <use> لرمز منه — تأخذ لون النص كما كانت.
 */
export type { IconName };
const NAMES: ReadonlySet<string> = new Set(ICON_NAMES);

/**
 * أيقونات مخزّنة كـ Emoji في البيانات (أيقونة «مهمة العمل» وقائمة «مفكرتي» — حقل نصي قصير في القاعدة —
 * وأيقونات «آخر الإجراءات» القادمة من الخادم):
 * تبقى القيمة كما هي وتُعرض بالأيقونة المقابلة. أداة الاختيار تعرض الأيقونات وتحفظ المفتاح نفسه.
 */
const STORED: Record<string, IconName> = {
  '📋': 'clipboard', '📦': 'box', '🧾': 'docText', '📊': 'chart', '🛠️': 'hammer', '🛠': 'hammer', '💻': 'laptop', '🚚': 'truck',
  '🔧': 'wrench', '📁': 'folder', '🧮': 'calculator', '🗂️': 'stack', '🗂': 'stack', '📞': 'phone', '📝': 'note', '📌': 'pin',
  '🏠': 'home', '💼': 'briefcase', '🛒': 'cart', '📚': 'book', '✈️': 'airplane', '✈': 'airplane', '💡': 'lightbulb', '🎯': 'target', '👤': 'user'
};

/** أيقونة قيمة مخزّنة (Emoji قديم أو اسم أيقونة)، وإلا الافتراضية */
export function iconFor(value: string | null | undefined, fallback: IconName = 'clipboard'): IconName {
  if (!value) return fallback;
  if (NAMES.has(value)) return value as IconName;
  return STORED[value] ?? fallback;
}

/**
 * <app-icon name="lock" /> — الحجم 18px افتراضياً، أو [size] بالبكسل، أو من CSS الأب (`.x app-icon { width; height }`).
 * [weight] سماكة الخط (1.8 افتراضياً؛ 2–2.2 للأحجام الصغيرة جداً).
 */
@Component({
  selector: 'app-icon', standalone: true,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="weight()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use [attr.href]="href()" /></svg>`,
  styles: [`:host { display: inline-grid; width: 18px; height: 18px; flex: none; vertical-align: -0.2em; } svg { width: 100%; height: 100%; }`],
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' }
})
export class Icon {
  name = input.required<IconName>();
  size = input<number | null>(null);
  weight = input(1.8);
  /** رمز الأيقونة من ملف الأيقونات */
  protected href = computed(() => ICON_SPRITE + '#' + this.name());
}
