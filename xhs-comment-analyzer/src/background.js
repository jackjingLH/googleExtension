/**
 * 金铲铲 - 小红书评论AI分析 Service Worker
 * AI调用 + 消息处理
 * @see src/content.js 内容脚本（消息发送方）
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

// ─── 消息监听 ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeComments') {
    handleAnalyze(message)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // 保持异步响应通道
  }
});

// ─── 分析主流程 ───────────────────────────────────────────
async function handleAnalyze({ comments, config }) {
  const { provider, apiKey, relayUrl, systemPrompt } = config;
  const sysPrompt = (systemPrompt || '').trim() || DEFAULT_SYSTEM_PROMPT;
  const prompt = buildPrompt(comments);

  let summary;
  switch (provider) {
    case 'zhipu':
      summary = await callZhipuAPI(apiKey, prompt, sysPrompt);
      break;
    case 'aliyun':
      summary = await callAliyunAPI(apiKey, prompt, sysPrompt);
      break;
    case 'openai':
      summary = await callOpenAIAPI(apiKey, prompt, sysPrompt);
      break;
    case 'relay':
      summary = await callRelayAPI(apiKey, prompt, relayUrl, sysPrompt);
      break;
    default:
      throw new Error(`未知的AI服务商: ${provider}`);
  }

  return { summary };
}

// ─── 构建 Prompt ──────────────────────────────────────────
function buildPrompt(comments) {
  const total = comments.length;
  const shown = Math.min(total, 100);
  const list = comments
    .slice(0, shown)
    .map((c, i) => {
      const like = c.like_count > 0 ? `（获赞 ${c.like_count}）` : '';
      return `${i + 1}. [${c.user_name}]：${c.content}${like}`;
    })
    .join('\n');

  return `以下是小红书某金铲铲/TFT阵容攻略笔记下的玩家评论（共 ${total} 条，展示前 ${shown} 条），请按要求进行分析：\n\n${list}`;
}

// ─── 智谱AI（glm-4-flash，免费）────────────────────────────
/**
 * @see work-dashboard/src/background.js:1818
 */
async function callZhipuAPI(apiKey, prompt, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`智谱AI调用失败 (${response.status}): ${text.slice(0, 200)}`);
  }

  const result = await response.json();
  if (!result.choices?.length) throw new Error('智谱AI返回数据格式错误');
  return result.choices[0].message.content;
}

// ─── 阿里云通义千问（qwen-turbo）────────────────────────────
/**
 * @see work-dashboard/src/background.js:2237
 */
async function callAliyunAPI(apiKey, prompt, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      },
      parameters: { result_format: 'message' }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`阿里云API调用失败 (${response.status}): ${text.slice(0, 200)}`);
  }

  const result = await response.json();
  if (!result.output?.choices?.length) throw new Error('阿里云API返回数据格式错误');
  return result.output.choices[0].message.content;
}

// ─── OpenAI（gpt-4o-mini）───────────────────────────────────
/**
 * @see work-dashboard/src/background.js:2289
 */
async function callOpenAIAPI(apiKey, prompt, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API调用失败 (${response.status}): ${text.slice(0, 200)}`);
  }

  const result = await response.json();
  if (!result.choices?.length) throw new Error('OpenAI API返回数据格式错误');
  return result.choices[0].message.content;
}

// ─── 自定义中转（OpenAI 兼容接口）──────────────────────────
/**
 * @see work-dashboard/src/background.js:2338
 */
async function callRelayAPI(apiKey, prompt, relayUrl, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  if (!relayUrl) throw new Error('请在设置中填写中转服务地址');

  const url = relayUrl.replace(/\/$/, '') + '/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`中转API调用失败 (${response.status}): ${text.slice(0, 200)}`);
  }

  const result = await response.json();
  if (!result.choices?.length) throw new Error('中转API返回数据格式错误');
  return result.choices[0].message.content;
}
