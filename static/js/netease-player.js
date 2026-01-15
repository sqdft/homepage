// 网易云音乐播放器初始化
// 在原有播放器基础上，添加网易云API支持
(function(){
  'use strict';

  // 等待 NeteaseAPI 和 PLAYLIST 加载完成
  function waitForDependencies() {
    return new Promise(function(resolve) {
      var checkInterval = setInterval(function() {
        if (window.NeteaseAPI && window.PLAYLIST) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      // 超时保护
      setTimeout(function() {
        clearInterval(checkInterval);
        if (!window.NeteaseAPI || !window.PLAYLIST) {
          console.error('[NeteasePlayer] 依赖加载超时');
        }
        resolve();
      }, 5000);
    });
  }

  // 初始化播放列表：为每首歌获取URL和歌词
  function initPlaylist() {
    if (!window.PLAYLIST || !Array.isArray(window.PLAYLIST)) {
      console.error('[NeteasePlayer] PLAYLIST 未定义');
      return Promise.resolve();
    }

    console.log('[NeteasePlayer] 开始初始化播放列表...');
    
    // 为每首歌添加加载状态
    window.PLAYLIST.forEach(function(song) {
      song._loading = false;
      song._loaded = false;
      song._error = false;
    });

    // 预加载第一首歌
    if (window.PLAYLIST.length > 0 && window.PLAYLIST[0].neteaseId) {
      return loadSongData(0);
    }

    return Promise.resolve();
  }

  // 加载指定歌曲的数据（URL + 歌词 + 封面）
  function loadSongData(index) {
    var song = window.PLAYLIST[index];
    if (!song || !song.neteaseId) {
      console.warn('[NeteasePlayer] 歌曲', index, '没有 neteaseId');
      return Promise.resolve();
    }

    // 如果已经加载过，直接返回
    if (song._loaded || song._loading) {
      return Promise.resolve();
    }

    song._loading = true;
    console.log('[NeteasePlayer] 加载歌曲数据:', song.title, 'ID:', song.neteaseId);

    return window.NeteaseAPI.getSongFullInfo(song.neteaseId)
      .then(function(info) {
        // 更新歌曲信息
        song.url = info.url;
        song.cover = info.detail.cover;
        song.title = info.detail.title;
        song.artist = info.detail.artist;
        
        // 处理歌词：转换为 data URL
        if (info.lyric) {
          song.lrc = 'data:text/plain;charset=utf-8,' + encodeURIComponent(info.lyric);
        }

        song._loaded = true;
        song._loading = false;
        song._error = false;

        console.log('[NeteasePlayer] 歌曲加载成功:', song.title);
        
        // 触发自定义事件，通知播放器更新
        try {
          var event = new CustomEvent('neteasePlayerSongLoaded', { 
            detail: { index: index, song: song } 
          });
          window.dispatchEvent(event);
        } catch(e) {
          console.warn('[NeteasePlayer] 事件触发失败:', e);
        }

        return song;
      })
      .catch(function(error) {
        console.error('[NeteasePlayer] 加载歌曲失败:', song.title, error);
        song._loading = false;
        song._error = true;
        
        // 标记为错误，但不阻断播放列表
        song.url = null;
        song.lrc = 'data:text/plain;charset=utf-8,' + encodeURIComponent(
          '歌曲加载失败\n\n可能原因：\n- 歌曲需要VIP\n- 版权受限\n- API暂时不可用\n\n请尝试切换到下一首'
        );
        
        return null;
      });
  }

  // 预加载下一首歌（提升切歌体验）
  function preloadNextSong(currentIndex) {
    var nextIndex = (currentIndex + 1) % window.PLAYLIST.length;
    var nextSong = window.PLAYLIST[nextIndex];
    
    if (nextSong && !nextSong._loaded && !nextSong._loading && nextSong.neteaseId) {
      console.log('[NeteasePlayer] 预加载下一首:', nextSong.title);
      loadSongData(nextIndex);
    }
  }

  // 监听播放器切歌事件，自动加载歌曲数据
  function setupAutoLoad() {
    // 监听自定义的切歌事件（需要在 sidebar-player.js 中触发）
    window.addEventListener('musicPlayerSwitch', function(e) {
      var index = e.detail && e.detail.index;
      if (typeof index === 'number') {
        var song = window.PLAYLIST[index];
        if (song && !song._loaded && !song._loading && song.neteaseId) {
          loadSongData(index).then(function() {
            // 加载完成后预加载下一首
            preloadNextSong(index);
          });
        } else if (song && song._loaded) {
          // 当前歌曲已加载，预加载下一首
          preloadNextSong(index);
        }
      }
    });
  }

  // 主初始化函数
  function init() {
    waitForDependencies().then(function() {
      if (!window.NeteaseAPI) {
        console.error('[NeteasePlayer] NeteaseAPI 未加载');
        return;
      }
      if (!window.PLAYLIST || window.PLAYLIST.length === 0) {
        console.warn('[NeteasePlayer] 播放列表为空');
        return;
      }

      console.log('[NeteasePlayer] 初始化完成，API:', window.NeteaseAPI.getApiHost());
      
      // 初始化播放列表
      initPlaylist().then(function() {
        // 设置自动加载
        setupAutoLoad();
        
        // 标记初始化完成
        window.NETEASE_PLAYER_READY = true;
        
        // 触发就绪事件
        try {
          var event = new CustomEvent('neteasePlayerReady');
          window.dispatchEvent(event);
        } catch(e) {}
      });
    });
  }

  // 暴露加载函数到全局，供播放器调用
  window.loadNeteaseSong = loadSongData;
  window.preloadNextNeteaseSong = preloadNextSong;

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
