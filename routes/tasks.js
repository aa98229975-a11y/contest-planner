// 체크리스트 항목 추가 / 완료 토글 / 삭제
// 항목이 속한 공모전이 내 것(user_id)인지 확인한 뒤에만 바꿀 수 있어요.
const express = require('express');
const pool = require('../db');

const router = express.Router();

function notFound(res) {
  return res.status(404).render('error', {
    title: '찾을 수 없어요',
    message: '이미 삭제됐거나 내 항목이 아니에요.',
  });
}

// :id 가 숫자가 아니면 바로 404
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return notFound(res);
  next();
});

// 내 공모전에 속한 항목인지 확인하고, 그 공모전 id를 돌려줘요
async function findMyTask(taskId, userId) {
  const [[task]] = await pool.query(
    `SELECT t.id, t.contest_id
       FROM tasks t
       JOIN contests c ON c.id = t.contest_id
      WHERE t.id = ? AND c.user_id = ?`,
    [taskId, userId]
  );
  return task;
}

// 항목 추가
router.post('/contests/:id/tasks', async (req, res) => {
  const contestId = req.params.id;
  const [[contest]] = await pool.query(
    'SELECT id FROM contests WHERE id = ? AND user_id = ?',
    [contestId, req.session.user.id]
  );
  if (!contest) return notFound(res);

  const content = (req.body.content || '').trim();
  if (content && content.length <= 200) {
    await pool.query('INSERT INTO tasks (contest_id, content) VALUES (?, ?)', [contestId, content]);
  }
  res.redirect(`/contests/${contestId}#tasks`);
});

// 완료 체크 ↔ 해제
router.post('/tasks/:id/toggle', async (req, res) => {
  const task = await findMyTask(req.params.id, req.session.user.id);
  if (!task) return notFound(res);

  await pool.query('UPDATE tasks SET is_done = NOT is_done WHERE id = ?', [task.id]);
  res.redirect(`/contests/${task.contest_id}#tasks`);
});

// 항목 삭제
router.post('/tasks/:id/delete', async (req, res) => {
  const task = await findMyTask(req.params.id, req.session.user.id);
  if (!task) return notFound(res);

  await pool.query('DELETE FROM tasks WHERE id = ?', [task.id]);
  res.redirect(`/contests/${task.contest_id}#tasks`);
});

module.exports = router;
