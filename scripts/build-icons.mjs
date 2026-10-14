// يولّد ملف أيقونات واحداً (public/icons.svg) وقائمة أسمائها للكود (src/app/shared/ui/icon-names.ts)
// من scripts/icons/icon-paths.mjs. الرسومات خارج حزمة JavaScript: يحمّل المتصفح الملف مرة ويخزّنه،
// ورقم النسخة (بصمة المحتوى) في رابطه يجبر المتصفح على النسخة الجديدة بعد أي تعديل.
// التشغيل: npm run icons
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { ICONS } from './icons/icon-paths.mjs';

const names = Object.keys(ICONS);
const symbols = names.map(name => `<symbol id="${name}" viewBox="0 0 24 24">${ICONS[name]}</symbol>`).join('');
const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>\n`;
const version = createHash('sha256').update(sprite).digest('hex').slice(0, 10);

writeFileSync(new URL('../public/icons.svg', import.meta.url), sprite);
writeFileSync(new URL('../src/app/shared/ui/icon-names.ts', import.meta.url),
`// مُولَّد بـ npm run icons من scripts/icons/icon-paths.mjs — لا تعدّله يدوياً
/** رابط ملف الأيقونات مع بصمة محتواه (يتجدّد في المتصفح عند تغيّر أي أيقونة) */
export const ICON_SPRITE = 'icons.svg?v=${version}';

export const ICON_NAMES = [
${names.map(n => `  '${n}'`).join(',\n')}
] as const;

export type IconName = typeof ICON_NAMES[number];
`);
console.log(`icons: ${names.length}, sprite ${(sprite.length / 1024).toFixed(1)} kB, v=${version}`);
