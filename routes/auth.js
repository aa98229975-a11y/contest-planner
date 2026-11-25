// 회원가입 / 로그인 / 로그아웃
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// 로그인 처리: 세션 ID를 새로 발급한 뒤 회원 정보를 저장해요 (세션 고정 공격 방지)
function logIn(req, user, flash, done) {
  req.session.regenerate((err) => {
    if (err) return done(err);
    req.session.user = { id: user.id, username: user.username, name: user.name };
    if (flash) req.session.flash = flash;
    req.session.save(done);
  });
}

// 이미 로그인했으면 로그인/회원가입 화면 대신 목록으로
function guestOnly(req, res, next) {
  if (req.session.user) return res.redirect('/');
  next();
}

// ───────── 회원가입 ─────────
router.get('/signup', guestOnly, (req, res) => {
  res.render('signup', { title: '회원가입', form: {}, errors: [] });
});

router.post('/signup', guestOnly, async (req, res, next) => {
  const username = (req.body.username || '').trim();
  const name = (req.body.name || '').trim();
  const password = req.body.password || '';
  const password2 = req.body.password2 || '';

  const errors = [];
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) errors.push('아이디는 영문, 숫자, _ 로 4~20자를 입력하세요.');
  if (!name || name.length > 30) errors.push('이름을 30자 이내로 입력하세요.');
  if (password.length < 8 || password.length > 72) errors.push('비밀번호는 8~72자로 입력하세요.');
  else if (password !== password2) errors.push('비밀번호 확인이 일치하지 않아요.');

  if (errors.length === 0) {
    const [[exists]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists) errors.push('이미 사용 중인 아이디예요.');
  }
  if (errors.length) {
    return res.status(400).render('signup', { title: '회원가입', form: { username, name }, errors });
  }

  // 비밀번호는 그대로 저장하지 않고 bcrypt 해시로 저장
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)',
    [username, passwordHash, name]
  );

  logIn(req, { id: result.insertId, username, name }, `환영해요, ${name}님!`, (err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// ───────── 로그인 ─────────
router.get('/login', guestOnly, (req, res) => {
  res.render('login', { title: '로그인', form: {}, errors: [] });
});

router.post('/login', guestOnly, async (req, res, next) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  const [[user]] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    return res.status(401).render('login', {
      title: '로그인',
      form: { username },
      errors: ['아이디 또는 비밀번호가 맞지 않아요.'],
    });
  }

  logIn(req, user, null, (err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// ───────── 로그아웃 ─────────
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
