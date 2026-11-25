// 라우트와 EJS 화면에서 같이 쓰는 상수와 작은 함수들
// (app.js에서 app.locals에 등록해서 모든 화면에서 바로 쓸 수 있어요)

const STATUSES = ['준비중', '제출완료', '결과대기', '수상', '탈락'];
const CATEGORIES = ['아이디어', '창업', '개발', '디자인', '영상', '기타'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 상태별 배지 색상 클래스 (style.css의 .status-*)
const STATUS_CLASS = {
  준비중: 'status-ready',
  제출완료: 'status-submitted',
  결과대기: 'status-waiting',
  수상: 'status-won',
  탈락: 'status-lost',
};

// ───────── D-day ─────────
// c.dday: 날짜 차이(DATEDIFF), c.minutes_left: 마감까지 남은 분(TIMESTAMPDIFF)

// 'D-3', 'D-DAY', '마감'
function ddayLabel(c) {
  if (c.minutes_left < 0) return '마감';
  if (c.dday > 0) return `D-${c.dday}`;
  return 'D-DAY';
}

// 색상 클래스 (3일 이내 빨강, 7일 이내 주황, 지난 건 회색)
function ddayClass(c) {
  if (c.minutes_left < 0) return 'dday-past';
  if (c.dday <= 3) return 'dday-urgent';
  if (c.dday <= 7) return 'dday-soon';
  return '';
}

// 24시간 안 남았을 때만 '5시간 12분 남음'
function timeLeftText(c) {
  const m = c.minutes_left;
  if (m < 0 || m >= 24 * 60) return '';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}시간 ${m % 60}분 남음` : `${m}분 남음`;
}

// ───────── 날짜·시간 표시 ─────────
// DB에서 오는 값: '2026-11-27 18:00:00'

function weekday(dateTime) {
  return WEEKDAYS[new Date(`${dateTime.slice(0, 10)}T00:00:00`).getDay()];
}

// '18:00'
function formatTime(dateTime) {
  return dateTime.slice(11, 16);
}

// '2026-11-27 (금) 18:00'
function formatDateTime(dateTime) {
  return `${dateTime.slice(0, 10)} (${weekday(dateTime)}) ${formatTime(dateTime)}`;
}

// '11.27 (금) 18:00'
function shortDateTime(dateTime) {
  return `${dateTime.slice(5, 7)}.${dateTime.slice(8, 10)} (${weekday(dateTime)}) ${formatTime(dateTime)}`;
}

// 진행률(%)
function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

// 오늘 날짜 → '11월 25일 수요일'
function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

// ───────── 아이콘 (Lucide 아이콘 모양, ISC 라이선스) ─────────
// EJS에서 <%- icon('plus') %> 처럼 써요.
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
};

function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

module.exports = {
  STATUSES,
  CATEGORIES,
  WEEKDAYS,
  STATUS_CLASS,
  ddayLabel,
  ddayClass,
  timeLeftText,
  weekday,
  formatTime,
  formatDateTime,
  shortDateTime,
  percent,
  todayLabel,
  icon,
};
