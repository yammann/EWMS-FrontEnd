import { migrateTemplates } from './codemod-move.mjs';

// <header class="page-header"><div><span class="eyebrow">E</span><h1>T</h1>[<p class="muted">S</p>]</div>[actions]</header>
// النص ثابت أو فيه {{ تعبير }} بلا علامات اقتباس مزدوجة (يصير attribute interpolation)
const TXT = String.raw`((?:[^<{}"]|\{\{[^}"]*\}\})*)`;
const re = new RegExp(
  String.raw`<header class="page-header">\s*<div>\s*<span class="eyebrow">` + TXT + String.raw`<\/span>\s*<h1>` + TXT + String.raw`<\/h1>\s*` +
  String.raw`(?:<p class="(?:muted|header-sub)">` + TXT + String.raw`<\/p>\s*)?<\/div>\s*` +
  String.raw`(?:<div class="header-actions">([\s\S]*?)\s*<\/div>|((?:<(?:button|a)\b(?:(?!<div)[\s\S])*?)))?\s*<\/header>`, 'g');

const r = migrateTemplates({
  tag: 'app-page-header', cls: 'PageHeader', importLine: "import { PageHeader } from '@shared/ui/page-header';",
  skip: ['dashboard/', 'shared/ui/page-header.ts'],
  transform: c => c.replace(re, (m, e, t, s, wrapped, direct) => {
    const actions = wrapped ?? direct;
    if (actions && /<div/.test(actions)) return m;
    const attrs = `eyebrow="${e.trim()}" heading="${t.trim()}"${s ? ` subtitle="${s.trim()}"` : ''}`;
    return actions && actions.trim()
      ? `<app-page-header ${attrs}>\n${actions.trim().replace(/^/gm, '        ')}\n      </app-page-header>`
      : `<app-page-header ${attrs} />`;
  })
});
console.log(r);
