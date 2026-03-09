/**
 * 金铲铲 - 小红书评论AI分析 Popup 脚本
 * @see src/background.js AI调用服务
 * @see CLAUDE.md 项目规范
 */

const DEFAULT_SYSTEM_PROMPT = `你是个玩了几千局金铲铲的老油条，说话直接、接地气，不整那些官方腔。
帮我扒一扒这篇攻略的评论区，看看大家对这套阵容到底是个啥态度。

帮我看这几点：
1. 强不强：评论区大多觉得强、弱，还是看版本？
2. 实战咋样：有没有人说真上分了、翻车了、稳不稳得住？
3. 好不好上手：有没有提到操作难、运营烦、经济要求高？
4. 评论区有没有争：大家意见统一吗，分歧在哪？
5. 适合谁：新手能直接抄吗，还是得有点底子？
6. 版本还行不：有没有人说被削了、刚加强、版本限定那种？

输出格式说人话，别搞报告体：
---
【强度判断】：强势 / 中等 / 偏弱 / 版本限定
【推荐指数】：⭐⭐⭐⭐⭐
【一句话结论】：（50字以内，直接说能不能玩）
【评论区在夸啥】：
【评论区在质疑啥】：
【上手建议】：
【版本提示】：（没有相关评论就不用写）`;

// ─── 元素引用 ─────────────────────────────────────────────
const providerEl = document.getElementById('provider');
const apiKeyEl = document.getElementById('apiKey');
const relayUrlEl = document.getElementById('relayUrl');
const relayUrlField = document.getElementById('relay-url-field');
const systemPromptEl = document.getElementById('systemPrompt');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const togglePromptBtn = document.getElementById('toggle-prompt');
const promptWrap = document.getElementById('prompt-wrap');
const resetPromptBtn = document.getElementById('reset-prompt');

// ─── 加载已保存配置 ───────────────────────────────────────
chrome.storage.local.get(['provider', 'apiKey', 'relayUrl', 'systemPrompt'], (data) => {
  if (data.provider) providerEl.value = data.provider;
  if (data.apiKey) apiKeyEl.value = data.apiKey;
  if (data.relayUrl) relayUrlEl.value = data.relayUrl;
  if (data.systemPrompt) systemPromptEl.value = data.systemPrompt;
  updateRelayVisibility();
});

// ─── 服务商切换 ───────────────────────────────────────────
providerEl.addEventListener('change', updateRelayVisibility);

function updateRelayVisibility() {
  relayUrlField.style.display = providerEl.value === 'relay' ? 'flex' : 'none';
}

// ─── System Prompt 折叠 ───────────────────────────────────
togglePromptBtn.addEventListener('click', () => {
  const isOpen = promptWrap.style.display === 'flex';
  promptWrap.style.display = isOpen ? 'none' : 'flex';
  togglePromptBtn.textContent = isOpen ? '展开' : '收起';
});

resetPromptBtn.addEventListener('click', () => {
  systemPromptEl.value = '';
  showStatus('已重置，留空即使用默认 Prompt');
});

// ─── 保存 ────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const provider = providerEl.value;
  const apiKey = apiKeyEl.value.trim();
  const relayUrl = relayUrlEl.value.trim();
  const systemPrompt = systemPromptEl.value.trim();

  if (!apiKey) {
    showStatus('请输入 API Key', true);
    return;
  }

  if (provider === 'relay' && !relayUrl) {
    showStatus('请输入中转服务地址', true);
    return;
  }

  chrome.storage.local.set({ provider, apiKey, relayUrl, systemPrompt }, () => {
    showStatus('设置已保存 ✓');
  });
});

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = 'status';
  }, 3000);
}
