// 공모전 목록 / 등록 / 상세 / 수정 / 삭제
// 모든 쿼리에 user_id = 로그인한 사람 조건이 들어가서, 내 공모전만 보고 고칠 수 있어요.
const express = require('express');
const pool = require('../db');
const { STATUSES, CATEGORIES } = require('../helpers');

const router = express.Router();

function notFound(res) {
  return res.status(404).render('error', {
    title: '공모전을 찾을 수 없어요',
    message: '이미 삭제됐거나 내 공모전이 아니에요.',
  });
}

// :id 가 숫자가 아니면 바로 404
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return notFound(res);
  next();
});

// 날짜 검사 ('2026-02-31' 같은 없는 날짜도 걸러요)
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00`);
  return !Number.isNaN(d.getTime()) &&
    d.getFullYear() === Number(str.slice(0, 4)) &&
    d.getMonth() + 1 === Number(str.slice(5, 7)) &&
    d.getDate() === Number(str.slice(8, 10));
}

const isValidTime = (str) => /^([01]\d|2[0-3]):[0-5]\d$/.test(str);

// 폼에서 받은 값 정리: 앞뒤 공백 제거, 빈 칸은 NULL
// 마감은 날짜(deadline_date) + 시간(deadline_time) 두 칸을 합쳐서 '2026-11-27 18:00:00'으로 저장
function readContest(body) {
  const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const deadlineDate = clean(body.deadline_date) || '';
  const deadlineTime = clean(body.deadline_time) || '';
  return {
    title: clean(body.title),
    organizer: clean(body.organizer),
    category: CATEGORIES.includes(body.category) ? body.category : null,
    deadline_date: deadlineDate,
    deadline_time: deadlineTime,
    deadline: isValidDate(deadlineDate) && isValidTime(deadlineTime) ? `${deadlineDate} ${deadlineTime}:00` : null,
    status: STATUSES.includes(body.status) ? body.status : '준비중',
    url: clean(body.url),
    memo: clean(body.memo),
  };
}

// 입력값 검사 → 에러 메시지 배열 (비어 있으면 통과)
function validateContest(c) {
  const errors = [];
  if (!c.title) errors.push('공모전 이름을 입력하세요.');
  else if (c.title.length > 150) errors.push('공모전 이름은 150자까지 쓸 수 있어요.');
  if (c.organizer && c.organizer.length > 100) errors.push('주최는 100자까지 쓸 수 있어요.');
  if (!isValidDate(c.deadline_date)) errors.push('마감 날짜를 선택하세요.');
  if (!isValidTime(c.deadline_time)) errors.push('마감 시간을 선택하세요.');
  if (c.url && !/^https?:\/\//i.test(c.url)) errors.push('링크는 http:// 또는 https://로 시작해야 해요.');
  else if (c.url && c.url.length > 300) errors.push('링크는 300자까지 쓸 수 있어요.');
  return errors;
}

// 내 공모전 1개 + 남은 일수·남은 분 (없거나 남의 것이면 undefined)
async function findContest(id, userId) {
  const [rows] = await pool.query(
    `SELECT *,
            DATEDIFF(deadline, CURDATE())          AS dday,
            TIMESTAMPDIFF(MINUTE, NOW(), deadline) AS minutes_left
       FROM contests
      WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return rows[0];
}

// ───────────────────────── 목록 ─────────────────────────
// 마감 임박순 정렬 + 상태 필터 + D-day + 체크리스트 진행률
router.get('/', async (req, res) => {
  const userId = req.session.user.id;
  const status = STATUSES.includes(req.query.status) ? req.query.status : '';

  const params = [userId];
  if (status) params.push(status);

  const [contests] = await pool.query(
    `SELECT c.*,
            DATEDIFF(c.deadline, CURDATE())          AS dday,
            TIMESTAMPDIFF(MINUTE, NOW(), c.deadline) AS minutes_left,
            COUNT(t.id)                              AS total,
            IFNULL(SUM(t.is_done), 0)                AS done
       FROM contests c
       LEFT JOIN tasks t ON t.contest_id = c.id
      WHERE c.user_id = ? ${status ? 'AND c.status = ?' : ''}
      GROUP BY c.id
      ORDER BY c.deadline < NOW(), c.deadline`,
    params
  );

  const [[summary]] = await pool.query(
    `SELECT IFNULL(SUM(status = '준비중'), 0) AS preparing,
            IFNULL(SUM(status = '준비중'
                       AND deadline BETWEEN NOW() AND NOW() + INTERVAL 7 DAY), 0) AS dueSoon,
            IFNULL(SUM(status = '수상'), 0) AS awarded
       FROM contests
      WHERE user_id = ?`,
    [userId]
  );

  // 홈 상단 카드: 아직 마감 전인 '준비중' 공모전 중 가장 가까운 것 (필터 안 걸었을 때만)
  const nextUp = status ? null : contests.find((c) => c.minutes_left >= 0 && c.status === '준비중') || null;

  res.render('index', { title: '내 공모전', contests, summary, status, nextUp });
});

// ───────────────────────── 등록 ─────────────────────────
// 달력에서 날짜를 눌러 들어오면 ?date=2026-11-28 로 마감 날짜가 미리 채워져요
router.get('/contests/new', (req, res) => {
  const date = isValidDate(req.query.date || '') ? req.query.date : '';
  res.render('form', {
    title: '공모전 등록',
    contest: { status: '준비중', deadline_date: date, deadline_time: '23:59' },
    action: '/contests',
    errors: [],
  });
});

router.post('/contests', async (req, res) => {
  const c = readContest(req.body);
  const errors = validateContest(c);
  if (errors.length) {
    return res.status(400).render('form', { title: '공모전 등록', contest: c, action: '/contests', errors });
  }

  const [result] = await pool.query(
    `INSERT INTO contests (user_id, title, organizer, category, deadline, status, url, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.session.user.id, c.title, c.organizer, c.category, c.deadline, c.status, c.url, c.memo]
  );
  req.session.flash = '공모전을 등록했어요';
  res.redirect(`/contests/${result.insertId}`);
});

// ───────────────────────── 상세 ─────────────────────────
router.get('/contests/:id', async (req, res) => {
  const contest = await findContest(req.params.id, req.session.user.id);
  if (!contest) return notFound(res);

  const [tasks] = await pool.query(
    'SELECT * FROM tasks WHERE contest_id = ? ORDER BY id',
    [contest.id]
  );
  const done = tasks.filter((t) => t.is_done).length;

  res.render('detail', { title: contest.title, contest, tasks, done });
});

// ───────────────────────── 수정 ─────────────────────────
router.get('/contests/:id/edit', async (req, res) => {
  const contest = await findContest(req.params.id, req.session.user.id);
  if (!contest) return notFound(res);

  // DB의 '2026-11-27 18:00:00'을 날짜 칸, 시간 칸으로 나눠서 폼에 채워요
  contest.deadline_date = contest.deadline.slice(0, 10);
  contest.deadline_time = contest.deadline.slice(11, 16);

  res.render('form', {
    title: '공모전 수정',
    contest,
    action: `/contests/${contest.id}/edit`,
    errors: [],
  });
});

router.post('/contests/:id/edit', async (req, res) => {
  const id = req.params.id;
  const c = readContest(req.body);
  const errors = validateContest(c);
  if (errors.length) {
    return res.status(400).render('form', {
      title: '공모전 수정',
      contest: { ...c, id },
      action: `/contests/${id}/edit`,
      errors,
    });
  }

  const [result] = await pool.query(
    `UPDATE contests
        SET title = ?, organizer = ?, category = ?, deadline = ?, status = ?, url = ?, memo = ?
      WHERE id = ? AND user_id = ?`,
    [c.title, c.organizer, c.category, c.deadline, c.status, c.url, c.memo, id, req.session.user.id]
  );
  if (result.affectedRows === 0) return notFound(res);
  req.session.flash = '수정한 내용을 저장했어요';
  res.redirect(`/contests/${id}`);
});

// 상세 화면의 선택 상자로 상태만 빠르게 바꾸기
router.post('/contests/:id/status', async (req, res) => {
  if (STATUSES.includes(req.body.status)) {
    await pool.query(
      'UPDATE contests SET status = ? WHERE id = ? AND user_id = ?',
      [req.body.status, req.params.id, req.session.user.id]
    );
    req.session.flash = `상태를 '${req.body.status}'(으)로 바꿨어요`;
  }
  res.redirect(`/contests/${req.params.id}`);
});

// ───────────────────────── 삭제 ─────────────────────────
// 체크리스트(tasks)는 ON DELETE CASCADE 덕분에 같이 지워져요
router.post('/contests/:id/delete', async (req, res) => {
  const [result] = await pool.query(
    'DELETE FROM contests WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.user.id]
  );
  if (result.affectedRows) req.session.flash = '공모전을 삭제했어요';
  res.redirect('/');
});

module.exports = router;
