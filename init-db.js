// schema.sql을 실행해서 DB와 테이블, 샘플 데이터를 만들어요.
// 사용법: npm run db:init  (기존 데이터는 지워지고 샘플로 다시 채워져요)
require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true, // schema.sql 안의 여러 SQL 문을 한 번에 실행
  });

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(sql);
  await conn.end();

  console.log('DB 준비 완료: contest_planner (데모 계정 + 샘플 공모전 7개)');
}

main().catch((err) => {
  console.error('DB 초기화 실패:', err.message);
  console.error('.env의 DB_USER, DB_PASSWORD가 맞는지 확인하세요.');
  process.exit(1);
});
