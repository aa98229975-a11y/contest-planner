# 공모전 일정관리

공모전 마감일(D-day)과 준비 체크리스트를 관리하는 웹사이트예요.
회원마다 자기 공모전만 보이고, 월별 마감 달력을 달력 또는 엑셀 표 형태로 볼 수 있어요.

- 기술: Node.js · Express · EJS · MySQL (mysql2)
- 로그인: express-session (세션), bcryptjs (비밀번호 암호화)

## 실행 방법

```bash
npm install          # 1. 패키지 설치
                     # 2. .env.example을 .env로 복사하고 MySQL 정보, SESSION_SECRET 입력
npm run db:init      # 3. DB + 테이블 + 샘플 데이터 만들기
npm run dev          # 4. 서버 실행 (파일 저장하면 자동 재시작)
```

브라우저에서 http://localhost:3000 을 열면 돼요.

> ⚠️ `npm run db:init`은 테이블을 지우고 다시 만들어요. 가입한 계정과 입력한 공모전도 전부 지워져요.

### 데모 계정

`npm run db:init` 후 바로 로그인해 볼 수 있는 계정이에요.

| 아이디 | 비밀번호 |
|---|---|
| `demo` | `demo1234` |

## 기능

- **회원가입 / 로그인 / 로그아웃**: 비밀번호는 bcrypt 해시로 저장해요. 로그인해야 모든 화면을 볼 수 있어요.
- **내 공모전만 보기**: 모든 쿼리에 `user_id` 조건을 넣어서 남의 공모전은 보거나 고칠 수 없어요.
- **공모전 목록**: 마감 임박순 정렬, D-day 색상(3일 이내 빨강, 7일 이내 주황), 상태 필터, 준비중/7일 안에 마감/수상 요약
- **마감 시간**: 날짜와 시간을 따로 입력하고, 24시간 안 남으면 "5시간 12분 남음"처럼 보여줘요.
- **공고 링크 자동 입력**: 등록 화면에 공모전 공고 링크를 붙여 넣고 '자동 입력'을 누르면, 서버가 그 페이지를 읽어서 공모전 이름·주최·분야·마감 날짜와 시간·소개 글을 찾아 빈 칸을 채워요.
  - 페이지의 `og:title`, `description` 태그와 본문의 "주최", "접수기간 2026.11.01 ~ 2026.12.04 18:00" 같은 문장을 분석해요.
  - 보안: 서버가 대신 접속하는 기능이라 내부망·AWS 메타데이터 주소(169.254.169.254 등)는 막아요 (SSRF 방지).
  - 자바스크립트로 내용을 나중에 그리는 사이트는 정보를 못 찾을 수 있어요. 그럴 땐 직접 입력하면 돼요.
- **월별 마감 달력**
  - 달력 보기: 날짜 칸에 마감 시간과 공모전 이름 표시, 지난달·다음 달 날짜도 흐리게 표시, 날짜의 `+`를 누르면 그 날짜로 바로 등록
  - 표 보기: 엑셀처럼 열 문자(A, B, C…), 행 번호, 조건부 서식(D-day 색), 합계 행, 시트 탭(이전 달/다음 달)
- **준비 체크리스트**: 항목 추가 · 완료 체크 · 삭제, 진행률 표시

## ERD (테이블 관계)

```
users (회원)                contests (공모전)                tasks (준비 체크리스트)
─────────────────          ─────────────────────           ─────────────────────
PK id                ┐     PK id                    ┐      PK id
   username (UNIQUE) │     FK user_id  ─────────────┘│     FK contest_id ────────┘
   password_hash     └──<     title                   └──<    content
   name                       organizer                       is_done
   created_at                 category
                              deadline (DATETIME)
                              status (ENUM)
                              url, memo, created_at
```

- `users` 1 : N `contests` — 회원 한 명이 공모전 여러 개를 등록
- `contests` 1 : N `tasks` — 공모전 하나에 준비 항목 여러 개
- 회원을 지우면 공모전이, 공모전을 지우면 체크리스트가 같이 지워져요 (`ON DELETE CASCADE`).

## 폴더 구조

```
contest-planner/
├─ app.js              서버 시작, 세션·EJS·라우터 연결
├─ db.js               MySQL 커넥션 풀 (한국 시간대 설정)
├─ helpers.js          D-day 계산, 날짜·시간 표시 등 화면용 함수
├─ init-db.js          schema.sql 실행 (npm run db:init)
├─ schema.sql          테이블 3개 + 데모 계정 + 샘플 데이터
├─ lib/
│  └─ contest-info.js  공고 링크에서 공모전 정보 뽑기 (주소 검사 + HTML 분석)
├─ middleware/
│  └─ auth.js          로그인 확인 (requireLogin)
├─ routes/
│  ├─ auth.js          회원가입·로그인·로그아웃
│  ├─ contests.js      공모전 목록·등록·상세·수정·삭제
│  ├─ tasks.js         체크리스트 추가·토글·삭제
│  ├─ calendar.js      월별 마감 달력 (달력/표)
│  └─ autofill.js      공고 링크 자동 입력 API
├─ views/
│  ├─ partials/        header.ejs, footer.ejs
│  ├─ login.ejs, signup.ejs
│  ├─ index.ejs        목록
│  ├─ detail.ejs       상세 + 체크리스트
│  ├─ form.ejs         등록/수정 같이 사용
│  ├─ calendar.ejs     달력 보기 + 표 보기
│  └─ error.ejs        404 / 500
└─ public/
   ├─ css/style.css
   └─ js/autofill.js   '자동 입력' 버튼 동작
```

## 라우트

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET / POST | `/signup` | 회원가입 |
| GET / POST | `/login` | 로그인 |
| POST | `/logout` | 로그아웃 |
| GET | `/` | 내 공모전 목록 (`?status=준비중` 필터) |
| GET | `/calendar` | 월별 마감 달력 (`?month=2026-11&view=calendar` 또는 `view=table`) |
| GET | `/contests/new` | 등록 폼 (`?date=2026-11-28`이면 마감 날짜 미리 채움) |
| POST | `/contests` | 등록 |
| POST | `/contests/fetch-info` | 공고 링크에서 정보 가져오기 (JSON) |
| GET | `/contests/:id` | 상세 + 체크리스트 |
| GET / POST | `/contests/:id/edit` | 수정 |
| POST | `/contests/:id/status` | 상태만 변경 |
| POST | `/contests/:id/delete` | 삭제 (체크리스트도 같이 삭제) |
| POST | `/contests/:id/tasks` | 체크리스트 항목 추가 |
| POST | `/tasks/:id/toggle` | 완료 체크/해제 |
| POST | `/tasks/:id/delete` | 항목 삭제 |

## AWS EC2에 올릴 때 참고

- EC2(리눅스)는 기본 시간대가 UTC예요. 이 앱은 `app.js`에서 Node 시간대를, `db.js`에서 MySQL 연결 시간대를 한국(+09:00)으로 맞춰 둬서 D-day가 어긋나지 않아요.
- `.env`는 GitHub에 올라가지 않으니 서버에서 따로 만들어야 해요 (`.env.example` 참고).
