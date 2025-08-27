// 播放列表配置（公共可访问 + 无跨域）：使用 iTunes 预览音频 + data:text 歌词
// 说明：
// - 音频：SoundHelix 公共示例，支持跨域与 Range 请求，便于拖拽快进
// - 歌词：使用 data:text/plain，避免 CORS；纯文本仅静态展示，不做时间同步
// - 封面：留空将回退到本地占位图 `/static/img/img1.png`

// 已切换到 Apple iTunes Search API 预览音频（m4a，约 30s，支持 CORS/Range），用于开发验证。
// 注意：如需完整曲目或自有音源，请将 url 替换为你的 OSS/COS/R2/S3/CDN 直链并开启 CORS 与 Range。
// 歌词同步高亮需提供带时间戳的 LRC；纯文本歌词将静态展示。

window.PLAYLIST = [
  // 1) 前前前世 (movie ver.) - RADWIMPS
  {
    id: "itunes-zenzen-movie",
    title: "前前前世 (movie ver.)",
    artist: "RADWIMPS",
    // 国内优先源（可填多个，按顺序回退）：请填入你在中国内地访问更快的直链（需支持 CORS 与 Range）
    // 例如：阿里云 OSS / 腾讯云 COS / 又拍云 / 七牛云 等 CDN 加速链接
    srcs: [
      // 留空表示直接使用下方 Apple 预览 url；如需更稳可填你的代理/CDN 源
    ],
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a3/86/31/a386316f-6023-bf80-791f-47c4011f7651/mzaf_3573618355588999306.plus.aac.p.m4a",
    lrc: "data:text/plain;charset=utf-8," + encodeURIComponent([
      "前前前世 (movie ver.) - 预览音频",
      "",
      "此为 Apple 提供的 30s 预览，仅用于播放测试。",
      "纯文本歌词为静态展示；如需同步高亮请提供带时间戳 LRC。"
    ].join("\n")),
    cover: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d6/82/de/d682dec8-26a9-d324-cc44-a4e19cb83abc/16UMGIM58126.rgb.jpg/100x100bb.jpg",
    type: "audio/mp4"
  },
  // 2) トリカゴ - XX:me
  {
    id: "itunes-torikago",
    title: "トリカゴ",
    artist: "XX:me",
    // 国内优先源（可填多个，按顺序回退）
    srcs: [
      // 留空表示直接使用下方 Apple 预览 url；如需更稳可填你的代理/CDN 源
    ],
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview114/v4/20/c9/50/20c95022-7545-e4b2-e70d-e9789755636d/mzaf_16914136652523656323.plus.aac.p.m4a",
    lrc: "data:text/plain;charset=utf-8," + encodeURIComponent([
      "トリカゴ - 预览音频",
      "",
      "此为 Apple 提供的 30s 预览，仅用于播放测试。",
      "纯文本歌词为静态展示；如需同步高亮请提供带时间戳 LRC。"
    ].join("\n")),
    cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6b/d9/c3/6bd9c3c0-451e-108f-ab74-2ff0aa74352a/jacket_SVWC70341B00Z_550.jpg/100x100bb.jpg",
    type: "audio/mp4"
  },
  // 3) 光るなら - Goose house
  {
    id: "itunes-hikarunara",
    title: "光るなら",
    artist: "Goose house",
    // 国内优先源（可填多个，按顺序回退）
    srcs: [
      // 留空表示直接使用下方 Apple 预览 url；如需更稳可填你的代理/CDN 源
    ],
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/d7/7b/a6/d77ba6d2-e38b-a553-b39d-45d5a53f3250/mzaf_1842760548302899976.plus.aac.p.m4a",
    lrc: "data:text/plain;charset=utf-8," + encodeURIComponent([
      "光るなら - 预览音频",
      "",
      "此为 Apple 提供的 30s 预览，仅用于播放测试。",
      "纯文本歌词为静态展示；如需同步高亮请提供带时间戳 LRC。"
    ].join("\n")),
    cover: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c2/2c/b1/c22cb13e-9724-c1ae-c36e-2e313e077321/jacket_SRCL08640B00Z_550.jpg/100x100bb.jpg",
    type: "audio/mp4"
  }
];

