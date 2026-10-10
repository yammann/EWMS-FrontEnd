// قوالب الفروع/الأقسام/المكاتب: من ModalCrud إلى CrudPage (الأسماء فقط — البنية كما هي)
import fs from 'node:fs';

const must = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); return s.split(a).join(b); };
for (const feat of ['branches', 'departments', 'offices']) {
  const f = `src/app/features/${feat}/pages/${feat}-page.html`;
  let h = fs.readFileSync(f, 'utf8');
  h = must(h, '[loading]="loading()"', '[loading]="crud.busy()"');
  h = must(h, '(refresh)="load(true)"', '(refresh)="crud.refresh()"');
  h = must(h, '@if (loading()) {', '@if (crud.loading()) {');
  h = h.replace(/crud\.selected\(\)\?\.id === (\w+)\.id/g, 'crud.dialog()?.item?.id === $1.id');
  h = h.replace(/\[deleting\]="saving\(\) === 'delete-' \+ (\w+)\.id"/g, '[deleting]="crud.deletingId() === $1.id"');
  h = must(h, '@if (crud.activeModal(); as modal) {', '@if (crud.dialog(); as dlg) {');
  h = must(h, '[heading]="crud.modalTitle(modal)" [busy]="!!saving()" (closed)="crud.closeModal()"', '[heading]="title(dlg.mode)" [busy]="crud.saving()" (closed)="crud.close()"');
  h = must(h, `[mode]="modal" [form]="modal === 'create' ? createForm : editForm"`, `[mode]="dlg.mode" [form]="form" [error]="crud.formError()"`);
  h = must(h, '[saving]="saving()" (submitted)="modal === \'create\' ? crud.create() : crud.update()" (dismissed)="crud.closeModal()"', '[saving]="crud.saving() ? dlg.mode : null" (submitted)="save()" (dismissed)="crud.close()"');
  h = h.split(`[formGroup]="modal === 'create' ? createForm : editForm"`).join('[formGroup]="form"');
  h = h.split(`modal + '-`).join(`dlg.mode + '-`);
  h = h.replace(/@if \(modal === 'create' && createForm\.controls\.(\w+)\.touched && createForm\.controls\.\1\.invalid\)/g, "@if (dlg.mode === 'create' && form.controls.$1.touched && form.controls.$1.invalid)");
  if (/\bmodal\b(?![-\w])/.test(h.replace(/app-modal|\.modal|modal-body|kicker/g, ''))) console.warn(feat, 'still references modal');
  fs.writeFileSync(f, h);
  console.log(feat, 'template updated');
}
