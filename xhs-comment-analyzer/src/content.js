/**
 * 金铲铲 - 小红书评论AI分析 Content Script
 * 面板注入 + 消息通信（ISOLATED world）
 * @see src/injector.js fetch拦截器（MAIN world）
 * @see src/background.js AI调用服务
 */

const PANEL_ID = 'xhs-jcc-panel';
const BTN_ID = 'xhs-jcc-btn';

let capturedComments = [];
let currentUrl = location.href;

// ─── 监听来自 MAIN world injector 的评论数据 ─────────────
document.addEventListener('__xhs_comments__', (e) => {
  const incoming = e.detail?.comments || [];
  // 基于内容去重，避免重复捕获同一批评论
  const existingContents = new Set(capturedComments.map(c => c.content));
  const newOnes = incoming.filter(c => !existingContents.has(c.content));
  if (newOnes.length > 0) {
    capturedComments = capturedComments.concat(newOnes);
    updateCommentCount();
  }
});

// ─── SPA 导航检测：URL 变化时重置评论 ────────────────────
setInterval(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    capturedComments = [];
    updateCommentCount();
    const resultWrap = document.getElementById('xhs-jcc-result-wrap');
    if (resultWrap) resultWrap.style.display = 'none';
  }
}, 1000);

// ─── 自动展开子评论回复 ───────────────────────────────────
const _clickedExpandBtns = new WeakSet();
let _expandDebounce = null;

function autoExpandSubComments() {
  const toClick = [...document.querySelectorAll('.show-more')]
    .filter(el => !_clickedExpandBtns.has(el));

  toClick.forEach((el, i) => {
    _clickedExpandBtns.add(el);
    setTimeout(() => {
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } catch (_) {}
    }, i * 800);
  });
}

function startExpandObserver() {
  const observer = new MutationObserver(() => {
    clearTimeout(_expandDebounce);
    _expandDebounce = setTimeout(autoExpandSubComments, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(autoExpandSubComments, 2500);
}

// ─── UI 注入 ─────────────────────────────────────────────
function injectUI() {
  if (document.getElementById(BTN_ID)) return;

  // 悬浮触发按钮
  const btn = document.createElement('div');
  btn.id = BTN_ID;
  btn.title = '金铲铲 · AI分析评论';
  btn.textContent = '🪙';
  btn.addEventListener('click', togglePanel);
  document.body.appendChild(btn);

  // 侧边面板
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="xhs-jcc-header">
      <span class="xhs-jcc-title">🪙 金铲铲 · 评论分析</span>
      <button class="xhs-jcc-close" id="xhs-jcc-close">✕</button>
    </div>
    <div class="xhs-jcc-body">
      <div class="xhs-jcc-status">
        <span id="xhs-jcc-count">已捕获 0 条评论</span>
        <span class="xhs-jcc-tip">滚动评论区以加载更多</span>
      </div>
      <button class="xhs-jcc-analyze-btn" id="xhs-jcc-analyze">⚔ 开始AI分析</button>
      <div class="xhs-jcc-result-wrap" id="xhs-jcc-result-wrap">
        <div class="xhs-jcc-result" id="xhs-jcc-result"></div>
        <button class="xhs-jcc-copy" id="xhs-jcc-copy">📋 复制结果</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('xhs-jcc-close').addEventListener('click', closePanel);
  document.getElementById('xhs-jcc-analyze').addEventListener('click', doAnalyze);
  document.getElementById('xhs-jcc-copy').addEventListener('click', copyResult);
}

function togglePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.toggle('xhs-jcc-open');
}

function closePanel() {
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.classList.remove('xhs-jcc-open');
}

function updateCommentCount() {
  const countEl = document.getElementById('xhs-jcc-count');
  if (countEl) countEl.textContent = `已捕获 ${capturedComments.length} 条评论`;
}

function copyResult() {
  const resultEl = document.getElementById('xhs-jcc-result');
  if (!resultEl) return;
  navigator.clipboard.writeText(resultEl.innerText).then(() => {
    const btn = document.getElementById('xhs-jcc-copy');
    const orig = btn.textContent;
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

// ─── AI 分析 ─────────────────────────────────────────────
async function doAnalyze() {
  if (capturedComments.length === 0) {
    showResult('⚠️ 还没有捕获到评论，请先滚动评论区加载评论。', false);
    return;
  }

  const analyzeBtn = document.getElementById('xhs-jcc-analyze');
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '⏳ 分析中...';
  showResult('正在调用AI分析，请稍候...', false);

  try {
    const config = await getConfig();
    if (!config.apiKey) {
      showResult('⚠️ 请先点击扩展图标，在设置中配置AI服务商和API Key。', false);
      return;
    }

    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'analyzeComments', comments: capturedComments, config },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response?.summary || '');
          }
        }
      );
    });

    showResult(result, true);
  } catch (err) {
    showResult(`❌ 分析失败：${err.message}`, false);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '⚔ 开始AI分析';
  }
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['provider', 'apiKey', 'relayUrl', 'systemPrompt'], (data) => {
      resolve({
        provider: data.provider || 'zhipu',
        apiKey: data.apiKey || '',
        relayUrl: data.relayUrl || '',
        systemPrompt: data.systemPrompt || ''
      });
    });
  });
}

// ─── 结果渲染 ────────────────────────────────────────────
function showResult(text, isMarkdown) {
  const resultEl = document.getElementById('xhs-jcc-result');
  const wrap = document.getElementById('xhs-jcc-result-wrap');
  if (!resultEl || !wrap) return;

  if (isMarkdown) {
    resultEl.innerHTML = simpleMarkdown(text);
  } else {
    resultEl.innerHTML = escapeHtml(text);
  }

  wrap.style.display = 'flex';
}

// 极简 Markdown 渲染（加粗、【标签】、分隔线、星星）
function simpleMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/【(.*?)】/g, '<span class="xhs-jcc-tag">【$1】</span>')
    .replace(/^---$/gm, '<hr class="xhs-jcc-hr">')
    .replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── 初始化 ──────────────────────────────────────────────
function init() {
  if (document.body) {
    injectUI();
    startExpandObserver();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      injectUI();
      startExpandObserver();
    });
  }
}

init();
