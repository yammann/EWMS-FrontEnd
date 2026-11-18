import { money, qty } from '@core/utils/format';

export function responseMoney(value: number | null | undefined, costsInUsd: boolean | undefined): string {
  return value == null ? '—' : costsInUsd ? `${qty(value)} دولار` : money(value);
}

export function syrianEquivalent(value: number | null | undefined, rate: number | null | undefined): string {
  return value != null && rate != null && rate > 0 ? money(value * rate) : '';
}
