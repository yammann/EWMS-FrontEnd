import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { StudyItem, StudyItemInput } from '../data-access/studies.models';

/** سطر «بند وكمية وملاحظة» (الموارد اللوجستية في الرد، وموارد أمر البدء) */
export type ItemRow = FormGroup<{ item: FormControl<string>; quantity: FormControl<number>; note: FormControl<string> }>;

export function itemRow(fb: FormBuilder, value?: StudyItem | null): ItemRow {
  return fb.nonNullable.group({
    item: [value?.item ?? '', [Validators.required, Validators.maxLength(200)]],
    quantity: [value?.quantity ?? 1, [Validators.required, Validators.min(0)]],
    note: [value?.note ?? '', Validators.maxLength(500)]
  });
}

export function itemValue(row: ItemRow): StudyItemInput {
  const v = row.getRawValue();
  return { item: v.item.trim(), quantity: v.quantity, note: v.note.trim() || null };
}

/** نص اختياري: فارغ = null */
export const optional = (value: string | null | undefined) => value?.trim() || null;
