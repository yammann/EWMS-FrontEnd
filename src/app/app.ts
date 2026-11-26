import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor() {
    // يُحقن هنا ليبدأ عمله مع التطبيق: يطبّق المظهر المحفوظ (اللوحة + الفاتح/الداكن) على كل الصفحات
    // بما فيها الدخول، ويتابع وضع النظام — لا يُقرأ مباشرة
    inject(ThemeService);
  }
}