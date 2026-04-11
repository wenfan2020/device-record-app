/**
 * Service Worker - 离线缓存
 */

const CACHE_NAME = 'device-record-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/worksite.html',
  '/device.html',
  '/css/style.css',
  '/js/supabase-config.js',
  '/js/auth.js',
  '/js/app.js',
  '/js/worksite.js',
  '/js/device.js',
  'https://cdn.bootcdn.net/ajax/libs/supabase-js/2.39.0/supabase-umd.min.js'
];

// 安装
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存已打开');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  // 跳过跨域请求
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('supabase.io') &&
      !event.request.url.includes('jsdelivr.net') && !event.request.url.includes('bootcdn.net')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 缓存命中则返回缓存，否则请求网络
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // 检查是否是有效响应
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // 缓存新资源
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
  );
});
