# 音乐播放器国内访问方案指南

## 🎯 推荐方案：七牛云CDN + 免费音乐

这是最适合国内用户的方案，完全免费且稳定。

---

## 📋 步骤1：注册七牛云（5分钟）

1. 访问：https://www.qiniu.com/
2. 注册账号（实名认证）
3. 创建存储空间（Bucket）
   - 选择"标准存储"
   - 访问控制：公开
   - 区域：选择离你最近的

**免费额度：**
- 10GB 存储空间
- 10GB 下载流量/月
- 足够个人博客使用

---

## 📋 步骤2：下载免费音乐（10分钟）

### 推荐网站：

**1. Pixabay Music（最推荐）**
- 网址：https://pixabay.com/music/
- 优点：完全免费，可商用，无需署名
- 音质：高质量MP3
- 种类：各种风格都有

**2. Incompetech**
- 网址：https://incompetech.com/music/
- 优点：种类丰富
- 注意：需要在网站注明来源

**3. Bensound**
- 网址：https://www.bensound.com/
- 优点：音质好
- 注意：需要署名

### 下载步骤：
1. 在 Pixabay 搜索你喜欢的音乐类型
2. 点击下载按钮
3. 保存到本地

---

## 📋 步骤3：上传到七牛云（5分钟）

1. 登录七牛云控制台
2. 进入你创建的存储空间
3. 点击"上传文件"
4. 上传你下载的音乐文件
5. 复制文件的外链地址

**外链格式：**
```
http://你的域名.bkt.clouddn.com/music/song.mp3
```

---

## 📋 步骤4：配置播放列表（2分钟）

编辑 `static/js/player.config.js`：

```javascript
window.PLAYLIST = [
  {
    id: "song-1",
    title: "歌曲名称",
    artist: "艺术家",
    url: "http://你的七牛云外链/song.mp3",
    lrc: "data:text/plain;charset=utf-8," + encodeURIComponent([
      "这是歌词第一行",
      "这是歌词第二行"
    ].join("\n")),
    cover: "/static/img/img1.png",
    type: "audio/mpeg"
  },
  // 添加更多歌曲...
];
```

---

## 🎵 歌词制作（可选）

### 方法1：纯文本歌词
```javascript
lrc: "data:text/plain;charset=utf-8," + encodeURIComponent([
  "歌词第一行",
  "歌词第二行",
  "歌词第三行"
].join("\n"))
```

### 方法2：带时间轴的LRC歌词
1. 在线制作：https://lrc-maker.github.io/
2. 或者手动编写：
```
[00:12.00]第一句歌词
[00:17.20]第二句歌词
[00:21.10]第三句歌词
```
3. 保存为 `.lrc` 文件，上传到七牛云
4. 配置：
```javascript
lrc: "http://你的七牛云外链/song.lrc"
```

---

## 🚀 其他方案对比

### 方案A：自己部署网易云API
**优点：**
- 歌曲丰富
- 歌词完整

**缺点：**
- 需要服务器
- 可能被限流
- VIP歌曲无法播放

**适合：** 有服务器的开发者

---

### 方案B：QQ音乐API
**优点：**
- 国内访问快
- 歌曲丰富

**缺点：**
- API不稳定
- 可能随时失效
- 版权限制

**适合：** 临时测试

---

### 方案C：CDN托管（推荐）
**优点：**
- 完全可控
- 稳定可靠
- 国内访问快
- 无版权问题

**缺点：**
- 需要自己找音乐
- 需要上传

**适合：** 所有人（最推荐）

---

## 💡 常见问题

**Q: 七牛云免费额度够用吗？**
A: 对于个人博客完全够用。假设每首歌5MB，10GB流量可以播放2000次。

**Q: 如何找到好听的免费音乐？**
A: Pixabay Music 有大量高质量音乐，按类型筛选即可。

**Q: 可以用网易云/QQ音乐的歌吗？**
A: 不建议，有版权风险。建议使用免费音乐。

**Q: 如何制作歌词？**
A: 使用在线LRC编辑器，或者纯文本也可以。

**Q: 能不能直接用网易云的链接？**
A: 不行，网易云的链接有时效性，会过期。

---

## 📞 需要帮助？

如果遇到问题，可以：
1. 查看七牛云文档
2. 在博客留言
3. 加入交流群：1050444336

---

## ✅ 快速开始（懒人版）

如果你只是想快速测试，可以先用这个配置：

```javascript
window.PLAYLIST = [
  {
    id: "demo-1",
    title: "示例音乐",
    artist: "免费音乐",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    lrc: "data:text/plain;charset=utf-8,这是示例音乐",
    cover: "/static/img/img1.png",
    type: "audio/mpeg"
  }
];
```

这个链接是公共的免费音乐，可以直接使用。

---

**祝你配置顺利！🎉**
