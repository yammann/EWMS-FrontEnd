import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * قواعد عناوين الشبكة (مطابقة لـ Application/Common/NetworkRules.cs في الباكاند — غيّرهما معاً):
 * IPv4 بلا أصفار بادئة، قناع شبكة متصل، بوابة في شبكة الجهاز، وMAC بصيغة موحّدة.
 */
const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export const isIpv4 = (value: string | null | undefined) => !!value && IPV4.test(value.trim());

const toUInt = (ip: string) => ip.trim().split('.').reduce((acc, part) => ((acc << 8) | Number(part)) >>> 0, 0);

/** آحاد متصلة من اليسار ثم أصفار، وليس 0.0.0.0 */
export function isSubnetMask(value: string | null | undefined): boolean {
  if (!isIpv4(value)) return false;
  const mask = toUInt(value!);
  if (mask === 0) return false;
  const inverted = (~mask) >>> 0;
  return ((inverted & (inverted + 1)) >>> 0) === 0;
}

export const sameSubnet = (ip: string, other: string, mask: string) =>
  isIpv4(ip) && isIpv4(other) && isSubnetMask(mask) && ((toUInt(ip) & toUInt(mask)) >>> 0) === ((toUInt(other) & toUInt(mask)) >>> 0);

const MAC_HEX = /^[0-9A-Fa-f]{12}$/;
export const isMac = (value: string | null | undefined) => {
  const hex = (value ?? '').replace(/[\s:\-.]/g, '');
  return hex.length === 0 || MAC_HEX.test(hex);
};

export const ipv4Validator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !c.value || isIpv4(c.value) ? null : { ipv4: true };

export const subnetValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !c.value || isSubnetMask(c.value) ? null : { subnet: true };

export const macValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => isMac(c.value) ? null : { mac: true };

/** رابط واجهة الجهاز في المتصفح من الـ IP */
export const deviceUrl = (ip: string) => `http://${ip.trim()}`;
