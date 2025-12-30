(function(){
  const API_BASE = (window.COMMENTS_API && typeof window.COMMENTS_API === 'string' && window.COMMENTS_API.trim())
    ? window.COMMENTS_API.trim().replace(/\/$/, '')
    : ((location.hostname === '127.0.0.1' || location.hostname === 'localhost')
        ? 'http://127.0.0.1:8000'
        : location.origin.replace(/\/$/, ''));
  const PATH = '/index'; // 当前页面的评论路径标识
  const TOKEN_KEY = 'cmtAdminToken';
  let VERIFIED = false; // 仅当令牌通过后端校验时为 true

  function getToken(){
    try {
      const raw = localStorage.getItem(TOKEN_KEY) || '';
      const s = sanitizeToken(raw);
      if(s !== raw) localStorage.setItem(TOKEN_KEY, s);
      return s;
    } catch(e){ return ''; }
  }
  function sanitizeToken(t){
    if(typeof t !== 'string') return '';
    // 去除零宽字符、BOM、NBSP、全角空格，并 trim，避免隐藏字符导致 401
    let s = t
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, '')
      .replace(/\u3000/g, ' ')
      .trim();
    // 将全角 ASCII 转半角（常见于中文输入法）
    s = s.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    return s;
  }

  function setToken(t){
    try {
      const s = sanitizeToken(t);
      if(s) localStorage.setItem(TOKEN_KEY, s);
      else localStorage.removeItem(TOKEN_KEY);
    } catch(e){}
  }

  function h(tag, attrs, ...children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach(k => {
        if(k === 'class') el.className = attrs[k];
        else if(k === 'style' && typeof attrs[k] === 'object') Object.assign(el.style, attrs[k]);
        else el.setAttribute(k, attrs[k]);
      });
    }
    children.flat().forEach(c => {
      if(c == null) return;
      if(typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  }

  function fmtTime(iso){
    try { return new Date(iso).toLocaleString(); } catch(e){ return iso || ''; }
  }

  async function fetchJSON(url, opts){
    const res = await fetch(url, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, opts));
    if(!res.ok){
      const msg = await res.text().catch(()=>res.statusText);
      throw new Error(msg || ('HTTP '+res.status));
    }
    return res.json();
  }

  async function loadList(listEl){
    listEl.innerHTML = '加载中...';
    try {
      const data = await fetchJSON(`${API_BASE}/api/comments?path=${encodeURIComponent(PATH)}&page=1&page_size=20`);
      const items = Array.isArray(data.items) ? data.items : [];
      if(items.length === 0){
        listEl.innerHTML = '<li>还没有留言，来当第一个吧～</li>';
        return;
      }
      listEl.innerHTML = '';
      const hasToken = !!getToken() && VERIFIED;
      items.forEach(it => {
        const meta = h('div', { class: 'cmt-meta' }, `${it.nickname} · ${fmtTime(it.created_at)}`);
        if(hasToken){
          const delBtn = h('button', { class: 'cmt-del', type: 'button' }, '删除');
          delBtn.addEventListener('click', function(){ deleteComment(it.id, listEl); });
          meta.appendChild(delBtn);
        }
        const li = h('li', { class: 'cmt-item' },
          meta,
          h('div', { class: 'cmt-content' }, it.content)
        );
        listEl.appendChild(li);
      });
    } catch(err){
      listEl.innerHTML = `<li style="color:#c00">加载失败：${(err && err.message) || err}</li>`;
    }
  }

  async function submitForm(formEl, listEl){
    const nickname = formEl.querySelector('#cmt-nickname').value.trim();
    const content = formEl.querySelector('#cmt-content').value.trim();
    if(!nickname || !content){
      alert('请填写昵称与内容');
      return;
    }
    formEl.querySelector('button[type="submit"]').disabled = true;
    try {
      await fetchJSON(`${API_BASE}/api/comments`, {
        method: 'POST',
        body: JSON.stringify({ path: PATH, nickname, content })
      });
      formEl.reset();
      await loadList(listEl);
    } catch(err){
      alert('提交失败：' + ((err && err.message) || err));
    } finally {
      formEl.querySelector('button[type="submit"]').disabled = false;
    }
  }

  function injectStyles(){
    const css = `
    #comments-section { margin-top: 2rem; padding-top: .5rem; border-top: 1px solid #eee; }
    #comments-section h2 { margin: .2rem 0 1rem; font-size: 1.4rem; }
    .cmt-form { display: grid; gap: .6rem; max-width: 720px; }
    .cmt-form input,.cmt-form textarea { width: 100%; padding: .6rem .7rem; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
    .cmt-form button { width: 8rem; padding: .5rem .8rem; border: 0; border-radius: 8px; background:#49b1f5; color:#fff; cursor: pointer; }
    .cmt-form button[disabled]{ opacity:.6; cursor:not-allowed; }
    .cmt-list { list-style: none; padding: 0; margin-top: 1rem; max-width: 720px; }
    .cmt-item { padding: .8rem 0; border-bottom: 1px dashed #e6e6e6; }
    .cmt-meta { color:#888; font-size: .9rem; margin-bottom: .3rem; display:flex; align-items:center; gap:.5rem; }
    .cmt-content { white-space: pre-wrap; line-height: 1.6; }
    #cmt-admin { margin-top: 1rem; padding: .6rem; border: 1px dashed #e6e6e6; border-radius: 8px; max-width: 720px; display:flex; gap:.5rem; align-items:center; flex-wrap: wrap; }
    #cmt-token { flex: 1 1 220px; min-width: 200px; padding:.45rem .6rem; border:1px solid #ddd; border-radius:8px; }
    #cmt-admin button { padding:.45rem .7rem; border:0; border-radius:8px; background:#49b1f5; color:#fff; cursor:pointer; }
    #cmt-admin .muted { color:#888; font-size:.9rem; }
    .cmt-del { margin-left:auto; padding:.2rem .5rem; border:1px solid #ff6b6b; background:#fff; color:#ff4d4f; border-radius:6px; cursor:pointer; }
    .cmt-del:hover { background:#ff6b6b; color:#fff; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function bootstrap(){
    const root = document.getElementById('comments-root');
    if(!root) return;
    injectStyles();

    const form = h('form', { class: 'cmt-form', id: 'cmt-form' },
      h('input', { id: 'cmt-nickname', placeholder: '昵称（最多 64 字）', maxlength: '64', required: 'required' }),
      h('textarea', { id: 'cmt-content', placeholder: '留言内容（最多 2000 字）', maxlength: '2000', rows: '4', required: 'required' }),
      h('button', { type: 'submit' }, '发布')
    );
    const list = h('ul', { class: 'cmt-list', id: 'cmt-list' });

    // 管理员口令面板（本地快速路径）
    const adminBox = h('div', { id: 'cmt-admin' },
      h('strong', null, '管理员面板：'),
      h('input', { id: 'cmt-token', type: 'password' }),
      h('button', { type: 'button', id: 'cmt-save' }, '保存口令'),
      h('button', { type: 'button', id: 'cmt-clear' }, '清除'),
      h('span', { class: 'muted', id: 'cmt-status' }, '')
    );

    root.appendChild(adminBox);
    root.appendChild(form);
    root.appendChild(list);

    form.addEventListener('submit', function(e){ e.preventDefault(); submitForm(form, list); });

    // 初始化口令与状态
    const tokenInput = adminBox.querySelector('#cmt-token');
    const statusEl = adminBox.querySelector('#cmt-status');
    const saveBtn = adminBox.querySelector('#cmt-save');
    const clearBtn = adminBox.querySelector('#cmt-clear');
    async function verifyToken(){
      const t = getToken();
      if(!t){ VERIFIED = false; statusEl.textContent = ''; return; }
      statusEl.textContent = '';
      try{
        // 利用一个“不会成功删除”的请求来校验权限：
        // 授权正确 → 404 (ID不存在) 或 200 (删除成功)；未授权 → 401
        const res = await fetch(`${API_BASE}/api/comments?id=0`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } });
        if(res.status === 404){
          VERIFIED = true;
          statusEl.textContent = '';
        } else if(res.status === 401){
          VERIFIED = false;
          statusEl.textContent = '';
        } else if(res.ok){
          VERIFIED = true; // 非预期但视为可用
          statusEl.textContent = '';
        } else {
          VERIFIED = false;
          // 不对外显示错误信息，避免泄露提示
          // const msg = await res.text().catch(()=>res.statusText);
          statusEl.textContent = '';
        }
      }catch(e){
        VERIFIED = false;
        statusEl.textContent = '';
      }
    }
    const applyStatus = async () => {
      const t = getToken();
      tokenInput.value = t || '';
      await verifyToken();
    };
    saveBtn.addEventListener('click', async function(){ setToken(tokenInput.value); await applyStatus(); loadList(list); });
    clearBtn.addEventListener('click', async function(){ setToken(''); await applyStatus(); loadList(list); });
    await applyStatus();

    loadList(list);
  }

  async function deleteComment(id, listEl){
    const token = getToken();
    if(!token){ alert('请先在管理员面板输入口令'); return; }
    if(!VERIFIED){ alert('口令未通过验证，无法删除'); return; }
    if(!confirm('确认删除该留言？')) return;
    try{
      const res = await fetch(`${API_BASE}/api/comments?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if(!res.ok){
        const msg = await res.text().catch(()=>res.statusText);
        throw new Error(msg || ('HTTP '+res.status));
      }
      await loadList(listEl);
    }catch(err){
      alert('删除失败：' + ((err && err.message) || err));
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();
