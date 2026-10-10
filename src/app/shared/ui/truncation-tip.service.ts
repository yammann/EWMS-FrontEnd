import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * تعليق النص الكامل للمقصوص (قرار المستخدم 2026-10-08): أي نص مقصوص بنقاط (…) أو بعدد أسطر محدد يُظهر
 * نصّه الكامل عند التأشير عليه (أو عند التركيز عليه بلوحة المفاتيح)، في كل الصفحات دون وسم كل عنصر.
 * - يبحث عن العنصر المقصوص فعلاً (text-overflow: ellipsis أو -webkit-line-clamp مع تجاوز المحتوى) في الهدف وأجداده القريبين.
 * - وعند التأشير على بطاقة صغيرة (≤ 12 عنصراً داخلها) تُعرض نصوص أبنائها المقصوصة كلها.
 * - لا يتدخل في ما له title، ولا في حقول الإدخال. يُشغَّل مرة واحدة من الإطار العام (start).
 */
@Injectable({ providedIn: 'root' })
export class TruncationTipService {
  private doc = inject(DOCUMENT);
  private tip: HTMLElement | null = null;
  private owner: Element | null = null;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    const d = this.doc;
    d.addEventListener('mouseover', e => this.consider(e.target as Element | null), true);
    d.addEventListener('focusin', e => this.consider(e.target as Element | null), true);
    d.addEventListener('mouseout', e => { if (this.owner && !this.owner.contains(e.relatedTarget as Node | null)) this.hide(); }, true);
    d.addEventListener('focusout', () => this.hide(), true);
    for (const type of ['scroll', 'mousedown', 'keydown', 'wheel'] as const) d.addEventListener(type, () => this.hide(), true);
  }

  private truncated(el: Element): boolean {
    if (!(el instanceof HTMLElement) || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return false;
    if (el.hasAttribute('title')) return false;
    const cs = getComputedStyle(el);
    const clamp = cs.getPropertyValue('-webkit-line-clamp');
    if (cs.textOverflow !== 'ellipsis' && (!clamp || clamp === 'none')) return false;
    return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  }

  private consider(target: Element | null) {
    if (!target || target.closest('.truncation-tip')) return;
    // 1) العنصر نفسه أو أجداده القريبون
    let el: Element | null = target;
    for (let i = 0; el && el !== this.doc.body && i < 4; i++, el = el.parentElement) {
      if (this.truncated(el)) { this.show(el, (el as HTMLElement).innerText.trim()); return; }
    }
    // 2) بطاقة صغيرة: نصوص أبنائها المقصوصة
    const descendants = target.querySelectorAll('*');
    if (descendants.length && descendants.length <= 12) {
      const texts = [...descendants].filter(c => this.truncated(c)).map(c => (c as HTMLElement).innerText.trim()).filter(Boolean);
      if (texts.length) { this.show(target, [...new Set(texts)].join('\n')); return; }
    }
    this.hide();
  }

  private show(owner: Element, text: string) {
    if (!text) { this.hide(); return; }
    if (this.owner === owner && this.tip?.textContent === text) return;
    const tip = this.tip ?? this.create();
    tip.textContent = text;
    tip.style.display = 'block';
    this.owner = owner;

    const rect = owner.getBoundingClientRect();
    const margin = 8;
    const width = tip.offsetWidth, height = tip.offsetHeight;
    const above = rect.top - height - margin >= margin;
    const top = above ? rect.top - height - margin : Math.min(rect.bottom + margin, window.innerHeight - height - margin);
    const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - margin);
    tip.style.top = `${Math.max(margin, top)}px`;
    tip.style.left = `${left}px`;
  }

  private hide() {
    if (this.tip) this.tip.style.display = 'none';
    this.owner = null;
  }

  private create(): HTMLElement {
    const tip = this.doc.createElement('div');
    tip.className = 'truncation-tip';
    tip.setAttribute('role', 'tooltip');
    Object.assign(tip.style, {
      position: 'fixed', zIndex: '2000', display: 'none', maxWidth: 'min(380px, 90vw)', padding: '8px 12px', borderRadius: 'var(--radius-md)',
      background: 'var(--ink-900)', color: 'var(--surface)', fontSize: '12.5px', lineHeight: '1.7', fontWeight: '600', whiteSpace: 'pre-line',
      overflowWrap: 'anywhere', boxShadow: 'var(--shadow-xl)', pointerEvents: 'none', direction: 'rtl', textAlign: 'start'
    } as Partial<CSSStyleDeclaration>);
    this.doc.body.appendChild(tip);
    return (this.tip = tip);
  }
}
