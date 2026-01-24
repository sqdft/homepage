(function(){
  'use strict';
  var DEBUG_SEEK = true; // 开启最小化调试输出，完成排查后可改为 false

  if(!Array.isArray(window.PLAYLIST) || window.PLAYLIST.length === 0){
    console.warn('[SidebarPlayer] PLAYLIST 为空');
    return;
  }

  // -------- utils --------
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function el(tag, cls){ var n=document.createElement(tag); if(cls) n.className=cls; return n; }
  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
  function fmtTime(sec){ sec=Math.max(0, sec|0); var m=(sec/60|0); var s=(sec%60|0); return (m<10?'0':'')+m+":"+(s<10?'0':'')+s; }
  // 根据条目构造音频源优先级列表：优先 item.srcs（可填国内源），最后回退到 item.url
  function buildSrcList(item){
    var arr = [];
    try{
      if(item && Array.isArray(item.srcs)){
        item.srcs.forEach(function(s){ if(typeof s==='string' && s.trim()){ arr.push(s.trim()); } });
      }
      if(item && typeof item.url === 'string'){
        var u = item.url.trim(); if(u && arr.indexOf(u)===-1){ arr.push(u); }
      }
    }catch(_){ }
    return arr;
  }
  function parseLrc(text){
    // 返回按时间排序的 {t, txt} 数组
    var lines = (text||'').split(/\r?\n/);
    var out=[];
    var timeRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
    lines.forEach(function(line){
      var m, lastIndex=0, times=[]; timeRe.lastIndex=0;
      while((m = timeRe.exec(line))){
        var mm = parseInt(m[1],10)||0; var ss = parseInt(m[2],10)||0; var xx = parseInt(m[3]||'0',10)||0;
        var t = mm*60 + ss + xx/100; times.push(t); lastIndex = timeRe.lastIndex;
      }
      var txt = line.replace(timeRe,'').trim();
      if(times.length===0){ return; }
      times.forEach(function(t){ out.push({t:t, txt:txt}); });
    });
    out.sort(function(a,b){ return a.t - b.t; });
    return out;
  }
  function hasTimestamp(text){ return /\[[0-9]{1,2}:[0-9]{2}(?:\.[0-9]{1,2})?\]/.test(text||''); }
  function fetchText(url){ return fetch(encodeURI(url)).then(function(r){ return r.ok? r.text(): Promise.reject(r.status); }); }
  function loadAudioDuration(url){
    return new Promise(function(resolve){
      var a = new Audio();
      a.preload='metadata';
      a.src = encodeURI(url);
      var done = function(){ resolve(isFinite(a.duration)? a.duration : 0); cleanup(); };
      var cleanup = function(){ a.removeEventListener('loadedmetadata', done); a.removeEventListener('error', done); };
      a.addEventListener('loadedmetadata', done);
      a.addEventListener('error', done);
    });
  }
  // 若文本疑似为百分号编码（%E3%81%AA 等），尝试安全解码
  function maybePercentDecodeText(s){
    if(s==null || s==='') return s;
    try {
      var m = String(s).match(/%[0-9A-Fa-f]{2}/g);
      if(m && m.length >= 2){
        try { return decodeURIComponent(s); } catch(e){
          // 逐段解码：对连续 %xx 串尝试单独解码，失败保留原样
          return String(s).replace(/(?:%[0-9A-Fa-f]{2})+/g, function(seg){
            try { return decodeURIComponent(seg); } catch(_) { return seg; }
          });
        }
      }
    } catch(_){ }
    return s;
  }
  function buildPseudoTimedLrc(plainText, duration){
    // 将无时间戳歌词根据“行权重”分配到整曲时长
    // 清理：去除段落标记与无用行（如“歌词：”、“[主歌]”、“[副歌]”、“[间奏]”等），以及空行
    var rawLines = (plainText||'').split(/\r?\n/);
    var sectionTagRe = /^\s*\[[^\]]+\]\s*$/; // e.g. [主歌] [副歌] [间奏] ...（仅在无时间戳模式下处理）
    var uselessHeadRe = /^\s*歌词[:：]?\s*$/;
    var lines = rawLines.map(function(t){ return (t||'').trim(); })
      .filter(function(t){ return t && !sectionTagRe.test(t) && !uselessHeadRe.test(t); });
    if(lines.length===0){ return ''; }

    var startOffset = 0.5; // s：起始预留，避免一上来就滚动
    var minLine = 0.9;     // s：每行最小时长，避免过快跳行

    var dur = parseFloat(duration)||0;
    // 若无法拿到时长，使用保守估计：每行 2s
    if(!isFinite(dur) || dur <= 0){ dur = Math.max(lines.length * 2.0 + startOffset, 0); }
    var usable = Math.max(0, dur - startOffset);

    // 计算每行权重：与字数相关，含标点额外加权
    function punctCount(s){ var m = s.match(/[，。,.、；;？！?!…—\-]/g); return m? m.length : 0; }
    var weights = lines.map(function(s){
      var L = Math.max(1, s.length);
      var P = punctCount(s);
      // 权重：基础 1 + 字数^0.9 + 标点加成（0.8/个）
      return 1 + Math.pow(L, 0.9) + P * 0.8;
    });
    var sumW = weights.reduce(function(a,b){ return a+b; }, 0) || 1;

    var out=[]; var t=startOffset;
    for(var i=0;i<lines.length;i++){
      var share = usable * (weights[i] / sumW);
      var sec = Math.max(minLine, share);
      // 写入当前时间点
      var mm = (t/60|0); var ss = (t%60|0); var cs = Math.round((t - (mm*60+ss))*100);
      out.push('['+String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0')+'.'+String(cs).padStart(2,'0')+'] '+lines[i]);
      t += sec;
    }
    return out.join('\n');
  }

  // -------- state --------
  var state = {
    idx: 0,
    lrcMap: {}, // key: idx -> [{t, txt}]
    srcList: [], // 当前曲目的源列表（优先国内）
    srcIndex: 0, // 正在使用的源索引
  };
  function lsGet(k, d){ try{ var v = localStorage.getItem(k); return v==null? d: JSON.parse(v);}catch(e){return d;} }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  state.idx = clamp(parseInt(lsGet('music_idx', 0),10)||0, 0, window.PLAYLIST.length-1);
  state.vol = clamp(parseFloat(lsGet('music_volume', 0.8))||0.8, 0, 1);

  // -------- build UI --------
  function ensureCard(){
    var aside = qs('#aside_content'); if(!aside) return null;
    var card = qs('#music-card'); if(card) return card;
    card = el('div', 'card-widget card-music'); card.id='music-card';
    var content = el('div', 'card-content'); card.appendChild(content);

    var header = el('div', 'mp-header');
    var cover = el('img', 'mp-cover'); cover.alt='cover'; header.appendChild(cover);
    var info = el('div', 'mp-info');
    var title = el('div', 'mp-title');
    var artist = el('div', 'mp-artist');
    info.appendChild(title); info.appendChild(artist);
    header.appendChild(info);

    var controls = el('div', 'mp-controls');
    var btnPrev = el('button', 'mp-btn mp-prev'); btnPrev.title='上一曲'; btnPrev.innerHTML='⏮';
    var btnPlay = el('button', 'mp-btn mp-play'); btnPlay.title='播放/暂停'; btnPlay.innerHTML='▶️';
    var btnNext = el('button', 'mp-btn mp-next'); btnNext.title='下一曲'; btnNext.innerHTML='⏭';
    controls.appendChild(btnPrev); controls.appendChild(btnPlay); controls.appendChild(btnNext);

    var progress = el('div', 'mp-progress');
    var timeL = el('span', 'mp-time mp-time-l'); timeL.textContent='00:00';
    var barWrap = el('div', 'mp-bar-wrap');
    var barBg = el('div', 'mp-bar-bg'); var barInner = el('div', 'mp-bar-inner');
    barBg.appendChild(barInner); barWrap.appendChild(barBg);
    var timeR = el('span', 'mp-time mp-time-r'); timeR.textContent='00:00';
    progress.appendChild(timeL); progress.appendChild(barWrap); progress.appendChild(timeR);

    var volume = el('div', 'mp-volume');
    var volLabel = el('span', 'mp-vol-label'); volLabel.textContent = '🔊';
    var volWrap = el('div', 'mp-vol-wrap');
    var volBg = el('div', 'mp-vol-bg'); var volInner = el('div', 'mp-vol-inner');
    volBg.appendChild(volInner); volWrap.appendChild(volBg);
    volume.appendChild(volLabel); volume.appendChild(volWrap);

    var lrc = el('div', 'mp-lrc');
    var lrcInner = el('div', 'mp-lrc-inner'); lrc.appendChild(lrcInner);

    var list = el('ol', 'mp-list');

    content.appendChild(header);
    content.appendChild(controls);
    content.appendChild(progress);
    content.appendChild(volume);
    content.appendChild(lrc);
    content.appendChild(list);

    aside.insertBefore(card, aside.firstChild);

    return {card:card, content:content, cover:cover, title:title, artist:artist,
      btnPrev:btnPrev, btnPlay:btnPlay, btnNext:btnNext,
      timeL:timeL, timeR:timeR, barWrap:barWrap, barBg:barBg, barInner:barInner,
      volume:volume, volLabel:volLabel, volWrap:volWrap, volBg:volBg, volInner:volInner,
      lrc:lrc, lrcInner:lrcInner, list:list};
  }

  var ui = ensureCard(); if(!ui){ return; }

  // -------- audio --------
  var audio = new Audio();
  audio.preload = 'metadata';
  // 暴露到 window，便于控制台直接测试：_mpAudio.currentTime=20
  try{ window._mpAudio = audio; window._mpUI = ui; }catch(e){}
  // 若在元数据尚未加载时发生拖拽/点击，记录待应用的 seek 比例
  var pendingSeekRatio = null;
  // 若在切歌后需要恢复进度，在 metadata 就绪后再应用
  var pendingStartTime = null;
  // 当用户交互而 duration 未知时，为取回 metadata 临时播放一次，随后恢复暂停
  var needPauseAfterMeta = false;
  // 歌词延后加载控制，防止在不可播放或切歌竞态下提前渲染
  var lastLoadedLyricsIdx = -1;
  var lastLoadedSrc = '';

  function setAudioToCurrent(){
    var src = state.srcList[state.srcIndex] || '';
    audio.src = encodeURI(src||'');
    // 重置播放位置，确保从头开始播放
    audio.currentTime = 0;
    try{ audio.load(); }catch(e){}
    // 切换源时，保持歌词区域清空，等待 canplay 再决定是否加载
    ui.lrcInner.innerHTML = '';
    lastLoadedLyricsIdx = -1;
    try{ lastLoadedSrc = audio.src; }catch(_){ lastLoadedSrc=''; }
  }

  function updateDurationUI(){
    var dur = audio.duration;
    if(!isFinite(dur) || dur<=0){
      // 某些浏览器在可播放前 duration=NaN/0，尝试从 seekable 推断
      try{ if(audio.seekable && audio.seekable.length>0){ dur = audio.seekable.end(0); } }catch(e){}
    }
    if(isFinite(dur) && dur>0){ ui.timeR.textContent = fmtTime(dur); }
  }

  function maybeApplyPending(reason){
    var applied = false;
    // 优先使用 duration，其次使用 seekable 末端作为估算时长
    var dur = audio.duration; var hasDur = isFinite(dur) && dur > 0;
    var seekEnd = 0; var hasSeek = false;
    try { if(audio.seekable && audio.seekable.length>0){ seekEnd = audio.seekable.end(audio.seekable.length-1); hasSeek = seekEnd>0; } } catch(e){}

    if(pendingSeekRatio != null){
      if(hasDur){
        audio.currentTime = clamp(pendingSeekRatio,0,1) * dur;
        pendingSeekRatio = null; applied = true;
      } else if(hasSeek){
        audio.currentTime = clamp(pendingSeekRatio,0,1) * seekEnd;
        pendingSeekRatio = null; applied = true;
      }
      if(applied && DEBUG_SEEK){ console.log('[apply pendingSeek]', reason, 'ct=', audio.currentTime.toFixed(2)); }
    }

    if(pendingStartTime != null){
      var pst = pendingStartTime;
      if(hasDur){
        try{ audio.currentTime = pst; }catch(e){}
        pendingStartTime = null; applied = true;
      } else if(hasSeek && pst <= seekEnd){
        try{ audio.currentTime = pst; }catch(e){}
        pendingStartTime = null; applied = true;
      }
      if(applied && DEBUG_SEEK){ console.log('[apply pendingStart]', reason, 'ct=', audio.currentTime.toFixed(2)); }
    }

    if(applied){ syncProgress(); }
    return applied;
  }
  audio.addEventListener('timeupdate', function(){
    if(DEBUG_SEEK && !draggingProgress){ /* console.debug('[timeupdate]', 'ct=', (audio.currentTime||0).toFixed(2)); */ }
    maybeApplyPending('timeupdate');
    syncProgress(); syncLyrics(); persistTime();
  });
  audio.addEventListener('loadedmetadata', function(){
    updateDurationUI();
    if(DEBUG_SEEK){ console.log('[loadedmetadata] duration =', audio.duration); }
    // 应用等待中的 seek
    if(pendingSeekRatio != null){
      var dur = audio.duration||0;
      if(isFinite(dur) && dur>0){
        audio.currentTime = clamp(pendingSeekRatio,0,1) * dur;
        syncProgress();
      }
      pendingSeekRatio = null;
    }
    // 应用待恢复的时间点
    maybeApplyPending('loadedmetadata');
    if(needPauseAfterMeta){ try{ audio.pause(); audio.muted=false; }catch(e){} needPauseAfterMeta=false; if(DEBUG_SEEK){ console.log('[probe] paused after metadata'); } }
  });
  audio.addEventListener('durationchange', function(){ updateDurationUI(); maybeApplyPending('durationchange'); if(DEBUG_SEEK){ console.log('[durationchange]', audio.duration); } });
  audio.addEventListener('loadeddata', function(){ updateDurationUI(); maybeApplyPending('loadeddata'); if(DEBUG_SEEK){ console.log('[loadeddata]'); } });
  audio.addEventListener('canplay', function(){ 
    updateDurationUI(); 
    maybeApplyPending('canplay'); 
    // 仅在当前音频可播放后再加载歌词，且只加载一次，避免切歌竞态
    try{
      if(lastLoadedLyricsIdx !== state.idx && audio.currentSrc === lastLoadedSrc){
        loadLyricsFor(state.idx).then(function(){ syncLyrics(); });
        lastLoadedLyricsIdx = state.idx;
      }
    }catch(_){ }
    if(DEBUG_SEEK){ console.log('[canplay]'); }
  });
  audio.addEventListener('canplaythrough', function(){ updateDurationUI(); maybeApplyPending('canplaythrough'); if(DEBUG_SEEK){ console.log('[canplaythrough]'); } });
  audio.addEventListener('progress', function(){ maybeApplyPending('progress'); });
  audio.addEventListener('error', function(e){ 
    console.error('[audio:error]', audio.error || e, 'src=', audio.currentSrc);
    // 若存在备选源，自动尝试下一源
    try{
      if(state.srcList && state.srcIndex < state.srcList.length - 1){
        state.srcIndex++;
        if(DEBUG_SEEK){ console.warn('[audio:error] fallback to source#'+state.srcIndex, state.srcList[state.srcIndex]); }
        setAudioToCurrent();
        audio.play().catch(function(){});
        return;
      }
    }catch(_){ }
    // 无可用备选源：不展示任何歌词
    try{ state.lrcMap[state.idx] = []; }catch(_){ }
    try{ ui.lrcInner.innerHTML = ''; }catch(_){ }
  });
  audio.addEventListener('ended', function(){ 
    // 重置播放位置，避免下次播放时从结束位置开始
    audio.currentTime = 0;
    // 清除当前歌曲的保存位置，避免下次播放时从结束位置开始
    lsSet('music_pos_'+state.idx, 0);
    next(); 
  });
  audio.volume = state.vol;
  ui.volInner.style.width = (state.vol*100).toFixed(2)+'%';
  // 操作型按钮：播放中显示“暂停(⏸)”，暂停时显示“播放(▶️)”
  audio.addEventListener('play', function(){ setPauseIcon(); });
  audio.addEventListener('pause', function(){ setPlayIcon(); });

  // -------- progress drag --------
  var draggingProgress = false;
  var suppressNextClick = false;
  (function(){
    var dragging = false; var wasPlaying = false; var lastRatio = 0;
    function previewAtRatio(r){
      ui.barInner.style.width = (r*100).toFixed(2)+'%';
      var dur = audio.duration||0; if(isFinite(dur) && dur>0){ ui.timeL.textContent = fmtTime(r*dur); }
    }
    function calcRatioByClientX(x){
      var rect = ui.barWrap.getBoundingClientRect();
      var ratio = (x - rect.left) / (rect.width||1);
      return clamp(ratio, 0, 1);
    }
    function startDrag(x){
      // 用户开始拖拽，取消任何待恢复的起始时间，避免拖拽后被 0 覆盖
      pendingStartTime = null;
      dragging = true; draggingProgress = true; wasPlaying = !audio.paused; if(wasPlaying) audio.pause();
      lastRatio = calcRatioByClientX(x); previewAtRatio(lastRatio);
      if(DEBUG_SEEK){ console.log('[drag:start]', 'x=', x, 'ratio=', lastRatio.toFixed(3)); }
    }
    function moveDrag(x){ if(!dragging) return; lastRatio = calcRatioByClientX(x); previewAtRatio(lastRatio); if(DEBUG_SEEK){ /* console.debug('[drag:move]', lastRatio.toFixed(3)); */ } }
    function endDrag(){
      if(!dragging) return; dragging=false; draggingProgress=false;
      var dur = audio.duration||0; 
      if(isFinite(dur) && dur>0){ 
        audio.currentTime = lastRatio * dur; 
        if(DEBUG_SEEK){ console.log('[drag:end]', 'seek to', (lastRatio*dur).toFixed(2), 'ratio=', lastRatio.toFixed(3)); }
      } else {
        // 元数据未就绪，记录待应用的 seek
        pendingSeekRatio = lastRatio;
        // 尝试触发一次元数据拉取：若当前是暂停态，则静音播放并在 metadata 到达后恢复暂停
        if(audio.paused){ try{ audio.muted=true; audio.play().then(function(){ if(DEBUG_SEEK){ console.log('[probe] play to fetch metadata'); } }).catch(function(){}); needPauseAfterMeta=true; }catch(e){} }
        if(DEBUG_SEEK){ console.log('[drag:end]', 'pending seek ratio=', lastRatio.toFixed(3)); }
      }
      suppressNextClick = true; // 防止拖拽后的 click 触发二次定位
      syncProgress(); if(wasPlaying){ audio.play().catch(function(){}); }
      wasPlaying = false;
    }
    ui.barWrap.addEventListener('mousedown', function(e){ startDrag(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', function(e){ if(!dragging) return; moveDrag(e.clientX); e.preventDefault(); });
    window.addEventListener('mouseup', function(){ endDrag(); });
    ui.barWrap.addEventListener('touchstart', function(e){ var t=e.touches&&e.touches[0]; if(t) startDrag(t.clientX); }, {passive:true});
    window.addEventListener('touchmove', function(e){ if(!dragging) return; var t=e.touches&&e.touches[0]; if(t) moveDrag(t.clientX); e.preventDefault(); }, {passive:false});
    window.addEventListener('touchend', function(){ endDrag(); });
    // click fallback (no drag)
    ui.barWrap.addEventListener('click', function(e){ 
      if(suppressNextClick){ suppressNextClick=false; return; }
      // 用户主动点击 -> 取消任何待恢复的起始时间
      pendingStartTime = null;
      if(dragging) return; 
      var r = calcRatioByClientX(e.clientX); 
      var dur=audio.duration||0; 
      if(isFinite(dur)&&dur>0){ 
        audio.currentTime = r*dur; 
        if(DEBUG_SEEK){ console.log('[click:wrap]', 'ratio=', r.toFixed(3), 'seek to', (r*dur).toFixed(2)); }
      } else {
        // 元数据未就绪，记录待应用的 seek
        pendingSeekRatio = r;
        if(audio.paused){ try{ audio.muted=true; audio.play().then(function(){ if(DEBUG_SEEK){ console.log('[probe] play to fetch metadata'); } }).catch(function(){}); needPauseAfterMeta=true; }catch(e){} }
        if(DEBUG_SEEK){ console.log('[click:wrap]', 'pending ratio=', r.toFixed(3)); }
      }
      syncProgress(); 
    });

    // 同步将事件绑定到 .mp-bar-bg，避免命中子元素时事件丢失
    ui.barBg.addEventListener('mousedown', function(e){ startDrag(e.clientX); e.preventDefault(); e.stopPropagation(); });
    ui.barBg.addEventListener('touchstart', function(e){ var t=e.touches&&e.touches[0]; if(t) startDrag(t.clientX); if(e && e.stopPropagation) e.stopPropagation(); }, {passive:true});
    ui.barBg.addEventListener('click', function(e){ 
      if(suppressNextClick){ suppressNextClick=false; if(e && e.stopPropagation) e.stopPropagation(); return; }
      // 用户主动点击 -> 取消任何待恢复的起始时间
      pendingStartTime = null;
      if(dragging) return; 
      var r = calcRatioByClientX(e.clientX); 
      var dur=audio.duration||0; 
      if(isFinite(dur)&&dur>0){ 
        audio.currentTime = r*dur; 
        if(DEBUG_SEEK){ console.log('[click:bg]', 'ratio=', r.toFixed(3), 'seek to', (r*dur).toFixed(2)); }
      } else {
        pendingSeekRatio = r;
        if(audio.paused){ try{ audio.muted=true; audio.play().then(function(){ if(DEBUG_SEEK){ console.log('[probe] play to fetch metadata'); } }).catch(function(){}); needPauseAfterMeta=true; }catch(e){} }
        if(DEBUG_SEEK){ console.log('[click:bg]', 'pending ratio=', r.toFixed(3)); }
      }
      syncProgress(); if(e && e.stopPropagation) e.stopPropagation();
    });
  })();

  // -------- volume drag --------
  (function(){
    function setVolRatio(r){ r = clamp(r,0,1); ui.volInner.style.width = (r*100).toFixed(2)+'%'; audio.volume = r; lsSet('music_volume', r); }
    function calcRatioByClientXVol(x){ var rect = ui.volWrap.getBoundingClientRect(); var ratio = (x-rect.left)/(rect.width||1); return clamp(ratio,0,1); }
    var dragging=false;
    ui.volWrap.addEventListener('mousedown', function(e){ dragging=true; setVolRatio(calcRatioByClientXVol(e.clientX)); e.preventDefault(); });
    window.addEventListener('mousemove', function(e){ if(!dragging) return; setVolRatio(calcRatioByClientXVol(e.clientX)); e.preventDefault(); });
    window.addEventListener('mouseup', function(){ dragging=false; });
    ui.volWrap.addEventListener('touchstart', function(e){ dragging=true; var t=e.touches&&e.touches[0]; if(t) setVolRatio(calcRatioByClientXVol(t.clientX)); }, {passive:true});
    window.addEventListener('touchmove', function(e){ if(!dragging) return; var t=e.touches&&e.touches[0]; if(t) setVolRatio(calcRatioByClientXVol(t.clientX)); e.preventDefault(); }, {passive:false});
    window.addEventListener('touchend', function(){ dragging=false; });
    ui.volWrap.addEventListener('click', function(e){ setVolRatio(calcRatioByClientXVol(e.clientX)); });
  })();

  function syncProgress(){
    if(draggingProgress) return;
    var ct = audio.currentTime||0, dur = audio.duration||0;
    // 如果还没有可靠的时长，但存在待应用的 seek 比例，则维持预览宽度，避免视觉回弹到 0%
    if((!isFinite(dur) || dur<=0) && pendingSeekRatio!=null){
      ui.barInner.style.width = (pendingSeekRatio*100).toFixed(2)+'%';
    } else if(isFinite(dur) && dur>0){
      ui.barInner.style.width = (100*ct/dur).toFixed(2)+'%';
    }
    ui.timeL.textContent = fmtTime(ct);
    ui.timeR.textContent = fmtTime(dur);
  }

  // -------- lyrics --------
  function renderLyrics(arr){
    ui.lrcInner.innerHTML = '';
    arr.forEach(function(item){ var p = el('p'); p.textContent=item.txt||''; ui.lrcInner.appendChild(p); });
  }
  function renderPlainLyrics(text){
    ui.lrcInner.innerHTML = '';
    var lines = String(text||'').split(/\r?\n/);
    lines.forEach(function(line){ var p = el('p'); p.textContent = line; ui.lrcInner.appendChild(p); });
  }
  function syncLyrics(){
    var arr = state.lrcMap[state.idx]; if(!arr || arr.length===0) return;
    var t = audio.currentTime||0;
    var i = arr.findIndex(function(line,idx){ return t < line.t && idx>0; });
    var curIdx = (i===-1)? arr.length-1 : Math.max(0, i-1);
    var nodes = qsa('p', ui.lrcInner);
    nodes.forEach(function(n,j){ n.classList.toggle('on', j===curIdx); });
    // scroll into view
    var cur = nodes[curIdx]; if(cur){ var top = cur.offsetTop - ui.lrc.clientHeight/2 + cur.clientHeight/2; ui.lrc.scrollTop = clamp(top, 0, ui.lrcInner.scrollHeight); }
  }

  function loadLyricsFor(index){
    var item = window.PLAYLIST[index]; if(!item || !item.lrc){ state.lrcMap[index]=[]; renderLyrics([]); return Promise.resolve(); }
    return fetchText(item.lrc).then(function(txt){
      var raw = maybePercentDecodeText(txt);
      if(hasTimestamp(raw)){
        var arr = parseLrc(raw); state.lrcMap[index]=arr; renderLyrics(arr); return; }
      // 无时间戳：不再生成伪时间轴，直接静态展示
      state.lrcMap[index]=[];
      renderPlainLyrics(raw);
    }).catch(function(){ state.lrcMap[index]=[]; renderLyrics([]); });
  }

  // -------- playlist UI --------
  function buildList(){
    ui.list.innerHTML='';
    window.PLAYLIST.forEach(function(it, i){
      var li = el('li'); li.textContent = (i+1)+'  '+(it.title||'');
      li.addEventListener('click', function(){ switchTo(i, true); });
      ui.list.appendChild(li);
    });
  }

  // -------- switch / controls --------
  function switchTo(i, autoPlay){
    state.idx = i = clamp(i, 0, window.PLAYLIST.length-1);
    lsSet('music_idx', i);
    var item = window.PLAYLIST[i] || {};
    ui.title.textContent = item.title || '';
    ui.artist.textContent = item.artist || '';
    ui.cover.src = item.cover || '/static/img/img1.png';
    // 切歌时清理探测播放标志，避免上一次交互未完成导致新歌在 metadata 到达后被意外暂停
    needPauseAfterMeta = false;
    
    // 触发切歌事件，通知网易云播放器加载数据
    try {
      var event = new CustomEvent('musicPlayerSwitch', { detail: { index: i } });
      window.dispatchEvent(event);
    } catch(e) {}
    
    // 如果是网易云歌曲且未加载，先加载数据
    if (item.neteaseId && !item._loaded && typeof window.loadNeteaseSong === 'function') {
      ui.title.textContent = item.title + ' (加载中...)';
      window.loadNeteaseSong(i).then(function() {
        // 加载完成后更新UI和播放
        var updatedItem = window.PLAYLIST[i];
        ui.title.textContent = updatedItem.title || '';
        ui.artist.textContent = updatedItem.artist || '';
        ui.cover.src = updatedItem.cover || '/static/img/img1.png';
        state.srcList = buildSrcList(updatedItem);
        state.srcIndex = 0;
        setAudioToCurrent();
        continueSwitch(i, autoPlay);
      }).catch(function() {
        ui.title.textContent = item.title + ' (加载失败)';
        // 即使失败也继续，让用户可以切到下一首
        state.srcList = buildSrcList(item);
        state.srcIndex = 0;
        setAudioToCurrent();
        continueSwitch(i, autoPlay);
      });
      return;
    }
    
    // 构建源列表（优先国内 srcs，回退 url），并设置当前源
    state.srcList = buildSrcList(item);
    state.srcIndex = 0;
    setAudioToCurrent();
    continueSwitch(i, autoPlay);
  }
  
  function continueSwitch(i, autoPlay){
    var item = window.PLAYLIST[i] || {};
    // 恢复进度：等待 metadata 就绪后再应用，避免早期赋值被忽略
    var saved = parseInt(lsGet('music_pos_'+i, 0),10)||0;
    pendingStartTime = isFinite(saved) ? saved : 0;

    // 启动短期轮询，确保在 duration 迟迟为 0 时也能尽快应用 pending
    try{ if(maybeApplyPending._tmr){ clearInterval(maybeApplyPending._tmr); } }catch(e){}
    var t0 = Date.now();
    maybeApplyPending._tmr = setInterval(function(){
      if(pendingSeekRatio==null && pendingStartTime==null){ clearInterval(maybeApplyPending._tmr); return; }
      maybeApplyPending('poll');
      if(Date.now() - t0 > 6000){ clearInterval(maybeApplyPending._tmr); }
    }, 200);

    // 歌词将于 canplay 时按需加载

    if(autoPlay){ audio.play().catch(function(){}); setPauseIcon(); }
    else { setPlayIcon(); }
    highlightListItem(i);
  }
  function highlightListItem(i){
    qsa('.mp-list li', ui.card).forEach(function(li, idx){ li.classList.toggle('on', idx===i); });
  }
  function prev(){
    var n = state.idx - 1;
    if(n < 0) n = window.PLAYLIST.length - 1;
    switchTo(n, true);
  }
  function next(){
    var n = state.idx + 1;
    if(n >= window.PLAYLIST.length) n = 0;
    switchTo(n, true);
  }
  function toggle(){ if(audio.paused){ audio.play().catch(function(){}); setPauseIcon(); } else { audio.pause(); setPlayIcon(); } }
  // 设置按钮为“播放(▶️)”或“暂停(⏸)”图标
  function setPlayIcon(){ ui.btnPlay.textContent = '▶️'; }
  function setPauseIcon(){ ui.btnPlay.textContent = '⏸'; }
  function persistTime(){
    var now = Date.now();
    if(!persistTime._t || now - persistTime._t > 800){
      persistTime._t = now;
      var currentTime = Math.floor(audio.currentTime||0);
      var duration = audio.duration||0;
      // 如果歌曲即将结束（剩余时间少于2秒），不保存位置，避免下次从结束位置开始
      if(isFinite(duration) && duration > 0 && (duration - currentTime) < 2){
        lsSet('music_pos_'+state.idx, 0);
      } else {
        lsSet('music_pos_'+state.idx, currentTime);
      }
    }
  }

  ui.btnPrev.addEventListener('click', prev);
  ui.btnNext.addEventListener('click', next);
  ui.btnPlay.addEventListener('click', toggle);

  // 初始化
  buildList();
  switchTo(state.idx, false);

})();
