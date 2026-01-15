// 网易云音乐 API 适配器
// 使用公共实例，如果不稳定可以换成自己部署的地址
(function(){
  'use strict';

  // 公共API实例列表（按优先级排序，自动回退）
  var API_HOSTS = [
    'https://netease-cloud-music-api-rouge-six.vercel.app',
    'https://netease-api.fe-mm.com',
    'https://music-api-jwvqvoecpq.cn-hangzhou.fcapp.run'
  ];
  
  var currentHostIndex = 0;

  function getApiHost() {
    return API_HOSTS[currentHostIndex] || API_HOSTS[0];
  }

  // 切换到下一个API实例
  function switchToNextHost() {
    currentHostIndex = (currentHostIndex + 1) % API_HOSTS.length;
    console.warn('[NeteaseAPI] 切换到备用API:', getApiHost());
  }

  // 通用请求函数，支持自动重试
  function request(path, params, retryCount) {
    retryCount = retryCount || 0;
    var url = getApiHost() + path;
    var query = [];
    if (params) {
      for (var key in params) {
        if (params.hasOwnProperty(key)) {
          query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
      }
    }
    if (query.length > 0) {
      url += '?' + query.join('&');
    }

    return fetch(url)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        if (data.code !== 200) {
          throw new Error('API Error: ' + data.code);
        }
        return data;
      })
      .catch(function(error) {
        console.error('[NeteaseAPI] 请求失败:', url, error);
        // 如果失败且还有重试次数，切换API实例重试
        if (retryCount < API_HOSTS.length - 1) {
          switchToNextHost();
          return request(path, params, retryCount + 1);
        }
        throw error;
      });
  }

  // 获取歌曲播放URL
  function getSongUrl(id) {
    return request('/song/url', { id: id, br: 320000 })
      .then(function(data) {
        if (data.data && data.data[0]) {
          return data.data[0].url;
        }
        throw new Error('无法获取歌曲URL');
      });
  }

  // 获取歌词
  function getLyric(id) {
    return request('/lyric', { id: id })
      .then(function(data) {
        // 优先返回翻译歌词，如果没有则返回原歌词
        if (data.lrc && data.lrc.lyric) {
          return data.lrc.lyric;
        }
        return '';
      });
  }

  // 获取歌曲详情
  function getSongDetail(id) {
    return request('/song/detail', { ids: id })
      .then(function(data) {
        if (data.songs && data.songs[0]) {
          var song = data.songs[0];
          return {
            id: song.id,
            title: song.name,
            artist: song.ar.map(function(a) { return a.name; }).join(' / '),
            album: song.al.name,
            cover: song.al.picUrl,
            duration: song.dt / 1000 // 毫秒转秒
          };
        }
        throw new Error('无法获取歌曲详情');
      });
  }

  // 搜索歌曲
  function searchSong(keyword, limit) {
    limit = limit || 10;
    return request('/search', { keywords: keyword, limit: limit })
      .then(function(data) {
        if (data.result && data.result.songs) {
          return data.result.songs.map(function(song) {
            return {
              id: song.id,
              title: song.name,
              artist: song.artists.map(function(a) { return a.name; }).join(' / '),
              album: song.album.name
            };
          });
        }
        return [];
      });
  }

  // 批量获取歌曲完整信息（URL + 歌词 + 详情）
  function getSongFullInfo(id) {
    return Promise.all([
      getSongUrl(id),
      getLyric(id),
      getSongDetail(id)
    ]).then(function(results) {
      return {
        url: results[0],
        lyric: results[1],
        detail: results[2]
      };
    });
  }

  // 暴露API到全局
  window.NeteaseAPI = {
    getSongUrl: getSongUrl,
    getLyric: getLyric,
    getSongDetail: getSongDetail,
    searchSong: searchSong,
    getSongFullInfo: getSongFullInfo,
    getApiHost: getApiHost
  };

  console.log('[NeteaseAPI] 已加载，当前API:', getApiHost());
})();
