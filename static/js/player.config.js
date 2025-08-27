// 播放列表配置：你可以在此追加/编辑歌曲
// 字段：id, title, artist, url, cover(可选), type(可选), lrc(可选)
// 注意：若文件名包含空格或中文，播放器内部会自动进行 URL 编码

window.PLAYLIST = [
  {
    id: "local-001",
    title: "烈焰中的自由之舞",
    artist: "本地",
    url: "/music/烈焰中的自由之舞 .mp3",
    lrc: "/lyrics/烈焰中的自由之舞 .lrc",
    cover: "", // 可填封面图 URL
    type: "audio/mpeg"
  },
  {
    id: "local-002",
    title: "寒夜神祇",
    artist: "本地",
    url: "/music/寒夜神祇 .mp3",
    lrc: "/lyrics/寒夜神祇 .lrc",
    cover: "",
    type: "audio/mpeg"
  }
];
