import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * أيقونات التطبيق الموحّدة: خطية 24×24 بأسلوب SF Symbols (أطراف دائرية) مرسومة للمشروع — بلا مكتبة ولا ترخيص خارجي
 * (أيقونات Apple الأصلية لا يجيز ترخيصها الاستعمال خارج تطبيقات أجهزة Apple). تأخذ لون النص فتتبع الثيمات والوضع الداكن.
 * لا Emoji في الواجهة: أي رمز جديد = أيقونة هنا. الاسم → عناصر SVG.
 */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r="1"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  landmark: '<path d="m3 9 9-6 9 6M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 8 7.5 9 4.3-1 7.5-4.5 7.5-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  logout: '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 16 6 12l4-4M6 12h10"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18A9 9 0 0 0 12 3Z" fill="currentColor"/>',
  map: '<path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5Z"/><path d="M9 4v13.5M15 6.5V20"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/><path d="M17.5 8h1M17.5 11h1"/>',
  // أيقونات أقسام السايدبار المطوي (2026-10-13): لكل قسم أيقونته، تحتها سهم الانسدال
  suitcase: '<rect x="5.5" y="7" width="13" height="12" rx="2.2"/><path d="M9.5 7V4.5h5V7M10 10.5v5M14 10.5v5M8.5 19v1.5M15.5 19v1.5"/>',
  toolbox: '<rect x="3" y="8" width="18" height="12" rx="2.2"/><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18M10 11.5v3M14 11.5v3"/>',
  placeGround: '<path d="M12 14.5s-4.8-4.3-4.8-8.1a4.8 4.8 0 0 1 9.6 0c0 3.8-4.8 8.1-4.8 8.1Z"/><circle cx="12" cy="6.4" r="1.7"/><path d="M6.5 15.5C4.4 16.1 3 17 3 18c0 1.7 4 3 9 3s9-1.3 9-3c0-1-1.4-1.9-3.5-2.5"/>',
  serverRack: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h4M12 16.5h4"/>',
  folderChart: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M8.5 16.5v-2.5M12 16.5v-5M15.5 16.5v-3.5"/>',
  orgChart: '<rect x="9" y="3" width="6" height="5" rx="1.5"/><rect x="3" y="16" width="6" height="5" rx="1.5"/><rect x="15" y="16" width="6" height="5" rx="1.5"/><path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>',
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8.5 8.5a2.1 2.1 0 0 1-3-3L18 10"/><path d="M14.5 6.5 17 4a5.5 5.5 0 0 0-7.2 7.2L3.6 17.4a2.1 2.1 0 0 0 3 3l6.2-6.2"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17.5h2"/>',
  puzzle: '<path d="M10 4.5a2 2 0 1 1 4 0V6h4a1 1 0 0 1 1 1v4h-1.5a2 2 0 1 0 0 4H19v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 1 0-4 0V20H6a1 1 0 0 1-1-1v-4h1.5a2 2 0 1 0 0-4H5V7a1 1 0 0 1 1-1h4Z"/>',
  beach: '<path d="M3.5 12a8.5 8.5 0 0 1 17 0Z"/><path d="M12 3.5c-2 2.3-3 5.1-3 8.5M12 3.5c2 2.3 3 5.1 3 8.5"/><path d="M12 12v6.2"/><path d="M4 21c2.3-1.8 5-2.8 8-2.8s5.7 1 8 2.8"/>',
  plug: '<path d="M9 3v4M15 3v4"/><path d="M6.5 7h11v3a5.5 5.5 0 0 1-11 0Z"/><path d="M12 15.5V21"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.5-3.7-9S9.6 5.5 12 3Z"/>',
  mappin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeSlash: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  warning: '<path d="M10.3 4.2 2.8 17.5a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4.5"/><path d="M12 17.3h.01"/>',
  printer: '<path d="M7 8V3.5h10V8"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v6.5H7Z"/><path d="M17.2 11h.01"/>',
  docText: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4.5h4.5"/><path d="M8.5 12h7M8.5 15.5h7M8.5 8.5h3"/>',
  note: '<path d="M11 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-5"/><path d="M17.5 3.5a1.8 1.8 0 0 1 2.5 2.5l-7.5 7.5-3 1 1-3Z"/>',
  hammer: '<path d="m14 9-9.4 9.4a1.6 1.6 0 0 0 2.3 2.3L16.3 11.3"/><path d="M10.5 6.5 14 3l7 7-3.5 3.5Z"/>',
  photo: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15.5-4.5-4.5L7 19.5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M3 14.5h18M9 9.5V20"/>',
  presentation: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8.5 20h7"/><path d="m10.5 7.5 4 2.5-4 2.5Z"/>',
  ruler: '<path d="M4 20V4l16 16Z"/><path d="M8 16v-4l4 4Z"/><path d="M4 8h2M4 12h2"/>',
  zip: '<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M12 3v1.5M12 6.5V8M12 10v1.5"/><rect x="10.5" y="13.5" width="3" height="4" rx="1"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  paperclip: '<path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  trash: '<path d="M4 6.5h16"/><path d="M9.5 6.5v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="M6 6.5 7 19a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8l1-12.5"/><path d="M10 10.5v6M14 10.5v6"/>',
  bubble: '<path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L4.5 20l1.2-3.7C4.3 15 3.5 13.1 3.5 11c0-3.9 3.8-7 8.5-7Z"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 10.5v-5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 12V9a1.5 1.5 0 0 1 3 0v5.5a6.5 6.5 0 0 1-6.5 6.5h-1a6 6 0 0 1-4.8-2.4L4.3 15.6a1.5 1.5 0 0 1 2.3-1.9L8 15.2V12"/>',
  pencil: '<path d="M15.5 4.5 19.5 8.5 8.5 19.5h-4v-4Z"/><path d="m13 7 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrows: '<path d="M4 8h15m-3.5-3.5L19 8l-3.5 3.5"/><path d="M20 16H5m3.5 3.5L5 16l3.5-3.5"/>',
  undo: '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
  forward: '<path d="m15 14 5-5-5-5"/><path d="M20 9h-9.5A5.5 5.5 0 0 0 5 14.5V20"/>',
  stack: '<rect x="3" y="9" width="18" height="12" rx="2.5"/><path d="M5.5 6h13M8 3h8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  repeat: '<path d="m17 3 3 3-3 3"/><path d="M4 11.5V10a4 4 0 0 1 4-4h12"/><path d="m7 21-3-3 3-3"/><path d="M20 12.5V14a4 4 0 0 1-4 4H4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
  starFill: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill="currentColor"/>',
  pin: '<path d="M9 3.5h6l-1 5 3 3.5H7l3-3.5Z"/><path d="M12 12v8.5"/>',
  checklist: '<path d="m4 6.5 1.5 1.5 3-3M4 13.5 5.5 15l3-3"/><path d="M11.5 7h8.5M11.5 14h8.5M11.5 19.5h8.5M5.8 19.5h.01"/>',
  checkmark: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  xmark: '<path d="M6 6l12 12M18 6 6 18"/>',
  sparkles: '<path d="M10 3.5 11.6 8.4 16.5 10l-4.9 1.6L10 16.5 8.4 11.6 3.5 10l4.9-1.6Z"/><path d="m18 14 .8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8Z"/>',
  cart: '<path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z"/><path d="M12 6.5V20"/>',
  airplane: '<path d="M10.5 4a1.5 1.5 0 0 1 3 0v5l7 4v2l-7-2v4.5l2.5 2V21L12 20l-4 1v-1.5l2.5-2V13l-7 2v-2l7-4Z"/>',
  lightbulb: '<path d="M9 17.5h6"/><path d="M10 20.5h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.5 1 1.3 1 2.1v1.8h5.6v-1.8c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
  truck: '<path d="M2.5 5.5h11v11h-11Z"/><path d="M13.5 9h4l3 3.5v4h-7Z"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19"/>',
  folder: '<path d="M3 8V6a1.5 1.5 0 0 1 1.5-1.5h4.4l2 2.5h8.6A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z"/><path d="M3 10.5h18"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 6.5h7v3h-7Z"/><path d="M8.7 13h.01M12 13h.01M15.3 13h.01M8.7 16.5h.01M12 16.5h.01M15.3 16.5h.01"/>',
  phone: '<path d="M5 3.5h3.5L10 8 7.8 9.5a11 11 0 0 0 6.7 6.7l1.5-2.2 4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16 16 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5Z"/>',
  cone: '<path d="M9.5 4h5l4 15.5h-13Z"/><path d="M8.3 9.5h7.4M7 14.5h10"/><path d="M3.5 20h17"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  idCard: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M14.5 10h3.5M14.5 13.5h3.5"/>',
  smartphone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.3h.01"/>',
  textLines: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  trend: '<path d="M3.5 3.5v17h17"/><path d="m7.5 15.5 4-5 3 3 5-7"/>',
  eraser: '<path d="m7.5 20.5-4-4a1.5 1.5 0 0 1 0-2.1L14 3.9a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L10 20.5Z"/><path d="m9 9.5 5.5 5.5M10 20.5h10.5"/>',
  listPlus: '<path d="M4 6h10M4 12h10M4 18h6"/><path d="M18 14v6M15 17h6"/>',
  alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M4 5.5 6.5 3M20 5.5 17.5 3"/>',
  hourglass: '<path d="M6.5 3h11M6.5 21h11"/><path d="M7.5 3v2.5a4.5 4.5 0 0 0 2 3.7L12 11l2.5-1.8a4.5 4.5 0 0 0 2-3.7V3"/><path d="M7.5 21v-2.5a4.5 4.5 0 0 1 2-3.7L12 13l2.5 1.8a4.5 4.5 0 0 1 2 3.7V21"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2 2"/><path d="M10 2.5h4M12 2.5V6M18.5 6.5 20 5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  turnUp: '<path d="m8 8 4-4 4 4"/><path d="M12 4v9a5 5 0 0 0 5 5h3"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * أيقونات مخزّنة كـ Emoji في البيانات (أيقونة «مهمة العمل» وقائمة «مفكرتي» — حقل نصي قصير في القاعدة —
 * وأيقونات «آخر الإجراءات» القادمة من الخادم):
 * تبقى القيمة كما هي وتُعرض بالأيقونة المقابلة. أداة الاختيار تعرض الأيقونات وتحفظ المفتاح نفسه.
 */
const STORED: Record<string, IconName> = {
  '📋': 'clipboard', '📦': 'box', '🧾': 'docText', '📊': 'chart', '🛠️': 'hammer', '🛠': 'hammer', '💻': 'laptop', '🚚': 'truck',
  '🔧': 'wrench', '📁': 'folder', '🧮': 'calculator', '🗂️': 'stack', '🗂': 'stack', '📞': 'phone', '📝': 'note', '📌': 'pin',
  '🏠': 'home', '💼': 'briefcase', '🛒': 'cart', '📚': 'book', '✈️': 'airplane', '✈': 'airplane', '💡': 'lightbulb', '🎯': 'target', '👤': 'user'
};

/** أيقونة قيمة مخزّنة (Emoji قديم أو اسم أيقونة)، وإلا الافتراضية */
export function iconFor(value: string | null | undefined, fallback: IconName = 'clipboard'): IconName {
  if (!value) return fallback;
  if (Object.prototype.hasOwnProperty.call(ICONS, value)) return value as IconName;
  return STORED[value] ?? fallback;
}

/**
 * <app-icon name="lock" /> — الحجم 18px افتراضياً، أو [size] بالبكسل، أو من CSS الأب (`.x app-icon { width; height }`).
 * [weight] سماكة الخط (1.8 افتراضياً؛ 2–2.2 للأحجام الصغيرة جداً).
 */
@Component({
  selector: 'app-icon', standalone: true,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="weight()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="markup()"></svg>`,
  styles: [`:host { display: inline-grid; width: 18px; height: 18px; flex: none; vertical-align: -0.2em; } svg { width: 100%; height: 100%; }`],
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' }
})
export class Icon {
  name = input.required<IconName>();
  size = input<number | null>(null);
  weight = input(1.8);
  private sanitizer = inject(DomSanitizer);
  /** نصوص ثابتة من هذا الملف فقط (لا مدخلات مستخدم) — آمنة للإدراج */
  protected markup = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]));
}
