// 공고 링크로 자동 입력: 서버(/contests/fetch-info)에 링크를 보내고, 찾은 정보로 빈 칸을 채워요.
(function () {
  const form = document.querySelector('form.form');
  const button = document.getElementById('autofill-btn');
  if (!form || !button) return;

  const message = document.getElementById('autofill-msg');
  const urlInput = form.elements.url;

  const LABELS = {
    title: '공모전 이름',
    organizer: '주최',
    category: '분야',
    deadline_date: '마감 날짜',
    deadline_time: '마감 시간',
    memo: '메모',
  };

  function show(text, type) {
    message.textContent = text;
    message.className = `autofill-msg ${type || ''}`;
  }

  // 채운 칸은 노란색으로 잠깐 표시 (직접 고치면 사라져요)
  function mark(el) {
    el.classList.add('autofilled');
    el.addEventListener('input', () => el.classList.remove('autofilled'), { once: true });
    el.addEventListener('change', () => el.classList.remove('autofilled'), { once: true });
  }

  async function run() {
    const url = urlInput.value.trim();
    if (!url) {
      show('공고 링크를 먼저 붙여 넣으세요.', 'error');
      urlInput.focus();
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = '가져오는 중…';
    show('');

    try {
      const res = await fetch('/contests/fetch-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        show(data.error || '정보를 가져오지 못했어요.', 'error');
        return;
      }

      // 이미 입력한 칸은 건드리지 않고, 빈 칸만 채워요
      const filled = [];
      const dateWasEmpty = !form.elements.deadline_date.value;
      ['title', 'organizer', 'category', 'deadline_date', 'memo'].forEach((name) => {
        const el = form.elements[name];
        if (data[name] && el && !el.value) {
          el.value = data[name];
          if (el.value) {
            mark(el);
            filled.push(LABELS[name]);
          }
        }
      });
      if (data.deadline_time && data.deadline_date && dateWasEmpty) {
        form.elements.deadline_time.value = data.deadline_time;
        mark(form.elements.deadline_time);
        filled.push(LABELS.deadline_time);
      }

      if (filled.length) {
        const missing = !data.deadline_date ? ' 마감일은 못 찾았으니 직접 입력해 주세요.' : '';
        show(`${filled.join(', ')}을(를) 채웠어요. 맞는지 확인하고 저장하세요.${missing}`, 'ok');
      } else {
        show('이 페이지에서 새로 채울 정보를 찾지 못했어요. 직접 입력해 주세요.', 'warn');
      }
    } catch {
      show('정보를 가져오지 못했어요. 로그인 상태를 확인하고 다시 시도해 주세요.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  button.addEventListener('click', run);
  // 링크 칸에서 Enter를 누르면 폼 저장 대신 자동 입력
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });
})();
