// MySQL 커넥션 풀: 라우트에서 require('../db')로 가져와 pool.query()로 사용
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'contest_planner',
  dateStrings: true,      // DATETIME을 '2026-11-27 18:00:00' 같은 문자열로 받기
  decimalNumbers: true,   // SUM() 결과를 문자열이 아닌 숫자로 받기
  waitForConnections: true,
  connectionLimit: 10,
});

// 새 연결마다 한국 시간으로 맞추기 → NOW(), CURDATE()가 한국 기준이 돼요
// (AWS EC2의 MySQL은 기본이 UTC라서, 이게 없으면 D-day가 9시간 어긋나요)
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+09:00'");
});

module.exports = pool;
