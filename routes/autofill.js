// 공고 링크 → 공모전 정보 자동 입력 (등록/수정 폼의 '자동 입력' 버튼이 호출)
const express = require('express');
const { fetchContestInfo, UserError } = require('../lib/contest-info');

const router = express.Router();

// 요청: { "url": "https://..." }  응답: { title, organizer, category, deadline_date, deadline_time, memo }
router.post('/contests/fetch-info', async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!url) return res.status(400).json({ error: '공고 링크를 먼저 붙여 넣으세요.' });

  try {
    res.json(await fetchContestInfo(url));
  } catch (err) {
    if (err instanceof UserError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(502).json({ error: '정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

module.exports = router;
