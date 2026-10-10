import { migrateTemplates } from './codemod-move.mjs';

// <footer class="modal-actions"> زر إلغاء + زر إرسال بنص ثابت → <app-form-actions>
const re = /<footer class="modal-actions">\s*<button type="button" class="ghost" \(click\)="([^"]+)" \[disabled\]="(saving\(\)|busy\(\))">إلغاء<\/button>\s*<button type="submit" \[disabled\]="([^"]+)">\{\{ (?:saving\(\)|busy\(\)) \? '([^']+)' : '([^']+)' \}\}<\/button>\s*<\/footer>/g;

const r = migrateTemplates({
  tag: 'app-form-actions', cls: 'FormActions', importLine: "import { FormActions } from '@shared/ui/form-actions';",
  skip: ['shared/ui/form-actions.ts'],
  transform: c => c.replace(re, (m, cancel, flag, cond, busyLabel, label) => {
    const rest = cond.split('||').map(x => x.trim()).filter(x => x !== flag);
    if (rest.length + 1 !== cond.split('||').length) return m;      // الشرط لا يحوي مؤشر الانشغال: لا نلمسه
    const disabled = rest.length ? ` [disabled]="${rest.join(' || ')}"` : '';
    return `<app-form-actions [busy]="${flag}"${disabled} label="${label}" busyLabel="${busyLabel}" (cancel)="${cancel}" />`;
  })
});
console.log(r);
