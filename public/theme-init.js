// المظهر المحفوظ قبل تحميل Angular (نفس منطق ThemeService) — حتى لا تومض الألوان عند الفتح.
// ملف مستقل لا سكربت مضمّن في index.html: سياسة CSP تمنع السكربتات المضمّنة (script-src 'self').
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('ewms_appearance') || 'null') || {};
    var root = document.documentElement;
    if (/^(forest|wheat|charcoal|umber)$/.test(saved.palette)) root.setAttribute('data-theme', saved.palette);
    if (saved.mode === 'light' || saved.mode === 'dark') root.setAttribute('data-mode', saved.mode);
  } catch (e) { /* التخزين غير متاح */ }
})();
