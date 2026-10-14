import { AbstractControl } from '@angular/forms';
import { localDateInput } from '@core/utils/format';

/** لا تقديم بأثر رجعي، واليوم الحالي مسموح (قرار المستخدم 2026-10-04) */
export function notInPast(control: AbstractControl) {
  return control.value && control.value < localDateInput() ? { past: true } : null;
}

export function vacationDateRange(control: AbstractControl) {
  const { startVac, endVac } = control.value;
  return startVac && endVac && endVac < startVac ? { dateRange: true } : null;
}
