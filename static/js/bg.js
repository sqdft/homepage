(function(){
  // 固定的腾讯 g.gtimg.cn 远程背景池（用户提供）
  var remoteImages = [
    "https://g.gtimg.cn/music/photo_new/T053XD010017SNjl46uSEf.jpg",
    "https://g.gtimg.cn/music/photo_new/T053XD01000ID6X30dg8kF.png",
    "https://g.gtimg.cn/music/photo_new/T053XD01004ZhNnT19PB1K.png",
    "https://g.gtimg.cn/music/photo_new/T053XD010017eQvt3m0xkv.png",
    "https://g.gtimg.cn/music/photo_new/T053XD010029Kc8r2weatK.png",
    "https://g.gtimg.cn/music/photo_new/T053XD01001uXcoJ0NzyaL.jpg",
    "https://g.gtimg.cn/music/photo_new/T053XD01001mjxrm0RDgnP.jpg"
  ];

  // 移动端轻量图池（用户指定 6 张）
  var mobileImages = [
    "https://g.gtimg.cn/music/photo_new/T053XD01001Hrl7t0fYtX6.png",
    "https://g.gtimg.cn/music/photo_new/T053XD01004JnGjq1VgAVP.jpg",
    "https://g.gtimg.cn/music/photo_new/T053XD01004JrjqK3cxlTc.jpg",
    "https://g.gtimg.cn/music/photo_new/T053XD01002HVkNZ471x2B.png",
    "https://g.gtimg.cn/music/photo_new/T053XD01004AiDQk46zBKz.png",
    "https://g.gtimg.cn/music/photo_new/T053XD01001W5aHq4aIJpO.png"
  ];

  // 本地背景占位；会在读取 /static/img/bg-manifest.json 后自动覆盖
  var localImages = [
    "/static/img/img10.webp",
    "/static/img/img2.png",
    "/static/img/img3.png"
  ];

  function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function isMobileEnv(){
    try {
      return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth < 768);
    } catch(e) {
      return (typeof window !== 'undefined' && window.innerWidth < 768);
    }
  }

  function applyBackground(src){
    var body = document.body;
    if(!body) return;
    body.style.backgroundImage = 'url("'+src+'")';
    var mobile = isMobileEnv();
    if (mobile) {
      // 移动端：随滚动移动，纵向平铺，页面再长也铺满
      body.style.backgroundAttachment = 'scroll';
      body.style.backgroundRepeat = 'repeat-y';
      body.style.backgroundPosition = 'top center';
      body.style.backgroundSize = '100% auto';
    } else {
      // 桌面端：保留原有沉浸式效果
      body.style.backgroundAttachment = 'fixed';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundPosition = 'center center';
      body.style.backgroundSize = 'cover';
    }
  }

  function chooseAndSet(){
    // 桌面端使用 remoteImages；移动端使用轻量的 mobileImages
    var candidate = pick(isMobileEnv() ? mobileImages : remoteImages);
    var img = new Image();
    img.onload = function(){ applyBackground(candidate); };
    img.onerror = function(){
      try {
        var local = pick(localImages);
        applyBackground(local);
      } catch(e){ /* 忽略 */ }
    };
    img.src = candidate;
    // 设置一个优雅的纯色/渐变兜底，避免白屏闪烁
    if(!document.body.style.backgroundColor){
      document.body.style.backgroundColor = '#0f172a';
    }
  }

  function init(){
    // 移动端直接使用轻量图，不再请求本地清单，减少一次网络请求
    if (isMobileEnv()) {
      chooseAndSet();
      return;
    }
    // 桌面端：尝试加载本地图片清单（由重命名脚本生成）
    try {
      fetch('/static/img/bg-manifest.json', { cache: 'no-cache' })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(data){
          if(data && Array.isArray(data.images)){
            localImages = data.images.map(function(n){ return '/static/img/' + n; });
          }
        })
        .catch(function(){ /* 忽略 */ })
        .finally(chooseAndSet);
    } catch(e){
      chooseAndSet();
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
