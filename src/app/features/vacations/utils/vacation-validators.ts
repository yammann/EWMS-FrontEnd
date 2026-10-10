import { AbstractControl } from '@angular/forms';

export function vacationDateRange(control: AbstractControl) {
  const { startVac, endVac } = control.value;
  return startVac && endVac && endVac < startVac ? { dateRange: true } : null;
}
