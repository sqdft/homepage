// QQ音乐 API 适配器（国内访问更稳定）
(function(){
  'use strict';

  // QQ音乐公共API（国内可访问）
  var API_BASE = 'https://c.y.qq.com';
  
  // 备用API列表
  var API_HOSTS = [
    'https://u.y.qq.com',
    'https://c.y.qq.com'
  ];

  // 获取歌曲播放URL（使用歌曲mid）
  function getSongUrl(songmid) {
    // QQ音乐的URL获取比较复杂，需要vkey
    // 这里使用简化的公开接口
    var url = API_BASE + '/base/fcgi-bin/fcg_music_express_mobile3.fcg';
    var params = {
      format: 'json',
      platform: 'yqq',
      cid: '205361747',
      songmid: songmid,
      filename: 'C400' + songmid + '.m4a',
      guid: '10000'
    };
    
    var query = [];
    for (var key in params) {
      query.push(key + '=' + encodeURIComponent(params[key]));
    }
    
    return fetch(url + '?' + query.join('&'))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.data && data.data.items && data.data.items[0]) {
          var vkey = data.data.items[0].vkey;
          var filename = data.data.items[0].filename;
          return 'http://dl.stream.qqmusic.qq.com/' + filename + '?vkey=' + vkey + '&guid=10000&fromtag=66';
        }
        throw new Error('无法获取播放地址');
      });
  }

  // 获取歌词
  function getLyric(songmid) {
    var url = API_BASE + '/lyric/fcgi-bin/fcg_query_lyric_new.fcg';
    var params = {
      songmid: songmid,
      format: 'json',
      nobase64: 1
    };
    
    var query = [];
    for (var key in params) {
      query.push(key + '=' + encodeURIComponent(params[key]));
    }
    
    return fetch(url + '?' + query.join('&'))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.lyric) {
          return decodeURIComponent(data.lyric);
        }
        return '';
      })
      .catch(function() { return ''; });
  }

  // 搜索歌曲
  function searchSong(keyword) {
    var url = API_BASE + '/soso/fcgi-bin/client_search_cp';
    var params = {
      p: 1,
      n: 10,
      w: keyword,
      format: 'json'
    };
    
    var query = [];
    for (var key in params) {
      query.push(key + '=' + encodeURIComponent(params[key]));
    }
    
    return fetch(url + '?' + query.join('&'))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.data && data.data.song && data.data.song.list) {
          return data.data.song.list.map(function(song) {
            return {
              id: song.songmid,
              songmid: song.songmid,
              title: song.songname,
              artist: song.singer.map(function(s) { return s.name; }).join(' / '),
              album: song.albumname
            };
          });
        }
        return [];
      });
  }

  window.QQMusicAPI = {
    getSongUrl: getSongUrl,
    getLyric: getLyric,
    searchSong: searchSong
  };

  console.log('[QQMusicAPI] 已加载');
})();
