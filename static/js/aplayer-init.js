(function(){
  'use strict';

  var STORAGE_VOL = 'mp_volume';
  var STORAGE_IDX = 'mp_index';
  var STORAGE_TIME_PREFIX = 'mp_time_';

  function getStorage(key, def){ try{ var v = localStorage.getItem(key); return v==null? def : JSON.parse(v);}catch(e){ return def; } }
  function setStorage(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }

  function ensureContainer(){
    // 保证在侧边栏生成一个卡片，结构：
    // <div id="aplayer-card" class="card-widget card-player"><div class="card-content"><div id="aplayer"></div></div></div>
    var ap = document.getElementById('aplayer');
    if(ap) return ap;

    var aside = document.querySelector('#aside_content');
    var card = document.getElementById('aplayer-card');
    if(!card){
      card = document.createElement('div');
      card.id = 'aplayer-card';
      card.className = 'card-widget card-player';
      var inner = document.createElement('div');
      inner.className = 'card-content';
      ap = document.createElement('div');
      ap.id = 'aplayer';
      inner.appendChild(ap);
      card.appendChild(inner);
      if(aside){
        // 插入到头像信息卡之后
        var info = aside.querySelector('.card-widget.card-info');
        if(info && info.nextSibling){
          aside.insertBefore(card, info.nextSibling);
        }else{
          aside.insertBefore(card, aside.firstChild);
        }
      }else{
        // 兜底：插入到 body 顶部
        (document.body || document.documentElement).insertBefore(card, document.body.firstChild);
      }
    }else{
      ap = card.querySelector('#aplayer');
      if(!ap){
        ap = document.createElement('div');
        ap.id = 'aplayer';
        var cc = card.querySelector('.card-content') || card;
        cc.appendChild(ap);
      }
    }
    return ap;
  }

  function mapPlaylist(){
    var list = Array.isArray(window.PLAYLIST) ? window.PLAYLIST.slice() : [];
    return list.map(function(it){
      return {
        name: it.title || '未命名',
        artist: it.artist || '',
        url: it.url || '',
        cover: it.cover || '/static/img/img1.png',
        lrc: it.lrc || ''
      };
    });
  }

  function restoreIndex(max){
    var idx = getStorage(STORAGE_IDX, 0);
    if(typeof idx !== 'number' || isNaN(idx)) idx = 0;
    if(max && max>0) idx = Math.max(0, Math.min(max-1, idx));
    return idx;
  }

  function currentKey(ap){
    var audio = ap.list.audios[ap.list.index] || {};
    var id = (audio.id || audio.url || '');
    return STORAGE_TIME_PREFIX + id;
  }

  // ============ 方案B：为无时间戳歌词生成伪时间轴 ============
  function hasTimeTags(text){
    return /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/.test(text);
  }

  function pad(num, n){ num = Math.floor(num); return (Array(n).join('0') + num).slice(-n); }
  function formatTime(sec){
    if(!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec/60);
    var s = Math.floor(sec%60);
    var cs = Math.floor((sec - Math.floor(sec)) * 100); // 两位小数
    return '['+ pad(m,2) + ':' + pad(s,2) + '.' + pad(cs,2) + ']';
  }

  function pickLyricLines(text){
    var lines = (text||'').split(/\r?\n/);
    // 过滤掉纯标签行，如 [主歌]、[间奏] 等；保留有内容的行
    return lines.map(function(l){ return l.trim(); })
      .filter(function(l){ return l.length>0 && !/^\[[^\]]+\]$/.test(l); });
  }

  function generateTimedLrc(originalText, duration, meta){
    var lines = pickLyricLines(originalText);
    if(lines.length === 0){
      lines = ['(纯音乐)'];
    }
    var header = [];
    if(meta){
      if(meta.title) header.push('[ti:'+ meta.title +']');
      if(meta.artist) header.push('[ar:'+ meta.artist +']');
    }
    var body = [];
    var n = lines.length;
    var start = 0.5; // 前置 0.5s
    var end = Math.max(start + n*1.2, (isFinite(duration)? duration : (n*3)) - 0.3);
    var span = Math.max(0.8, (end - start) / n);
    for(var i=0;i<n;i++){
      var t = start + i*span;
      body.push(formatTime(t) + lines[i]);
    }
    return header.concat(body).join('\n');
  }

  function fetchText(url){
    return fetch(url).then(function(r){ return r.ok ? r.text() : ''; }).catch(function(){ return ''; });
  }

  function loadDuration(url){
    return new Promise(function(resolve){
      try{
        var a = document.createElement('audio');
        a.preload = 'metadata';
        a.src = url;
        var done = false;
        var finish = function(sec){ if(done) return; done = true; resolve(sec); cleanup(); };
        var cleanup = function(){ try{ a.removeAttribute('src'); a.load(); }catch(e){} };
        a.addEventListener('loadedmetadata', function(){ finish(a.duration || 0); });
        a.addEventListener('error', function(){ finish(0); });
        setTimeout(function(){ finish(0); }, 6000); // 超时兜底
      }catch(e){ resolve(0); }
    });
  }

  function toDataUrl(text){
    try{ return 'data:text/plain;charset=utf-8,' + encodeURIComponent(text || ''); }catch(e){ return ''; }
  }

  function prepareAudios(audios){
    // 为无时间戳的 lrc 生成伪时间轴，并将 lrc 字段替换为 data: URL
    return Promise.all(audios.map(function(item){
      if(!item || !item.lrc){ return Promise.resolve(item); }
      return fetchText(item.lrc).then(function(txt){
        if(hasTimeTags(txt)){
          // 已有时间戳，直接转成 data: URL，避免跨域和加载时序问题
          item.lrc = toDataUrl(txt);
          return item;
        }
        return loadDuration(item.url).then(function(dur){
          var gen = generateTimedLrc(txt, dur, { title: item.name, artist: item.artist });
          item.lrc = toDataUrl(gen);
          return item;
        });
      }).catch(function(){ return item; });
    }));
  }

  // 保障型拖拽/点击进度条：即便有遮挡或命中偏差，也能精确 seek
  function bindRobustSeek(ap){
    try {
      var root = ap.container || document.getElementById('aplayer');
      if(!root) return;
      var wrap = root.querySelector('.aplayer-bar-wrap');
      if(!wrap) return;

      wrap.style.cursor = 'pointer';
      wrap.style.touchAction = 'none';
      wrap.style.pointerEvents = 'auto';

      var dragging = false;
      function seekByClientX(clientX){
        var rect = wrap.getBoundingClientRect();
        var ratio = (clientX - rect.left) / (rect.width || 1);
        ratio = Math.max(0, Math.min(1, ratio || 0));
        var dur = ap.audio && ap.audio.duration || 0;
        if(isFinite(dur) && dur > 0){
          ap.seek(ratio * dur);
        }
      }

      function onMouseMove(e){ if(!dragging) return; seekByClientX(e.clientX); e.preventDefault(); }
      function onTouchMove(e){ if(!dragging) return; var t=e.touches && e.touches[0]; if(t) seekByClientX(t.clientX); e.preventDefault(); }
      function end(){
        if(!dragging) return;
        dragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', end);
        window.removeEventListener('touchmove', onTouchMove, {passive:false});
        window.removeEventListener('touchend', end);
      }

      wrap.addEventListener('mousedown', function(e){
        dragging = true;
        seekByClientX(e.clientX);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', end);
      });
      wrap.addEventListener('touchstart', function(e){
        dragging = true;
        var t = e.touches && e.touches[0];
        if(t) seekByClientX(t.clientX);
        window.addEventListener('touchmove', onTouchMove, {passive:false});
        window.addEventListener('touchend', end);
      }, {passive:true});

      // 单击即跳转
      wrap.addEventListener('click', function(e){ seekByClientX(e.clientX); });
    } catch(e){}
  }

  function createPlayer(audios){
    var container = ensureContainer();
    var initIndex = restoreIndex(audios.length);

    var ap = new APlayer({
      container: container,
      fixed: false,
      mini: false,
      autoplay: false,
      theme: '#49b1f5',
      loop: 'all',
      order: 'list',
      preload: 'metadata',
      volume: (function(){
        var v = getStorage(STORAGE_VOL, 0.8);
        return (typeof v === 'number' && v>=0 && v<=1) ? v : 0.8;
      })(),
      mutex: true,
      lrcType: 3,
      listFolded: false,
      audio: audios
    });

    try { if(initIndex>0) ap.list.switch(initIndex); } catch(e){}
    try { ap.lrc && ap.lrc.show && ap.lrc.show(); } catch(e){}

    ap.on('loadedmetadata', function(){
      try {
        var key = currentKey(ap);
        var last = getStorage(key, 0);
        if(typeof last === 'number' && last > 0 && last < (ap.audio.duration || 0)){
          ap.seek(last);
        }
      } catch(e){}
    });

    ap.on('listswitch', function(){
      try { setStorage(STORAGE_IDX, ap.list.index); } catch(e){}
    });

    ap.on('volumechange', function(){
      try { setStorage(STORAGE_VOL, ap.audio.volume); } catch(e){}
    });

    var lastSave = 0;
    ap.on('timeupdate', function(){
      var now = Date.now();
      if(now - lastSave > 1000){
        lastSave = now;
        try { setStorage(currentKey(ap), Math.floor(ap.audio.currentTime || 0)); } catch(e){}
      }
    });

    // 强化进度条拖拽/点击
    bindRobustSeek(ap);

    window.__aplayer__ = ap;
  }

  function init(){
    if(!window.APlayer){
      return void setTimeout(init, 60);
    }

    var audios = mapPlaylist();
    prepareAudios(audios).then(function(){
      createPlayer(audios);
    }).catch(function(){
      // 即使失败也创建播放器，避免空白
      createPlayer(audios);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
