# 设备记录 App - 项目说明

## 功能概述
- 工点列表管理
- 每个工点下可添加/编辑/删除设备
- 设备详情可拍照上传照片
- 多用户协作，按工点分配权限

## 技术方案
- 前端：HTML5 + CSS3 + Vanilla JS (PWA)
- 后端：Supabase (免费云数据库)
- 文件存储：Supabase Storage

## 文件结构
```
device-record-app/
├── index.html          # 主页面
├── worksite.html       # 工点详情页
├── device.html         # 设备详情页
├── add-device.html      # 添加/编辑设备
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 主逻辑
│   ├── supabase.js     # Supabase 初始化
│   └── auth.js         # 登录认证
├── assets/
│   └── icons/          # PWA 图标
├── manifest.json       # PWA 配置
└── sw.js               # Service Worker
```

## 下一步
1. ✅ 项目结构创建
2. ⬜ HTML 页面编写
3. ⬜ CSS 样式设计
4. ⬜ Supabase 初始化配置
5. ⬜ 登录/注册功能
6. ⬜ 工点 CRUD
7. ⬜ 设备 CRUD
8. ⬜ 照片上传
9. ⬜ 权限管理
10. ⬜ PWA 安装配置
