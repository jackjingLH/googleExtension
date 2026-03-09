/**
 * 金铲铲 - XHS评论API拦截器
 * 运行在 MAIN world，拦截 XHR + fetch
 * 自动翻页 + 自动展开所有子评论，无需手动操作
 * 评论API: //edith.xiaohongshu.com/api/sns/web/v2/comment/page
 * 子评论API: //edith.xiaohongshu.com/api/sns/web/v2/comment/sub/page
 * @see src/content.js 面板注入和消息通信（ISOLATED world）
 */
(function () {
  let autoFetched = 0;
  const MAX_AUTO = 60;   // 主评论翻页 + 子评论展开的总请求上限
  let savedHeaders = {}; // 缓存原始请求 headers（含鉴权签名）

  // ─── URL 判断 ─────────────────────────────────────────
  function isCommentPageUrl(url) {
    return !!url && url.includes('/comment/page');
  }
  function isCommentSubUrl(url) {
    return !!url && url.includes('/comment/sub');
  }
  function isCommentUrl(url) {
    return isCommentPageUrl(url) || isCommentSubUrl(url);
  }

  // ─── 数据提取 ─────────────────────────────────────────
  function extractTop(data) {
    return data?.data?.comments || data?.data?.data || data?.comments || null;
  }

  // 主评论列表：展平内嵌的子评论预览（sub_comments）
  function flatten(top) {
    const all = [];
    for (const c of top) {
      all.push(c);
      for (const s of (c.sub_comments || c.sub_comment_list || [])) all.push(s);
    }
    return all;
  }

  function dispatch(items) {
    const comments = items
      .map(c => ({
        content: c.content || '',
        like_count: c.like_info?.like_count ?? c.liked_count ?? 0,
        user_name: c.user_info?.nickname || c.nickname || '匿名用户',
      }))
      .filter(c => c.content.trim());
    if (!comments.length) return;
    document.dispatchEvent(new CustomEvent('__xhs_comments__', { detail: { comments } }));
  }

  // ─── 通用自动请求 ─────────────────────────────────────
  function autoRequest(url, onData) {
    if (autoFetched >= MAX_AUTO) return;
    autoFetched++;

    const xhr = new XMLHttpRequest();
    _open.call(xhr, 'GET', url);
    xhr.withCredentials = true;
    for (const [k, v] of Object.entries(savedHeaders)) {
      try { _setRH.call(xhr, k, v); } catch (_) {}
    }
    xhr.addEventListener('load', () => {
      try { onData(JSON.parse(xhr.responseText)); } catch (_) {}
    });
    xhr.send();
  }

  // ─── 主评论翻页 ───────────────────────────────────────
  function fetchNextCommentPage(url, cursor) {
    if (!cursor) return;
    const next = url.replace(/([?&]cursor=)[^&]*/, '$1' + encodeURIComponent(cursor));
    autoRequest(next, data => handleData(next, data));
  }

  // ─── 核心处理 ─────────────────────────────────────────
  function handleData(url, data) {
    const top = extractTop(data);
    if (!top?.length) return;

    if (isCommentPageUrl(url)) {
      // 派发主评论 + 内嵌预览子评论
      dispatch(flatten(top));

      // 主评论翻页
      if (data?.data?.has_more && data?.data?.cursor) {
        fetchNextCommentPage(url, data.data.cursor);
      }
    } else if (isCommentSubUrl(url)) {
      // 子评论接口直接 dispatch（由 content.js 点击展开按钮触发）
      dispatch(top);
    }
  }

  // ─── XHR 拦截（XHS 评论走此通道）────────────────────
  const _open = XMLHttpRequest.prototype.open;
  const _setRH = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this._cReq) this._cHeaders[name] = value;
    return _setRH.call(this, name, value);
  };

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isCommentUrl(url)) {
      this._cReq = true;
      this._cUrl = url;
      this._cHeaders = {};
      this.addEventListener('load', () => {
        savedHeaders = { ...this._cHeaders };
        try { handleData(url, JSON.parse(this.responseText)); } catch (_) {}
      });
    }
    return _open.call(this, method, url, ...rest);
  };

  // ─── fetch 拦截（备用）────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    return _fetch.apply(this, args).then(response => {
      if (isCommentUrl(url)) {
        response.clone().json().then(d => handleData(url, d)).catch(() => {});
      }
      return response;
    });
  };

  // ─── SPA 导航：切换笔记时重置计数 ────────────────────
  let _lastUrl = location.href;
  setInterval(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      autoFetched = 0;
    }
  }, 1000);

})();
