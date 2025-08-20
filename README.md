## 个人主页

好看的个人主页，个人主页源码，博客主页模板.**🉑️随意使用，无限制。**

在线地址：https://xiaoyang.zone.id

## 集成插件

- [x] [jQuery](https://jquery.com/)
- [x] [Fancybox 图片灯箱](https://github.com/fancyapps/fancyBox)
- [x] [instant.page 预加载](https://instant.page/)
- [x] [lazysizes 图片懒加载](https://github.com/aFarkas/lazysizes)
- [x] [APlayer 音乐播放插件](https://github.com/MoePlayer/APlayer)
- [x] [MetingJS](https://github.com/metowolf/MetingJS)
- [x] [不蒜子计数](http://busuanzi.ibruce.info/)

## 集成API

- [x] [一言](https://hitokoto.cn/)
- [x] [今日诗词](https://www.jinrishici.com/)
- [x] [随机图片](https://api.ixiaowai.cn/api/api.php) 

## 好玩的

- [x] 雪花
- [x] 搞怪标题栏
- [x] 随机背景（移动端轻量池，桌面固定背景）

## 本地预览

- 依赖：Python 3
- 启动：`python -m http.server 8083`
- 访问：`http://127.0.0.1:8083`

## 目录结构

- `index.html`：首页（最新文章列表、留言板）
- `blogs/`：文章目录（每篇独立 HTML）
- `static/css/index.css`：站点样式（含玻璃拟态变量）
- `static/js/bg.js`：随机背景（移动端/桌面区分策略）
- `static/js/comments.js`：留言板前端逻辑

## 新增文章

1) 在 `blogs/` 新建 `your-post.html`，页面头部引入 `/static/css/index.css` 与 `/static/js/bg.js`，主体使用容器 `div.article-container`。
2) 在 `blogs/index.html` 顶部添加一张文章卡片（标题、日期、摘要、链接）。
3) 在首页 `index.html` 的“最新文章”列表添加一条 `li.blog-item`，并填入日期（首页脚本会按日期倒序显示）。

## 设计与性能优化

- 玻璃拟态：`static/css/index.css` 的 `:root` 提供透明度变量，可在页面内通过 `<style>:root { --glass-alpha-... }</style>` 覆盖。
- 背景策略：移动端使用轻量背景池并禁用 `fixed`，桌面保持 `fixed` 提升质感（来源 `g.gtimg.cn`）。
- 第三方脚本：优先使用国内可访问 CDN（`cdn.staticfile.org` / `g.gtimg.cn`）减少阻塞；启用 `instant.page`、`lazysizes` 提升交互速度。

## 留言板（Comments）

- 前端：见 `static/js/comments.js`，已集成到首页 `#comments-root`。
- 后端：Python/FastAPI（Render 部署），支持 CORS（127.0.0.1:8083 / localhost:8083），接口文档 `/docs`。
- 管理：管理员删除走服务端 Bearer Token 校验，前端面板已隐蔽处理。

## 许可证

- **🉑️随意使用，无限制。**
