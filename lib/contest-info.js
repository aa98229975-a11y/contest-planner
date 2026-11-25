// 공모전 공고 링크에서 이름·주최·마감일 등을 뽑아 오는 기능
// 1) 안전한 주소인지 확인 → 2) 서버가 페이지를 내려받음 → 3) HTML에서 정보 찾기
const dns = require('dns').promises;
const net = require('net');
const { CATEGORIES } = require('../helpers');

// 사용자에게 그대로 보여 줘도 되는 에러
class UserError extends Error {}

const MAX_BYTES = 2 * 1024 * 1024; // 최대 2MB까지만 읽기
const TIMEOUT_MS = 8000;           // 8초 안에 응답 없으면 포기
const MAX_REDIRECTS = 3;

const pad = (n) => String(n).padStart(2, '0');

// ───────────────── 1. 안전한 주소인지 확인 (SSRF 방지) ─────────────────
// 서버가 대신 접속하는 기능이라, 내부망이나 AWS 메타데이터(169.254.169.254) 같은
// 주소를 넣으면 서버 내부 정보가 새어 나갈 수 있어요. 그래서 공인 IP만 허용해요.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  return (
    v === '::' || v === '::1' ||
    v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd') ||
    v.startsWith('::ffff:') // IPv4를 IPv6로 감싼 주소
  );
}

async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UserError('링크 형식이 올바르지 않아요. https:// 로 시작하는 주소를 넣어 주세요.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UserError('http:// 또는 https:// 주소만 가져올 수 있어요.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new UserError('이 주소는 가져올 수 없어요.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  } catch {
    throw new UserError('사이트 주소를 찾을 수 없어요. 링크를 다시 확인해 주세요.');
  }
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new UserError('이 주소는 가져올 수 없어요.');
  }
  return url;
}

// ───────────────── 2. 페이지 내려받기 ─────────────────
async function readBody(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    chunks.push(value);
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks);
}

// 한국 사이트 중에는 EUC-KR 인코딩도 있어서 문자 집합을 확인해서 풀어요
function decodeHtml(buf, contentType) {
  let charset = (/charset=["']?([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!charset) {
    const head = buf.subarray(0, 4096).toString('latin1');
    charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1];
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

async function fetchHtml(rawUrl) {
  let current = rawUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const url = await assertPublicUrl(current); // 리다이렉트된 주소도 매번 다시 확인

    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContestPlanner/1.0)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      });
    } catch {
      throw new UserError('페이지에 접속하지 못했어요. 주소를 확인하거나 잠시 후 다시 시도해 주세요.');
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      current = new URL(location, url).href;
      continue;
    }
    if (!res.ok) throw new UserError(`페이지를 열 수 없어요. (응답 코드 ${res.status})`);

    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) {
      throw new UserError('웹페이지(HTML) 주소가 아니에요.');
    }
    return decodeHtml(await readBody(res), type);
  }
  throw new UserError('다른 주소로 너무 많이 이동해서 가져오지 못했어요.');
}

// ───────────────── 3. HTML에서 정보 찾기 ─────────────────
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', tilde: '~',
};

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

// <meta property="og:title" content="..."> 같은 태그 모으기
function readMeta(html) {
  const metas = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = (name) => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
      return m ? (m[1] ?? m[2] ?? m[3]) : null;
    };
    const key = (attr('property') || attr('name') || '').toLowerCase();
    const content = attr('content');
    if (key && content && !(key in metas)) metas[key] = decodeEntities(content).replace(/\s+/g, ' ').trim();
  }
  return metas;
}

// 화면에 보이는 글자만 줄 단위로 남기기
function htmlToText(html) {
  const text = html
    .replace(/<(script|style|noscript|svg|head|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|dd|dt|section|article|table|ul|ol|header|footer)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// '어촌 창업 공모전 | 사이트이름' → 가장 긴 조각을 공모전 이름으로
function cleanTitle(raw) {
  if (!raw) return null;
  const parts = raw
    .replace(/\s+/g, ' ')
    .split(/\s+(?:\||｜|::|-|–|—)\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const longest = parts.reduce((a, b) => (b.length > a.length ? b : a));
  return longest.slice(0, 150);
}

// 날짜(+시간) 패턴: 2026.11.27 / 2026-11-27 18:00 / 2026년 11월 27일(금) 오후 6시
const TIME_PART = '(?:\\s*(오전|오후|AM|PM)?\\s*(\\d{1,2})\\s*(?::\\s*(\\d{2})|시(?:\\s*(\\d{1,2})\\s*분)?))?';
const DATE_TAIL = '\\s*(?:일|\\.)?(?:\\s*\\(\\s*[월화수목금토일]\\s*\\))?';
const DATE_RE = new RegExp(`(20\\d{2})\\s*[.\\-/년]\\s*(\\d{1,2})\\s*[.\\-/월]\\s*(\\d{1,2})${DATE_TAIL}${TIME_PART}`, 'i');
// 기간의 끝: '~ 2026.12.04 18:00' 또는 연도 없이 '~ 12.04'
const PERIOD_END_RE = new RegExp(`^\\s*(?:\\)\\s*)?(?:~|∼|〜|-|–|부터)\\s*(?:(20\\d{2})\\s*[.\\-/년]\\s*)?(\\d{1,2})\\s*[.\\-/월]\\s*(\\d{1,2})${DATE_TAIL}${TIME_PART}`, 'i');

// 정규식 결과 → { date: 'YYYY-MM-DD', time: 'HH:MM' | null }
function toDateTime(m, fallbackYear, fallbackMonth) {
  let year = m[1] ? Number(m[1]) : fallbackYear;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!m[1] && fallbackMonth && month < fallbackMonth) year += 1; // 12.20 ~ 01.05 처럼 해를 넘기는 기간
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  let time = null;
  if (m[5] !== undefined) {
    let hour = Number(m[5]);
    let minute = Number(m[6] ?? m[7] ?? 0);
    const ampm = (m[4] || '').toUpperCase();
    if ((ampm === '오후' || ampm === 'PM') && hour < 12) hour += 12;
    if ((ampm === '오전' || ampm === 'AM') && hour === 12) hour = 0;
    if (hour === 24 && minute === 0) { hour = 23; minute = 59; }
    if (hour <= 23 && minute <= 59) time = `${pad(hour)}:${pad(minute)}`;
  }
  return { date: `${year}-${pad(month)}-${pad(day)}`, time };
}

// '접수기간', '마감' 같은 말 바로 뒤에 나오는 날짜를 마감일로 봐요.
// 기간(시작 ~ 끝)이면 끝 날짜가 마감이에요.
const DEADLINE_KEYWORDS = [
  /접수\s*마감/g, /마감\s*일시?/g, /접수\s*기간/g, /모집\s*기간/g, /응모\s*기간/g,
  /공모\s*기간/g, /제출\s*(?:기한|기간|마감)/g, /신청\s*기간/g, /접수\s*일정/g, /마감/g,
];

function findDeadline(text) {
  for (const keyword of DEADLINE_KEYWORDS) {
    for (const k of text.matchAll(keyword)) {
      const win = text.slice(k.index, k.index + 200);
      const first = DATE_RE.exec(win);
      if (!first) continue;

      const rest = win.slice(first.index + first[0].length);
      const end = PERIOD_END_RE.exec(rest);
      if (end) {
        const result = toDateTime(end, Number(first[1]), Number(first[2]));
        if (result) return result;
      }
      const single = toDateTime(first);
      if (single) return single;
    }
  }
  return null;
}

// '주최: ○○재단 / 주관: ...' → '○○재단'
function findOrganizer(text) {
  const m = /주\s*최(?:\s*\/\s*주\s*관)?(?:\s*기관|\s*사)?[^\S\n]*[:：|]?\s*([^\n]{2,80})/.exec(text);
  if (!m) return null;
  const value = m[1]
    .split(/\s*(?:주\s*관|후\s*원|협\s*찬|문\s*의|\||\/|,|·)\s*/)[0]
    .replace(/^[:：\-\s]+/, '')
    .trim();
  return value.length >= 2 ? value.slice(0, 100) : null;
}

// 이름·소개 글에 들어 있는 단어로 분야 추측
const CATEGORY_KEYWORDS = [
  ['영상', /영상|UCC|숏폼|유튜브|뮤직비디오|단편영화|광고\s*제작/i],
  ['디자인', /디자인|포스터|로고|캐릭터|일러스트|카드뉴스|웹툰|사진/],
  ['개발', /개발|해커톤|앱|소프트웨어|\bSW\b|프로그래밍|데이터|\bAI\b|인공지능|코딩/i],
  ['창업', /창업|스타트업|사업\s*계획|비즈니스|벤처/],
  ['아이디어', /아이디어|정책|제안|기획|논문|에세이|수기/],
];

function guessCategory(...texts) {
  for (const t of texts) {
    if (!t) continue;
    const hit = CATEGORY_KEYWORDS.find(([, re]) => re.test(t));
    if (hit && CATEGORIES.includes(hit[0])) return hit[0];
  }
  return null;
}

function extractContestInfo(html) {
  const meta = readMeta(html);
  const titleTag = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
  const title = cleanTitle(meta['og:title'] || meta['twitter:title'] || (titleTag && decodeEntities(titleTag)));
  const description = meta['og:description'] || meta.description || meta['twitter:description'] || '';
  const text = `${description}\n${htmlToText(html)}`;
  const deadline = findDeadline(text);

  return {
    title,
    organizer: findOrganizer(text),
    category: guessCategory(title, description),
    deadline_date: deadline ? deadline.date : null,
    deadline_time: deadline ? deadline.time : null,
    memo: description ? description.slice(0, 300) : null,
  };
}

async function fetchContestInfo(url) {
  const html = await fetchHtml(url);
  return extractContestInfo(html);
}

module.exports = { fetchContestInfo, extractContestInfo, assertPublicUrl, UserError };
