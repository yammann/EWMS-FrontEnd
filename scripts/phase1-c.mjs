import { migrateTemplates } from './codemod-move.mjs';

// تنبيه الخطأ: @if (x()) { <p class="alert alert-error" role="alert">{{ x() }}</p> }  →  <app-alert [message]="x()" />
const a = migrateTemplates({
  tag: 'app-alert', cls: 'Alert', importLine: "import { Alert } from '@shared/ui/alert';",
  skip: ['request-print-page.ts', 'vacation-print-page.ts'],
  transform: c => c.replace(/@if \(([\w.]+\(\))\) \{ ?<p class="alert alert-error" role="alert">\{\{ \1 \}\}<\/p> ?\}/g, '<app-alert [message]="$1" />')
});
console.log('alert', a);

// الحالة الفارغة النصية فقط
const e = migrateTemplates({
  tag: 'app-empty-state', cls: 'EmptyState', importLine: "import { EmptyState } from '@shared/ui/empty-state';",
  skip: ['notifications-page.ts', 'todo-list-page.ts', 'todo-lists-page.ts'],
  transform: c => c
    .replace(/<p class="empty-state"(?: role="status")?>([^<]*(?:\{\{[^}]*\}\}[^<]*)*)<\/p>/g, '<app-empty-state>$1</app-empty-state>')
    .replace(/<div class="(panel )?empty-state"(?: role="status")?>([^<]*(?:\{\{[^}]*\}\}[^<]*)*)<\/div>/g, (m, p, t) => `<app-empty-state${p ? ' panel' : ''}>${t}</app-empty-state>`)
});
console.log('empty', e);
