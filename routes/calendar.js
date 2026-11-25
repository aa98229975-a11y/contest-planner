// 월별 마감 달력: 달력 보기 / 표(엑셀) 보기
// 주소 예: /calendar?month=2026-11&view=table
const express = require('express');
const pool = require('../db');
const { percent } = require('../helpers');

const router = express.Router();

const pad = (n) => String(n).padStart(2, '0');
const monthKey = (y, m) => `${y}-${pad(m)}`;
// Date → 'YYYY-MM-DD' (서버 시간대는 app.js에서 한국으로 맞춰 둠)
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 달력에 보이는 기간: 첫 주 일요일 ~ 마지막 주 토요일
// (앞뒤로 지난달·다음 달 날짜가 섞여 들어가요)
function calendarRange(year, month) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return {
    start: new Date(year, month - 1, 1 - first.getDay()),
    end: new Date(year, month - 1, last.getDate() + (6 - last.getDay())),
  };
}

// 달력 칸 만들기: 주(week) 배열 안에 7일씩
function buildWeeks(year, month, contests) {
  const byDate = {};
  contests.forEach((c) => {
    const date = c.deadline.slice(0, 10);
    (byDate[date] = byDate[date] || []).push(c);
  });

  const { start, end } = calendarRange(year, month);
  const today = ymd(new Date());
  const weeks = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) weeks.push([]);
    const date = ymd(d);
    weeks[weeks.length - 1].push({
      day: d.getDate(),
      month: d.getMonth() + 1,
      date,
      dow: d.getDay(),
      isToday: date === today,
      isOtherMonth: d.getMonth() !== month - 1, // 지난달·다음 달 칸은 흐리게
      items: byDate[date] || [],
    });
  }
  return weeks;
}

router.get('/calendar', async (req, res) => {
  const view = req.query.view === 'table' ? 'table' : 'calendar';

  // ?month=2026-11 이 없거나 이상하면 이번 달
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const m = /^(\d{4})-(\d{2})$/.exec(req.query.month || '');
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    year = Number(m[1]);
    month = Number(m[2]);
  }

  const prev = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
  const next = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);

  // 달력에 보이는 전체 기간(앞뒤 달 일부 포함)의 마감을 한 번에 가져오기
  const { start, end } = calendarRange(year, month);
  const afterEnd = new Date(end);
  afterEnd.setDate(afterEnd.getDate() + 1);

  const [rows] = await pool.query(
    `SELECT c.*,
            DATEDIFF(c.deadline, CURDATE())          AS dday,
            TIMESTAMPDIFF(MINUTE, NOW(), c.deadline) AS minutes_left,
            COUNT(t.id)                              AS total,
            IFNULL(SUM(t.is_done), 0)                AS done
       FROM contests c
       LEFT JOIN tasks t ON t.contest_id = c.id
      WHERE c.user_id = ?
        AND c.deadline >= ? AND c.deadline < ?
      GROUP BY c.id
      ORDER BY c.deadline`,
    [req.session.user.id, ymd(start), ymd(afterEnd)]
  );

  // 표 보기와 '이번 달 마감 N건'은 이번 달 것만
  const contests = rows.filter((c) => c.deadline.startsWith(monthKey(year, month)));

  // 표 보기 맨 아래 '평균 진행률' (체크리스트가 있는 공모전만)
  const withTasks = contests.filter((c) => c.total > 0);
  const avgProgress = withTasks.length
    ? Math.round(withTasks.reduce((sum, c) => sum + percent(c.done, c.total), 0) / withTasks.length)
    : null;

  res.render('calendar', {
    title: `${year}년 ${month}월 마감 달력`,
    view,
    year,
    month,
    current: monthKey(year, month),
    prev,
    next,
    weeks: buildWeeks(year, month, rows),
    contests,
    avgProgress,
  });
});

module.exports = router;
