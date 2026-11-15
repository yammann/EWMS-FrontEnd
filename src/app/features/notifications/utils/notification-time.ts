import { utcDate } from '@core/utils/format';

const DAY = 86_400_000;

/** وقت الإشعار: الخادم يخزّنه UTC ويعيده بلا «Z»، فيُقرأ عبر utcDate كي لا يتأخر بفرق التوقيت (كان يظهر «منذ 3 ساعات») */
function timeOf(iso: string): number {
  return utcDate(iso)?.getTime() ?? Number.NaN;
}

/** مجموعة الإشعار في الصفحة: اليوم / أمس / أقدم (بأيام المتصفح المحلية) */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(timeOf(iso)).setHours(0, 0, 0, 0)) / DAY);
  return days <= 0 ? 'اليوم' : days === 1 ? 'أمس' : 'أقدم';
}

/** العدد مع معدوده: دقيقة، دقيقتين، 5 دقائق، 15 دقيقة */
function count(n: number, one: string, two: string, few: string): string {
  return n === 1 ? one : n === 2 ? two : `${n} ${n <= 10 ? few : one}`;
}

/** «منذ 5 دقائق» للأحدث من يوم، وإلا نص فارغ فيُعرض التاريخ والوقت */
export function ago(iso: string, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - timeOf(iso)) / 60_000);
  if (Number.isNaN(mins)) return '';
  if (mins < 1) return 'الآن';
  if (mins < 60) return 'منذ ' + count(mins, 'دقيقة', 'دقيقتين', 'دقائق');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return 'منذ ' + count(hours, 'ساعة', 'ساعتين', 'ساعات');
  return '';
}
