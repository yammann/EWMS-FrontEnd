import { Pipe, PipeTransform } from '@angular/core';
import { money, qty, utcDate } from '@core/utils/format';

/** تاريخ UTC قادم من الخادم بلا منطقة زمنية → Date محلي (يُستعمل قبل date) */
@Pipe({ name: 'utc', standalone: true })
export class UtcPipe implements PipeTransform {
  transform(value: string | null | undefined): Date | null { return utcDate(value); }
}

/** مبلغ بالليرة السورية: 12,500 ل.س */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return money(value); }
}

/** كمية بخانتين عشريتين على الأكثر */
@Pipe({ name: 'qty', standalone: true })
export class QtyPipe implements PipeTransform {
  transform(value: number): string { return qty(value); }
}
