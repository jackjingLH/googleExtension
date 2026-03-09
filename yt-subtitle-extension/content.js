// YouTube 字幕下载器 - Content Script (world: MAIN)

const BTN_ID    = 'yt-sub-dl-btn';
const PICKER_ID = 'yt-sub-dl-picker';

let capturedSubUrl = null;

// ─── 拦截播放器字幕 XHR ───────────────────────────
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...args) {
  if (typeof url === 'string' && url.includes('/api/timedtext')) {
    capturedSubUrl = url;
  }
  return origOpen.call(this, method, url, ...args);
};

// ─── json3 → SRT ──────────────────────────────────
function msToTime(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const r = ms % 1_000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(r).padStart(3,'0')}`;
}

function json3ToSrt(data) {
  let i = 1;
  return (data.events || [])
    .filter(e => e.segs?.some(s => s.utf8?.trim()))
    .map(e => {
      const text = e.segs.map(s => s.utf8 ?? '').join('').trim();
      return text ? `${i++}\n${msToTime(e.tStartMs)} --> ${msToTime(e.tStartMs + e.dDurationMs)}\n${text}` : null;
    })
    .filter(Boolean).join('\n\n') + '\n';
}

// ─── 语言列表 ─────────────────────────────────────
const TRANSLATE_LANGS = [
  { code: 'zh-Hans', label: '中文（简体）' },
  { code: 'en',      label: 'English' },
  { code: 'ja',      label: '日本語' },
];

function getAvailableLangs() {
  const renderer = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer;
  if (!renderer) return [];

  const direct = (renderer.captionTracks || []).map(t => ({
    code: t.languageCode,
    label: t.name?.simpleText || t.languageCode,
    type: 'direct',
    isManual: t.kind !== 'asr',
    baseUrl: t.baseUrl,
  }));

  const translated = TRANSLATE_LANGS
    .filter(t => !direct.find(d => d.code === t.code))
    .map(t => ({ ...t, type: 'translate', isManual: false }));

  return [...direct, ...translated];
}

// ─── 执行下载 ─────────────────────────────────────
async function doDownload(lang, type) {
  const btn = document.getElementById(BTN_ID);
  btn.textContent = '⏳ 下载中...';
  btn.disabled = true;

  try {
    if (!capturedSubUrl) throw new Error('请先播放视频几秒后再试');

    const url = type === 'direct'
      ? capturedSubUrl
          .replace(/([?&]fmt=)[^&]+/, '$1json3')
          .replace(/([?&]lang=)[^&]+/, `$1${lang}`)
          .replace(/([?&]tlang=)[^&]*/g, '')
      : capturedSubUrl
          .replace(/([?&]fmt=)[^&]+/, '$1json3')
          .replace(/([?&]tlang=)[^&]*/g, '')
          + `&tlang=${lang}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const srt = json3ToSrt(data);
    if (!srt.trim()) throw new Error('字幕内容为空');

    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([srt], { type: 'text/plain;charset=utf-8' })),
      download: `${document.title}.${lang}.srt`,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();

    btn.textContent = '✅ 已下载';
    setTimeout(() => { btn.textContent = '⬇ 字幕'; btn.disabled = false; }, 2000);
  } catch (e) {
    alert('下载失败: ' + e.message);
    btn.textContent = '⬇ 字幕';
    btn.disabled = false;
  }
}

// ─── 语言选择弹出层 ───────────────────────────────
function showPicker(btn) {
  document.getElementById(PICKER_ID)?.remove();

  const langs = getAvailableLangs();
  if (!langs.length) { alert('该视频暂无可用字幕'); return; }

  const picker = document.createElement('div');
  picker.id = PICKER_ID;
  picker.style.cssText = `
    position:absolute; z-index:9999;
    background:#fff; border:1px solid #e5e5e5; border-radius:12px;
    box-shadow:0 4px 20px rgba(0,0,0,.15); padding:8px 0;
    min-width:180px; max-height:300px; overflow-y:auto;
    font-family:Roboto,Arial,sans-serif; font-size:14px;
  `;

  langs.forEach(({ code, label, type, isManual }) => {
    const item = document.createElement('div');
    const tag = isManual ? ' ✓' : type === 'translate' ? '（翻译）' : '（自动）';
    item.textContent = label + tag;
    item.style.cssText = `padding:10px 16px; cursor:pointer; color:${isManual ? '#065fd4' : '#0f0f0f'};`;
    item.onmouseenter = () => item.style.background = '#f2f2f2';
    item.onmouseleave = () => item.style.background = '';
    item.onclick = () => { picker.remove(); doDownload(code, type); };
    picker.appendChild(item);
  });

  const rect = btn.getBoundingClientRect();
  picker.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  picker.style.left = `${rect.left  + window.scrollX}px`;
  document.body.appendChild(picker);

  const close = e => {
    if (!picker.contains(e.target) && e.target !== btn) {
      picker.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

// ─── 注入按钮 ─────────────────────────────────────
function addButton() {
  if (document.getElementById(BTN_ID)) return;
  const anchor = document.querySelector('#actions-inner')
               || document.querySelector('ytd-watch-flexy #actions');
  if (!anchor) return;

  const hasManual = (window.ytInitialPlayerResponse
    ?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [])
    .some(t => t.kind !== 'asr');

  const btn = document.createElement('button');
  btn.id        = BTN_ID;
  btn.textContent = hasManual ? '⬇ 字幕 ✓' : '⬇ 字幕';
  btn.title     = hasManual ? '该视频有人工字幕' : '仅自动生成字幕';
  btn.style.cssText = `
    margin-left:8px; padding:0 16px; height:36px; border:none;
    border-radius:18px; background:#f2f2f2; color:#0f0f0f;
    font-size:14px; font-weight:500; cursor:pointer;
    display:inline-flex; align-items:center; position:relative;
  `;
  btn.onmouseenter = () => btn.style.background = '#e5e5e5';
  btn.onmouseleave = () => btn.style.background = '#f2f2f2';
  btn.onclick = () => showPicker(btn);
  anchor.appendChild(btn);
}

// ─── 初始化 & SPA 路由监听 ────────────────────────
function init() {
  capturedSubUrl = null;
  const timer = setInterval(() => {
    if (document.querySelector('#actions-inner')) { addButton(); clearInterval(timer); }
  }, 300);
}

document.addEventListener('yt-navigate-finish', () => {
  document.getElementById(BTN_ID)?.remove();
  document.getElementById(PICKER_ID)?.remove();
  init();
});

init();
