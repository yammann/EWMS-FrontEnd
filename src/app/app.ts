import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'EWMS.Client';
  /** يطبّق المظهر المحفوظ (اللوحة + الفاتح/الداكن) على كل الصفحات بما فيها الدخول */
  /** يُحقن هنا ليبدأ عمله مع التطبيق (يطبّق الثيم ويتابع وضع النظام) — لا يُقرأ مباشرة */
  private theme = inject(ThemeService);
}