// 侧边音乐播放器（无第三方依赖）
// 使用方式：
// 1) 在页面中引入 static/js/player.config.js（定义 window.PLAYLIST）
// 2) 再引入本文件；页面含有 #aside_content 时会自动注入播放器卡片
// 3) 可通过 window.MusicPlayer.init({ mountTarget: '#aside_content' }) 自定义挂载位置
(function(){
  'use strict';

  var DEFAULT_COVER = '/static/img/img1.png';
  var STORAGE_VOL = 'mp_volume';
  var STORAGE_IDX = 'mp_index';
  var STORAGE_TIME_PREFIX = 'mp_time_';

  function fmtTime(t){
    t = isNaN(t) || !isFinite(t) ? 0 : Math.max(0, Math.floor(t));
    var m = Math.floor(t/60), s = t%60;
    return m + ':' + ('0'+s).slice(-2);
  }

  function encodeSrc(url){
    // 规范化 URL：先解码再编码，避免对已编码路径重复编码（出现 %25... 导致 404）
    try {
      if(url == null) return url;
      var u = String(url);
      try { u = decodeURI(u); } catch(_) { /* 若包含不合法转义，保持原样 */ }
      return encodeURI(u);
    } catch(e){
      return url;
    }
  }

  function escapeHTML(s){
    if(s==null) return '';
    return String(s).replace(/[&<>]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]); });
  }

  // DOM 兼容方法：matches / closest
  function domMatches(el, selector){
    if(!el || el.nodeType !== 1) return false;
    var p = Element.prototype;
    var fn = p.matches || p.msMatchesSelector || p.webkitMatchesSelector || p.mozMatchesSelector || p.oMatchesSelector;
    if(!fn) return false;
    try { return fn.call(el, selector); } catch(e){ return false; }
  }
  function closestEl(el, selector){
    while(el && el.nodeType === 1){
      if(domMatches(el, selector)) return el;
      el = el.parentElement || el.parentNode;
    }
    return null;
  }

  // 解析 LRC 歌词，返回按时间升序的数组：[{time: Number(seconds), text: string}]
  function parseLRC(text){
    if(!text || typeof text !== 'string') return [];
    var lines = text.split(/\r?\n/);
    var result = [];
    var timeTag = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
    for(var i=0;i<lines.length;i++){
      var line = lines[i];
      var content = line.replace(timeTag, '').trim();
      var has = false;
      timeTag.lastIndex = 0;
      var m;
      while((m = timeTag.exec(line)) !== null){
        has = true;
        var min = parseInt(m[1]||'0',10), sec = parseInt(m[2]||'0',10), ms = parseInt(m[3]||'0',10);
        var t = min*60 + sec + (isNaN(ms)?0: ms/ (ms<100?100:1000));
        result.push({ time: t, text: content || '' });
      }
      // 没有时间标签则跳过该行（纯文本稍后会整体显示）
      if(!has) continue;
    }
    result.sort(function(a,b){ return a.time - b.time; });
    return result;
  }

  // 依次尝试多个 LRC URL，直到成功；全部失败则回调失败
  function tryFetchLRC(urls, onText, onFail){
    if(!urls || !urls.length){ if(onFail) onFail(); return; }
    var u = urls.shift();
    fetch(encodeSrc(u)).then(function(res){
      if(res.ok) return res.text();
      throw new Error('not ok');
    }).then(function(txt){ onText && onText(txt); })
      .catch(function(){ tryFetchLRC(urls, onText, onFail); });
  }

  function createEl(tag, cls){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    return el;
  }

  function getStorage(key, def){
    try { var v = localStorage.getItem(key); return v==null? def : JSON.parse(v); } catch(e){ return def; }
  }
  function setStorage(key, val){
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
  }

  function Player(options){
    this.options = options || {};
    this.list = (window.PLAYLIST && Array.isArray(window.PLAYLIST)) ? window.PLAYLIST.slice() : [];
    this.index = 0;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.savingTick = 0;
    this.dragging = false;
    this.dragRatio = 0;
    this.pendingSeek = null;
    this._justDragged = 0; // 记录最近一次拖拽结束时间，用于抑制紧随其后的 click
    this.lrcLines = [];
    this.lrcPlain = false;
    this.activeLyric = -1;
    this._plainLyricRaw = '';
    // 播放时用于更顺滑的进度/歌词刷新
    this._tickActive = false;
    this._tickId = 0;
    this.mount();
    this.restoreState();
    this.render();
    this.bind();
    if(this.list.length){ this.load(this.index); }
  }

  Player.prototype.mount = function(){
    var mountTarget = this.options.mountTarget || '#aside_content';
    var aside = document.querySelector(mountTarget);
    if(!aside){
      // 若无侧栏，则挂载到 body 末尾
      aside = document.body || document.documentElement;
    }

    // 优先复用页面中已有的占位容器，避免后插入突兀
    var card = document.getElementById('music-player');
    if(!card){
      card = createEl('div', 'card-widget card-player');
      card.id = 'music-player';
      // 插入到侧栏顶部（或页面底部固定迷你栏）
      if(aside.firstChild){ aside.insertBefore(card, aside.firstChild); }
      else { aside.appendChild(card); }
    }

    // 若当前页面无侧栏，作为底部固定迷你栏展示
    if(!document.querySelector('#aside_content')){
      card.classList.add('mp-fixed-bottom');
    }

    // 渲染结构：左侧三横杠打开歌单；歌词常显在进度条下方
    card.innerHTML = '\n      <div class="card-content">\n        <div class="player-mini">\n          <img class="player-cover" alt="cover"/>\n          <div class="player-info">\n            <div class="player-text">\n              <div class="player-song" title="歌曲">-</div>\n              <div class="player-artist" title="歌手">-</div>\n            </div>\n            <div class="player-controls">\n              <button class="btn btn-menu" title="歌单">☰</button>\n              <button class="btn btn-prev" title="上一首">⏮</button>\n              <button class="btn btn-play" title="播放/暂停">▶</button>\n              <button class="btn btn-next" title="下一首">⏭</button>\n            </div>\n            <div class="player-progress">\n              <div class="bar"><div class="bar-inner"></div></div>\n              <div class="time"><span class="current">0:00</span><span class="sep">/</span><span class="duration">0:00</span></div>\n            </div>\n            <div class="lyrics-area"></div>\n            <div class="player-volume">\n              <i class="fa fa-volume-up" aria-hidden="true"></i>\n              <input class="volume-range" type="range" min="0" max="1" step="0.01" value="0.8"/>\n            </div>\n          </div>\n        </div>\n        <div class="player-panel" hidden>\n          <div class="panel-body">\n            <div class="panel-queue"></div>\n          </div>\n        </div>\n      </div>';

    // 缓存节点
    this.el = card;
    this.$cover = card.querySelector('.player-cover');
    this.$song = card.querySelector('.player-song');
    this.$artist = card.querySelector('.player-artist');
    this.$btnMenu = card.querySelector('.btn-menu');
    this.$btnPrev = card.querySelector('.btn-prev');
    this.$btnPlay = card.querySelector('.btn-play');
    this.$btnNext = card.querySelector('.btn-next');
    this.$bar = card.querySelector('.player-progress .bar');
    this.$progress = card.querySelector('.player-progress');
    this.$barInner = card.querySelector('.player-progress .bar-inner');
    this.$cur = card.querySelector('.time .current');
    this.$dur = card.querySelector('.time .duration');
    this.$vol = card.querySelector('.volume-range');
    this.$panel = card.querySelector('.player-panel');
    this.$queue = card.querySelector('.panel-queue');
    this.$lyrics = card.querySelector('.lyrics-area');
  };

  Player.prototype.restoreState = function(){
    var savedIdx = getStorage(STORAGE_IDX, 0);
    if(typeof savedIdx === 'number' && savedIdx>=0 && savedIdx < this.list.length){
      this.index = savedIdx;
    }
    var v = getStorage(STORAGE_VOL, 0.8);
    this.audio.volume = (typeof v === 'number') ? Math.min(1, Math.max(0, v)) : 0.8;
    if(this.$vol) this.$vol.value = this.audio.volume;
  };

  Player.prototype.render = function(){
    if(!this.list.length){
      this.$song.textContent = '暂无歌曲';
      this.$artist.textContent = '';
      this.$cover.src = DEFAULT_COVER;
      this.$btnPrev.disabled = this.$btnPlay.disabled = this.$btnNext.disabled = true;
    }
    // 渲染队列
    this.renderQueue();
  };

  Player.prototype.load = function(i){
    if(!this.list.length) return;
    i = (i + this.list.length) % this.list.length;
    this.index = i;
    setStorage(STORAGE_IDX, i);

    var item = this.list[i] || {};
    var src = encodeSrc(item.url || '');
    this.audio.src = src;
    if(item.type) this.audio.type = item.type;

    this.$song.textContent = item.title || '未命名';
    this.$artist.textContent = item.artist || '';
    this.$cover.src = item.cover || DEFAULT_COVER;
    this.$dur.textContent = '0:00';
    this.$cur.textContent = '0:00';
    this.$barInner.style.width = '0%';

    // 高亮当前队列项
    this.highlightQueue();

    // 加载歌词（支持自动回退：优先 /lyrics/<同名>.lrc，其次同目录 .lrc）
    this.lrcLines = [];
    this.lrcPlain = false;
    this.activeLyric = -1;
    var self = this;
    var candidates = [];
    if(item.lrc) candidates.push(item.lrc);
    try {
      if(item.url){
        var u = new URL(item.url, location.origin);
        var path = u.pathname;
        var file = path.substring(path.lastIndexOf('/')+1);
        var base = file.replace(/\.[^/.]+$/, '');
        candidates.push('/lyrics/' + base + '.lrc');
        candidates.push(path.replace(/\.[^/.]+$/, '.lrc'));
      }
    } catch(e){
      // 兼容不支持 URL 构造器的环境（如旧版 iOS WebView）
      try {
        var raw = String(item.url||'');
        // 仅处理相对根路径或简单相对路径
        var lastSlash = raw.lastIndexOf('/');
        var file = lastSlash >= 0 ? raw.substring(lastSlash+1) : raw;
        var base = file.replace(/\.[^/.]+$/, '');
        var path = raw;
        candidates.push('/lyrics/' + base + '.lrc');
        candidates.push(path.replace(/\.[^/.]+$/, '.lrc'));
      } catch(_){}
    }
    if(candidates.length){
      tryFetchLRC(candidates.slice(), function(txt){
        var parsed = parseLRC(txt);
        if(parsed && parsed.length){
          self.lrcLines = parsed; self.lrcPlain = false; self._plainLyricRaw = ''; self.renderLyrics();
        } else {
          self.lrcLines = [];
          self.lrcPlain = true;
          self._plainLyricRaw = txt || '';
          if(self.$lyrics){
            var safe = escapeHTML(txt||'');
            self.$lyrics.innerHTML = '<div class="lrc-plain">'+ safe.replace(/\r?\n/g, '<br>') +'</div>';
          }
        }
      }, function(){ self.$lyrics && (self.$lyrics.innerHTML = '<div class="lrc-empty">暂无歌词</div>'); });
    } else {
      this.lrcPlain = false;
      if(self.$lyrics) self.$lyrics.innerHTML = '<div class="lrc-empty">暂无歌词</div>';
    }

    var key = STORAGE_TIME_PREFIX + (item.id || src);
    var lastTime = getStorage(key, 0);

    var onMeta = function(){
      self.$dur.textContent = fmtTime(self.audio.duration);
      // 恢复进度（仅当上一曲保存的时间小于时长）
      if(lastTime && lastTime < (self.audio.duration || 0)){
        try { self.audio.currentTime = lastTime; } catch(e){}
      }
      // 若是纯文本歌词，可在拿到时长后按行等分生成伪时间轴，实现实时高亮（可接受的近似方案）
      try {
        if(self.lrcPlain && self._plainLyricRaw){
          var dur = self.audio.duration || 0;
          if(isFinite(dur) && dur > 0){
            var lines = self._plainLyricRaw.split(/\r?\n/).map(function(s){ return (s||'').trim(); })
              .filter(function(s){ return s && !/^\[.*\]$/.test(s); });
            if(lines.length >= 3){
              var step = dur / lines.length;
              self.lrcLines = lines.map(function(text, i){ return { time: i*step, text: text }; });
              self.lrcPlain = false; // 切换为时间轴模式以启用高亮与点击跳转
              self.renderLyrics();
            }
          }
        }
      } catch(_){}
      self.audio.removeEventListener('loadedmetadata', onMeta);
    };
    this.audio.addEventListener('loadedmetadata', onMeta);
  };

  Player.prototype.play = function(){
    var self = this;
    this.audio.play().then(function(){
      self.$btnPlay.textContent = '⏸';
    }).catch(function(err){
      console.warn('播放被阻止，需用户手势触发', err);
    });
  };

  Player.prototype.pause = function(){
    this.audio.pause();
    this.$btnPlay.textContent = '▶';
  };

  Player.prototype.toggle = function(){
    if(this.audio.paused) this.play(); else this.pause();
  };

  Player.prototype.next = function(){
    this.load(this.index + 1);
    if(!this.audio.paused) this.play();
  };

  Player.prototype.prev = function(){
    this.load(this.index - 1);
    if(!this.audio.paused) this.play();
  };

  Player.prototype.seekTo = function(ratio){
    if(!isFinite(this.audio.duration) || !this.audio.duration) return;
    ratio = Math.max(0, Math.min(1, ratio));
    try { this.audio.currentTime = this.audio.duration * ratio; } catch(e){}
  };

  Player.prototype.renderQueue = function(){
    if(!this.$queue) return;
    var html = '<ul class="queue-list">' + this.list.map(function(it, idx){
      var t = (it && it.title) ? it.title : ('未命名 ' + (idx+1));
      var a = (it && it.artist) ? (' - ' + it.artist) : '';
      return '<li class="queue-item" data-idx="'+idx+'">'+ t + a +'</li>';
    }).join('') + '</ul>';
    this.$queue.innerHTML = html;
    this.highlightQueue();
  };

  Player.prototype.highlightQueue = function(){
    if(!this.$queue) return;
    var items = this.$queue.querySelectorAll('.queue-item');
    Array.prototype.forEach.call(items, function(li){ li.classList.remove('active'); });
    var cur = this.$queue.querySelector('.queue-item[data-idx="'+this.index+'"]') || null;
    if(cur) cur.classList.add('active');
  };

  Player.prototype.renderLyrics = function(){
    if(!this.$lyrics) return;
    if(!this.lrcLines.length){ this.$lyrics.innerHTML = '<div class="lrc-empty">暂无时间轴歌词</div>'; return; }
    var html = this.lrcLines.map(function(l, i){
      var safe = (l.text || '').replace(/[&<>]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]); });
      return '<div class="lrc-line" data-idx="'+i+'">'+ safe +'</div>';
    }).join('');
    this.$lyrics.innerHTML = '<div class="lrc-scroll">'+ html +'</div>';
    this.activeLyric = -1;
  };

  Player.prototype.updateLyrics = function(ct){
    if(!this.$lyrics) return;
    // 纯文本歌词：按歌曲时长平滑滚动
    if(this.lrcPlain){
      var dur = this.audio.duration || 0;
      if(!(isFinite(dur) && dur > 0)) return;
      var plain = this.$lyrics.querySelector('.lrc-plain');
      if(!plain) return;
      var box = plain; // 容器本身滚动
      var ratio = Math.max(0, Math.min(1, ct / dur));
      var maxScroll = Math.max(0, box.scrollHeight - box.clientHeight);
      var dest = Math.floor(maxScroll * ratio);
      try { box.scrollTop = dest; } catch(e){}
      return;
    }

    // 带时间轴歌词：按时间高亮并滚动居中
    if(!this.lrcLines.length) return;
    var i = this.activeLyric;
    while(i+1 < this.lrcLines.length && this.lrcLines[i+1].time <= ct + 0.05){ i++; }
    while(i >=0 && this.lrcLines[i].time > ct + 0.05){ i--; }
    if(i === this.activeLyric) return;
    var box = this.$lyrics.querySelector('.lrc-scroll');
    var prev = this.$lyrics.querySelector('.lrc-line.active');
    if(prev) prev.classList.remove('active');
    var cur = this.$lyrics.querySelector('.lrc-line[data-idx="'+i+'"]');
    if(cur){
      cur.classList.add('active');
      try {
        var top = cur.offsetTop - ((box ? box.clientHeight : this.$lyrics.clientHeight)/2 - cur.clientHeight/2);
        var dest = Math.max(0, top);
        if(box && typeof box.scrollTo === 'function'){
          box.scrollTo({ top: dest, behavior: 'smooth' });
        } else if(box){
          box.scrollTop = dest;
        }
      } catch(e){}
    }
    this.activeLyric = i;
  };

  Player.prototype.bind = function(){
    var self = this;

    // 基于 requestAnimationFrame 的顺滑刷新（播放时更高频率更新 UI 与歌词）
    var tick = function(){
      if(!self._tickActive) return;
      try {
        var ct = self.audio.currentTime || 0;
        var dur = self.audio.duration || 0;
        if(!self.dragging && isFinite(dur) && dur>0){
          self.$cur.textContent = fmtTime(ct);
          self.$dur.textContent = fmtTime(dur);
          self.$barInner.style.width = (100 * ct / dur).toFixed(2) + '%';
        }
        self.updateLyrics(ct);
      } catch(e){}
      self._tickId = window.requestAnimationFrame(tick);
    };
    var startTick = function(){
      if(self._tickActive) return;
      self._tickActive = true;
      self._tickId = window.requestAnimationFrame(tick);
    };
    var stopTick = function(){
      self._tickActive = false;
      if(self._tickId){ try{ cancelAnimationFrame(self._tickId); }catch(_){} self._tickId = 0; }
    };

    if(this.$btnPlay) this.$btnPlay.addEventListener('click', function(){ self.toggle(); });
    if(this.$btnPrev) this.$btnPrev.addEventListener('click', function(){ self.prev(); });
    if(this.$btnNext) this.$btnNext.addEventListener('click', function(){ self.next(); });

    // 左侧三横杠：展开/收起歌单面板
    if(this.$btnMenu){
      this.$btnMenu.addEventListener('click', function(){
        var hidden = self.$panel && self.$panel.hasAttribute('hidden');
        if(self.$panel){
          if(hidden){ self.$panel.removeAttribute('hidden'); }
          else { self.$panel.setAttribute('hidden',''); }
        }
      });
    }

    // 计算相对进度的工具：优先使用 .bar 的尺寸，回退到 .player-progress
    var calcRatio = function(clientX){
      var holder = self.$bar || self.$progress;
      if(!holder) return 0;
      var rect = holder.getBoundingClientRect();
      if(!rect || rect.width <= 0) return 0;
      var r = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, r));
    };

    // 点击进度条（扩大为整个 player-progress 区域）
    if(this.$progress){
      this.$progress.addEventListener('click', function(e){
        if(self.dragging) return; // 刚拖完时忽略 click，避免二次跳转
        if(self._justDragged && (Date.now() - self._justDragged < 250)) return;
        var ratio = calcRatio(e.clientX);
        if(!isFinite(self.audio.duration) || !self.audio.duration){ self.pendingSeek = ratio; }
        else { self.seekTo(ratio); }
      });
    }

    // 拖拽进度（Pointer 优先；扩大为整个 player-progress 区域）
    var onDrag = function(clientX){
      var r = calcRatio(clientX);
      self.dragRatio = r;
      // 预览进度
      self.$barInner.style.width = (100*r).toFixed(2)+'%';
      var dur = self.audio.duration || 0;
      var preview = r * dur;
      if(isFinite(dur) && dur>0) self.$cur.textContent = fmtTime(preview);
    };
    var stopDrag = function(){
      if(!self.dragging) return;
      self.dragging = false;
      self._justDragged = Date.now();
      if(!isFinite(self.audio.duration) || !self.audio.duration){
        self.pendingSeek = self.dragRatio;
      } else {
        self.seekTo(self.dragRatio);
      }
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', touchCancel);
    };
    var mouseMove = function(e){ onDrag(e.clientX); };
    var mouseUp = function(){ stopDrag(); };
    var touchMove = function(e){ if(e.touches&&e.touches[0]) { onDrag(e.touches[0].clientX); e.preventDefault(); } };
    var touchEnd = function(){ stopDrag(); };
    var touchCancel = function(){ stopDrag(); };

    // 优先使用 Pointer Events，避免同时触发鼠标与触摸事件导致的冲突
    if(this.$progress && window.PointerEvent){
      var pointerMove = function(e){ if(self.dragging){ onDrag(e.clientX); e.preventDefault(); } };
      var pointerUp = function(e){ stopDrag(); document.removeEventListener('pointermove', pointerMove); document.removeEventListener('pointerup', pointerUp); document.removeEventListener('pointercancel', pointerUp); try{ self.$progress.releasePointerCapture(e.pointerId); }catch(_){} };
      this.$progress.addEventListener('pointerdown', function(e){ self.dragging = true; try{ self.$progress.setPointerCapture(e.pointerId);}catch(_){} onDrag(e.clientX); e.preventDefault(); document.addEventListener('pointermove', pointerMove, {passive:false}); document.addEventListener('pointerup', pointerUp); document.addEventListener('pointercancel', pointerUp); });
      // 保险起见：在 .bar 上也绑定一次
      if(this.$bar){
        this.$bar.addEventListener('click', function(e){ if(self.dragging) return; if(self._justDragged && (Date.now()-self._justDragged<250)) return; var ratio = calcRatio(e.clientX); if(!isFinite(self.audio.duration)||!self.audio.duration){ self.pendingSeek = ratio; } else { self.seekTo(ratio); } });
        this.$bar.addEventListener('pointerdown', function(e){ self.dragging = true; try{ self.$progress && self.$progress.setPointerCapture && self.$progress.setPointerCapture(e.pointerId);}catch(_){} onDrag(e.clientX); e.preventDefault(); document.addEventListener('pointermove', pointerMove, {passive:false}); document.addEventListener('pointerup', pointerUp); document.addEventListener('pointercancel', pointerUp); });
      }
    } else {
      if(this.$progress){
        this.$progress.addEventListener('mousedown', function(e){ self.dragging = true; onDrag(e.clientX); document.addEventListener('mousemove', mouseMove); document.addEventListener('mouseup', mouseUp); });
        this.$progress.addEventListener('touchstart', function(e){ self.dragging = true; if(e.touches&&e.touches[0]) onDrag(e.touches[0].clientX); e.preventDefault(); document.addEventListener('touchmove', touchMove, {passive:false}); document.addEventListener('touchend', touchEnd); document.addEventListener('touchcancel', touchCancel); });
      }
      if(this.$bar){
        this.$bar.addEventListener('mousedown', function(e){ self.dragging = true; onDrag(e.clientX); document.addEventListener('mousemove', mouseMove); document.addEventListener('mouseup', mouseUp); });
        this.$bar.addEventListener('touchstart', function(e){ self.dragging = true; if(e.touches&&e.touches[0]) onDrag(e.touches[0].clientX); e.preventDefault(); document.addEventListener('touchmove', touchMove, {passive:false}); document.addEventListener('touchend', touchEnd); document.addEventListener('touchcancel', touchCancel); });
      }
    }

    // 音量
    if(this.$vol){
      this.$vol.addEventListener('input', function(){
        var v = parseFloat(self.$vol.value || '0.8');
        v = Math.max(0, Math.min(1, v));
        self.audio.volume = v;
        setStorage(STORAGE_VOL, v);
      });
    }

    // 音频事件
    this.audio.addEventListener('timeupdate', function(){
      if(!isFinite(self.audio.duration) || !self.audio.duration) return;
      var ct = self.audio.currentTime || 0;
      var dur = self.audio.duration || 0;
      if(!self.dragging && !self._tickActive){
        self.$cur.textContent = fmtTime(ct);
        self.$dur.textContent = fmtTime(dur);
        self.$barInner.style.width = (100 * ct / dur).toFixed(2) + '%';
      }

      // 节流存储播放进度
      var now = Date.now();
      if(now - self.savingTick > 1000){
        self.savingTick = now;
        var item = self.list[self.index] || {};
        var key = STORAGE_TIME_PREFIX + (item.id || encodeSrc(item.url||''));
        setStorage(key, Math.floor(ct));
      }

      // 歌词同步（若 rAF 正在运行则由 rAF 负责）
      if(!self._tickActive) self.updateLyrics(ct);
    });

    // 播放/暂停：控制顺滑刷新开关
    this.audio.addEventListener('playing', startTick);
    this.audio.addEventListener('pause', stopTick);
    this.audio.addEventListener('ended', stopTick);

    // 元数据加载完成后，如果存在等待中的拖拽/点击跳转，则执行
    this.audio.addEventListener('loadedmetadata', function(){
      if(self.pendingSeek != null){
        self.seekTo(self.pendingSeek);
        self.pendingSeek = null;
      }
    });

    this.audio.addEventListener('ended', function(){ self.next(); });

    // 队列点击
    if(this.$queue){
      this.$queue.addEventListener('click', function(e){
        var li = closestEl(e.target, '.queue-item');
        if(!li) return;
        var idx = parseInt(li.getAttribute('data-idx')||'-1',10);
        if(isNaN(idx) || idx<0) return;
        self.load(idx);
        self.play();
      });
    }

    // 禁用歌词点击跳转：仅允许通过进度条改变播放进度
    if(this.$lyrics){
      this.$lyrics.addEventListener('click', function(e){
        e.preventDefault();
        if(e.stopPropagation) e.stopPropagation();
        return false;
      });
    }
  };

  function autoInit(){
    // 自动初始化：优先侧栏，否则作为底部固定迷你栏
    var target = document.querySelector('#aside_content') ? '#aside_content' : 'body';
    if(document.getElementById('music-player')) return;
    try { new Player({ mountTarget: target }); } catch(e){ console.error('[MusicPlayer] init failed', e); }
  }

  window.MusicPlayer = {
    init: function(options){ try { return new Player(options||{}); } catch(e){ console.error(e); } }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
