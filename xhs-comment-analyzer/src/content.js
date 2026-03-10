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
        <div class="xhs-jcc-result" id="xhs-jcc-result" contenteditable="true" spellcheck="false"></div>
        <p class="xhs-jcc-edit-hint">✏ 点击内容可直接编辑</p>
        <div class="xhs-jcc-actions">
          <button class="xhs-jcc-copy" id="xhs-jcc-copy">📋 复制结果</button>
          <button class="xhs-jcc-save-img" id="xhs-jcc-save-img">🖼 生成图片</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('xhs-jcc-close').addEventListener('click', closePanel);
  document.getElementById('xhs-jcc-analyze').addEventListener('click', doAnalyze);
  document.getElementById('xhs-jcc-copy').addEventListener('click', copyResult);
  document.getElementById('xhs-jcc-save-img').addEventListener('click', saveAsImage);
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

// ─── 生成图片 ────────────────────────────────────────────
function saveAsImage() {
  const resultEl = document.getElementById('xhs-jcc-result');
  if (!resultEl) return;
  const text = resultEl.innerText.trim();
  if (!text) return;

  const W = 680;
  const PADDING = 32;
  const CONTENT_W = W - PADDING * 2;
  const LINE_H = 34;
  const FONT = `17px 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif`;
  const FONT_BOLD = `bold 17px 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif`;
  const HEADER_H = 64;
  const FOOTER_H = 40;

  // 预渲染：计算换行后的行数以确定画布高度
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  mCtx.font = FONT;

  function wrapLine(line) {
    if (!line.trim()) return [''];
    const chars = [...line];
    const lines = [];
    let cur = '';
    for (const ch of chars) {
      if (mCtx.measureText(cur + ch).width > CONTENT_W) {
        lines.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  const rawLines = text.split('\n');
  const wrapped = rawLines.flatMap(l => wrapLine(l));

  const contentH = wrapped.length * LINE_H + PADDING * 2;
  const totalH = HEADER_H + contentH + FOOTER_H;

  // 正式绘制
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  // 顶部分隔线装饰（4px）
  ctx.fillStyle = '#ff2442';
  ctx.fillRect(0, 0, W, 4);

  // Header
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 4, W, HEADER_H - 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 17px 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif`;
  ctx.fillText('热门评论总结', PADDING, HEADER_H / 2 + 10);

  // 内容区
  let y = HEADER_H + PADDING + 17;
  for (const line of wrapped) {
    if (!line.trim()) {
      y += LINE_H * 0.4;
      continue;
    }
    const isTag = /^【/.test(line);
    const isSep = /^---+$/.test(line.trim());

    if (isSep) {
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, y - 6);
      ctx.lineTo(W - PADDING, y - 6);
      ctx.stroke();
      y += LINE_H * 0.4;
      continue;
    }

    if (isTag) {
      // 【标签】部分用深色加粗，后续内容用常规色
      const tagMatch = line.match(/^(【.*?】)(.*)$/);
      if (tagMatch) {
        ctx.font = FONT_BOLD;
        ctx.fillStyle = '#1a1a1a';
        const tagW = ctx.measureText(tagMatch[1]).width;
        ctx.fillText(tagMatch[1], PADDING, y);
        ctx.font = FONT;
        ctx.fillStyle = '#333333';
        ctx.fillText(tagMatch[2], PADDING + tagW, y);
      } else {
        ctx.font = FONT_BOLD;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(line, PADDING, y);
      }
    } else {
      ctx.font = FONT;
      ctx.fillStyle = '#444444';
      ctx.fillText(line, PADDING, y);
    }
    y += LINE_H;
  }

  // Footer
  const now = new Date();
  const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(0, totalH - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = '#aaaaaa';
  ctx.font = `11px 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif`;
  ctx.fillText('由铲什么铲AI生成· 仅供参考', PADDING, totalH - FOOTER_H / 2 + 5);
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, W - PADDING, totalH - FOOTER_H / 2 + 5);
  ctx.textAlign = 'left';

  // 下载
  const btn = document.getElementById('xhs-jcc-save-img');
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `金铲铲分析_${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    const orig = btn.textContent;
    btn.textContent = '✅ 已保存';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }, 'image/png');
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
