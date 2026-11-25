-- 공모전 일정관리 DB
-- 주의: 실행하면 기존 테이블을 지우고 샘플 데이터로 다시 만들어요.
--
-- 테이블 관계 (ERD)
--   users 1 ── N contests 1 ── N tasks
--   회원 한 명이 공모전 여러 개, 공모전 하나에 준비 항목 여러 개
SET NAMES utf8mb4;
SET time_zone = '+09:00';   -- 한국 시간 기준 (EC2 서버는 기본이 UTC라서 꼭 필요)

CREATE DATABASE IF NOT EXISTS contest_planner
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE contest_planner;

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS contests;
DROP TABLE IF EXISTS users;

-- 회원
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(20)  NOT NULL UNIQUE,   -- 로그인 아이디
  password_hash VARCHAR(100) NOT NULL,          -- bcrypt로 암호화한 비밀번호
  name          VARCHAR(30)  NOT NULL,          -- 화면에 보이는 이름
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 공모전 (회원 1명 : 공모전 여러 개)
CREATE TABLE contests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  organizer  VARCHAR(100),
  category   VARCHAR(20),
  deadline   DATETIME NOT NULL,               -- 마감 날짜 + 시간
  status     ENUM('준비중','제출완료','결과대기','수상','탈락') NOT NULL DEFAULT '준비중',
  url        VARCHAR(300),
  memo       TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_deadline (user_id, deadline)  -- 내 공모전을 마감일 순으로 찾을 때 빠르게
);

-- 준비 체크리스트 (공모전 1개 : 항목 여러 개)
CREATE TABLE tasks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  contest_id INT NOT NULL,
  content    VARCHAR(200) NOT NULL,
  is_done    BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
);

-- ───────── 샘플 데이터 ─────────
-- 데모 계정 (아이디/비밀번호는 README.md 참고). 비밀번호는 bcrypt 해시로 저장돼요.
INSERT INTO users (username, password_hash, name) VALUES
('demo', '$2b$10$JGzohVbmEwDYCC..kujDy.RhOwTKg2F0n3ibDa3.3IDZm5GyOE5AS', '데모');

-- 마감일을 오늘 기준으로 잡아서 언제 실행해도 D-day가 자연스럽게 보여요.
INSERT INTO contests (user_id, title, organizer, category, deadline, status, url, memo) VALUES
(1, '어촌 창업 아이디어 공모전',   '○○수산재단', '창업',     CURDATE() + INTERVAL 2 DAY  + INTERVAL 18 HOUR, '준비중',   NULL, '사업계획서 10쪽 이내, PDF로 제출'),
(1, '청년 정책 제안 공모전',       '○○도',       '아이디어', CURDATE() + INTERVAL 5 DAY  + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, '준비중', NULL, NULL),
(1, '공공데이터 활용 공모전',      '○○시',       '개발',     CURDATE() + INTERVAL 9 DAY  + INTERVAL 17 HOUR, '준비중',   NULL, '팀은 3명까지 참가 가능'),
(1, '지역 관광 홍보 카드뉴스 공모전', '○○관광공사', '디자인', CURDATE() + INTERVAL 14 DAY + INTERVAL 18 HOUR, '준비중',   NULL, NULL),
(1, '캠퍼스 UX 디자인 공모전',     '○○대학교',   '디자인',   CURDATE() + INTERVAL 21 DAY + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, '준비중', NULL, NULL),
(1, '친환경 생활 아이디어 공모전', '○○환경재단', '아이디어', CURDATE() - INTERVAL 5 DAY  + INTERVAL 18 HOUR, '결과대기', NULL, '결과 발표는 다음 달 중순'),
(1, '대학생 홍보영상 공모전',      '○○공사',     '영상',     CURDATE() - INTERVAL 20 DAY + INTERVAL 18 HOUR, '수상',     NULL, '우수상 수상');

INSERT INTO tasks (contest_id, content, is_done) VALUES
(1, '공모 요강 정리', TRUE),
(1, '아이디어 기획서 초안', TRUE),
(1, '시장 조사 자료', TRUE),
(1, '사업계획서 최종본', FALSE),
(1, '온라인 접수', FALSE),
(2, '정책 아이디어 3개 뽑기', TRUE),
(2, '제안서 작성', FALSE),
(3, '데이터셋 고르기', TRUE),
(3, '서비스 기획', FALSE),
(3, '프로토타입 개발', FALSE),
(3, '시연 영상 촬영', FALSE),
(4, '관광지 사진 촬영', FALSE),
(4, '카드뉴스 10장 디자인', FALSE),
(5, '사용자 인터뷰', FALSE),
(5, '와이어프레임', FALSE),
(5, '최종 시안', FALSE),
(6, '아이디어 기획서', TRUE),
(6, '온라인 접수', TRUE),
(7, '콘티 작성', TRUE),
(7, '촬영', TRUE),
(7, '편집', TRUE),
(7, '온라인 접수', TRUE);
