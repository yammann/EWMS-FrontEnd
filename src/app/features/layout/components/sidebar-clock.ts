import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';

/** أرقام مشرقية وأسماء أشهر بلاد الشام («٢٣ تشرين الثاني ٢٠٢٦») كما في التصميم المعتمد (2026-11-23) */
const LOCALE = 'ar-SY';
const dayName = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const fullDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const hourDigits = new Intl.NumberFormat(LOCALE, { useGrouping: false });
const minuteDigits = new Intl.NumberFormat(LOCALE, { minimumIntegerDigits: 2, useGrouping: false });

/**
 * ساعة رأس القائمة الجانبية (تصميم المستخدم 2026-11-23): بين الشعار والوقت خط فاصل عليه نجمة هي عدّاد الثواني،
 * تنزل من أول الخط عند الثانية 0 إلى آخره عند 59 ثم تعود. الوقت بنظام 12 ساعة، وتحته «مساء الاثنين» ثم التاريخ.
 * rail (القائمة مطوية): الفاصل أفقي تحت الشعار والنجمة تعبره من اليمين، والوقت وحده مع «صباحاً/مساءً».
 * التحديث عند بداية كل ثانية من ساعة الجهاز؛ وحده يُعاد رسمه كل ثانية لا القائمة كلها.
 */
@Component({
  selector: 'app-sidebar-clock',
  standalone: true,
  templateUrl: './sidebar-clock.html',
  styleUrl: './sidebar-clock.scss',
  host: { '[class.rail]': 'rail()', '[class.new-minute]': 'seconds() === 0', '[style.--sec]': 'secFraction()' }
})
export class SidebarClock {
  readonly rail = input(false);

  private readonly now = signal(new Date());
  readonly seconds = computed(() => this.now().getSeconds());
  /** موضع النجمة على الخط: 0 أوله و1 آخره */
  readonly secFraction = computed(() => this.seconds() / 59);
  readonly time = computed(() => `${hourDigits.format(this.now().getHours() % 12 || 12)}:${minuteDigits.format(this.now().getMinutes())}`);
  private readonly morning = computed(() => this.now().getHours() < 12);
  readonly dayPart = computed(() => `${this.morning() ? 'صباح' : 'مساء'} ${dayName.format(this.now())}`);
  readonly period = computed(() => this.morning() ? 'صباحاً' : 'مساءً');
  readonly date = computed(() => fullDate.format(this.now()));
  readonly isoMinute = computed(() => this.now().toISOString().slice(0, 16) + 'Z');

  constructor() {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      this.now.set(new Date());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = setTimeout(tick, 1000 - (Date.now() % 1000));
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
