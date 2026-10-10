import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, input } from '@angular/core';
import { BranchMapComponent } from '@features/map';

/**
 * إطار لوحات المتابعة: رأس الصفحة + المحتوى، ومعهما خريطة الفرع المثبّتة لمن يملك ViewBranchMap
 * (الصفحة تنزلق فوق الخريطة أثناء التمرير). كل لوحة تعرّف قالب رأسها وجسمها وتمررهما هنا،
 * فتبقى أنماط اللوحة المحدّدة بالنطاق سارية لأن القوالب تُنشأ في سياق المكوّن الذي عرّفها.
 */
@Component({
  selector: 'app-dashboard-frame', standalone: true, imports: [NgTemplateOutlet, BranchMapComponent],
  template: `
    @if (showMap()) {
      <app-branch-map>
        <header class="page-header"><ng-container *ngTemplateOutlet="header()" /></header>
        <ng-container *ngTemplateOutlet="body()" />
      </app-branch-map>
    } @else {
      <header class="page-header"><ng-container *ngTemplateOutlet="header()" /></header>
      <ng-container *ngTemplateOutlet="body()" />
    }`,
  styles: [`:host { display: contents; }`]
})
export class DashboardFrame {
  showMap = input(false);
  header = input.required<TemplateRef<unknown>>();
  body = input.required<TemplateRef<unknown>>();
}
