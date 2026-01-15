// 播放列表配置 - CDN托管方案（国内访问最稳定）
// 
// 推荐流程：
// 1. 从免费音乐库下载音乐（Pixabay/Incompetech）
// 2. 上传到国内CDN（七牛云/又拍云/阿里云OSS）
// 3. 配置到这里

window.PLAYLIST = [
  // 示例：使用国内可访问的免费音乐
  {
    id: "free-1",
    title: "轻音乐 1",
    artist: "免费音乐",
    // 使用 jsDelivr CDN（国内可访问）
    url: "https://cdn.jsdelivr.net/gh/goldfire/howler.js@2.2.3/examples/player/audio/80s_vibe.webm",
    lrc: "data:text/plain;charset=utf-8," + encodeURIComponent([
      "这是一首免费的背景音乐",
      "",
      "来自 Howler.js 示例",
      "国内可正常访问"
    ].join("\n")),
    cover: "/static/img/img1.png",
    type: "audio/webm"
  },

  // 如果你有自己的CDN：
  // 1. 注册七牛云/又拍云（有免费额度）
  // 2. 上传音乐文件
  // 3. 获取CDN链接
  // 4. 配置如下：
  /*
  {
    id: "my-song-1",
    title: "我的歌曲",
    artist: "艺术家",
    url: "https://你的CDN域名.com/music/song.mp3",
    lrc: "https://你的CDN域名.com/music/song.lrc",
    cover: "https://你的CDN域名.com/images/cover.jpg",
    type: "audio/mpeg"
  },
  */
];

// ========================================
// 国内CDN服务推荐（有免费额度）：
// ========================================
// 
// 1. 七牛云 (qiniu.com)
//    - 免费额度：10GB存储 + 10GB流量/月
//    - 国内访问快
//    - 配置简单
//
// 2. 又拍云 (upyun.com)
//    - 免费额度：10GB存储 + 15GB流量/月
//    - 需要在网站底部加logo
//
// 3. 阿里云OSS (aliyun.com)
//    - 按量付费，价格便宜
//    - 稳定可靠
//
// 4. 腾讯云COS (cloud.tencent.com)
//    - 有免费额度
//    - 国内访问快
//
// ========================================
// 免费音乐下载推荐：
// ========================================
//
// 1. Pixabay Music (pixabay.com/music/)
//    - 完全免费，可商用
//    - 无需署名
//    - 音质好
//
// 2. Incompetech (incompetech.com)
//    - Kevin MacLeod 的音乐
//    - 需要署名
//    - 种类丰富
//
// 3. Bensound (bensound.com)
//    - 免费音乐
//    - 需要署名
//
// 4. Free Music Archive (freemusicarchive.org)
//    - 大量免费音乐
//    - 不同授权协议
