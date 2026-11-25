require('dotenv').config({ quiet: true });

// 서버 시간대를 한국으로 (AWS EC2는 기본이 UTC라서 달력의 '오늘'이 어긋날 수 있어요)
process.env.TZ = process.env.TZ || 'Asia/Seoul';

const path = require('path');
const express = require('express');
const session = require('express-session');
const pool = require('./db');
const helpers = require('./helpers');
const { loadUser, requireLogin } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const contestsRouter = require('./routes/contests');
const tasksRouter = require('./routes/tasks');
const calendarRouter = require('./routes/calendar');
const autofillRouter = require('./routes/autofill');

const app = express();
const PORT = process.env.PORT || 3000;

// 화면(EJS) 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 모든 EJS 화면에서 helpers의 상수·함수(ddayLabel 등)를 바로 쓸 수 있게 등록
Object.assign(app.locals, helpers);
// 로그인 정보 기본값 (에러 화면처럼 미들웨어를 거치기 전에 그려질 때 대비)
Object.assign(app.locals, { currentUser: null, currentPath: '', flash: null });

// 폼 데이터·JSON(req.body) 읽기 + 정적 파일(CSS, JS)
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 로그인 세션 (브라우저 쿠키에 세션 ID만 저장, 회원 정보는 서버에 보관)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7일
  })
);
app.use(loadUser);

// 로그인 없이 볼 수 있는 화면: 회원가입, 로그인
app.use('/', authRouter);

// 여기부터는 로그인해야 볼 수 있어요
app.use(requireLogin);
app.use('/', contestsRouter);
app.use('/', tasksRouter);
app.use('/', calendarRouter);
app.use('/', autofillRouter);

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: '페이지를 찾을 수 없어요',
    message: '주소를 다시 확인해 주세요.',
  });
});

// 500 (Express 5는 async 함수 안에서 난 에러도 여기로 넘겨줘요)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: '문제가 생겼어요',
    message: '서버 콘솔에서 에러 내용을 확인해 주세요.',
  });
});

// DB 연결을 먼저 확인하고 서버 시작
pool
  .query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`공모전 일정관리 실행 중 → http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MySQL 연결 실패:', err.message);
    console.error('.env의 DB 설정을 확인하고, npm run db:init 으로 DB를 만들었는지 확인하세요.');
    process.exit(1);
  });
