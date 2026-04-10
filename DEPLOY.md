# CZ12标设备管理 - 部署指南

## 📱 功能概述

- ✅ **工点管理**：局指、一分部、二分部 三个单位分别管理
- ✅ **设备分类**：大中型设备、特种设备
- ✅ **状态管理**：正常/维修中/报废
- ✅ **拍照上传**：设备照片云端存储
- ✅ **权限控制**：
  - 主管理员（你）：可添加/编辑/删除所有工点和设备，管理成员
  - 被授权的编辑：可编辑所属工点的设备
  - 只读用户：只能查看，不能修改
- ✅ **设备上限**：局指100台，一二分部各300台
- ✅ **筛选功能**：按单位、类别、状态筛选，关键词搜索
- ✅ **PWA安装**：可安装到手机桌面

---

## 🚀 部署步骤

### 第一步：注册 Supabase 账号

1. 打开 https://supabase.com
2. 用 GitHub 或邮箱注册
3. 点击 **New Project** 创建新项目
4. 取名比如"CZ12标设备管理"

> ⚠️ 记住你设置的数据库密码！

等待项目创建完成（约2分钟）。

---

### 第二步：运行数据库初始化 SQL

1. 在 Supabase 面板左侧点击 **SQL Editor**
2. 点击 **New Query**
3. 复制 `supabase-schema.sql` 的全部内容，粘贴进去
4. 点击 **Run** 执行

> ✅ 看到 "Success" 就是成功了

---

### 第三步：获取 API 密钥

1. 进入 **Project Settings**（左侧齿轮图标）
2. 点击 **API**
3. 复制：
   - `Project URL`：类似 `https://xxxxx.supabase.co`
   - `anon public key`：一大串以 `eyJ` 开头的字符串

4. 打开 `js/supabase-config.js`，替换：
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';  // 替换这里
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';  // 替换这里
```

---

### 第四步：创建 Storage Bucket

1. 左侧找到 **Storage**
2. 点击 **New bucket**
3. 名称填：`device-photos`
4. 勾选 **Public bucket**
5. 点击 **Create bucket**

---

### 第五步：部署到 GitHub Pages

1. GitHub 创建新仓库，比如 `cz12-equipment`
2. 上传 `device-record-app` 文件夹里的所有文件到仓库
3. 进入仓库 **Settings** → **Pages**
4. Source 选择 `main` 分支，`/ (root)`
5. 点击 **Save**
6. 等 1-2 分钟，访问：`https://你的用户名.github.io/cz12-equipment`

---

### 第六步：安装到手机

用手机浏览器打开上面的网址：
1. 点右上角 **⋮** 菜单
2. 选择 **"添加到主屏幕"**

---

## 👤 设置主管理员

首次部署后，你需要把自己设为主管理员：

1. 用你的邮箱注册并登录 App
2. 在 Supabase SQL Editor 执行：
```sql
update public.profiles 
set is_main_admin = true 
where email = '你的邮箱@xxx.com';
```

---

## 📋 使用说明

### 权限结构

| 角色 | 能做什么 |
|------|----------|
| 主管理员（你） | 添加工点、添加/编辑/删除设备、管理成员 |
| 编辑 | 添加/编辑设备及照片（不能删工点） |
| 只读 | 查看所有信息，不能修改 |

### 添加成员

1. 进入某个工点
2. 点右上角 👥
3. 输入对方邮箱，选择权限（可编辑/只读）
4. 点添加

> ⚠️ 对方必须先注册并登录过 App

### 设备分类

- **大中型设备**：一般大型设备
- **特种设备**：特种作业设备

### 筛选功能

在工点列表页面：
- 按单位筛选（局指/一分部/二分部）
- 按设备类别筛选
- 输入关键词搜索设备名称

在设备列表页面：
- 按类别筛选
- 按状态筛选
- 搜索设备名称

---

## 📁 文件说明

```
device-record-app/
├── index.html           # 首页（工点列表）
├── worksite.html        # 工点详情（设备列表）
├── device.html          # 设备详情（照片管理）
├── css/style.css        # 样式
├── js/
│   ├── supabase-config.js   # ⚠️ 填 Supabase 信息
│   ├── auth.js              # 登录认证
│   ├── app.js               # 工点管理
│   ├── worksite.js          # 设备管理
│   └── device.js            # 照片管理
├── manifest.json        # PWA 配置
├── sw.js                # 离线缓存
└── supabase-schema.sql  # 数据库结构
```

---

## 🔧 常见问题

**Q: 照片上传失败？**
A: 检查 Storage 是否创建了 `device-photos` bucket，并确认是 Public。

**Q: 怎么把自己设为主管理员？**
A: 执行 SQL：`update public.profiles set is_main_admin = true where email = '你的邮箱';`

**Q: 怎么添加分部的人？**
A: 进入工点 → 👥 → 输入对方邮箱 → 选择权限 → 添加

**Q: 设备上限到了怎么办？**
A: 联系主管理员删除不需要的设备

---

有问题随时问！
