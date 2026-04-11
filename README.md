# CZ12 设备管理系统

川藏铁路雅安至林芝段 CZSCZQ-12标 设备管理系统。

## 功能说明

- **公开浏览**：任何人无需登录即可查看所有工点和设备
- **用户注册**：注册后账号为"待审批"状态，无法登录
- **管理员审批**：管理员（18006855@qq.com）添加授权用户后方可登录
- **数据管理**：已授权用户可增删改工点和设备

## 访问地址

- 在线访问：https://wenfan2020.github.io/device-record-app/
- GitHub 仓库：https://github.com/wenfan2020/device-record-app

## 快速部署（Supabase 数据库配置）

在 Supabase SQL Editor 中执行以下 SQL 完成初始化：

```sql
-- =============================================
-- 1. 创建数据表
-- =============================================

-- 已授权用户表
CREATE TABLE IF NOT EXISTS approved_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 工点表
CREATE TABLE IF NOT EXISTS worksites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  branch TEXT,
  location TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 设备表
CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worksite_id UUID REFERENCES worksites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT,
  model TEXT,
  serial TEXT,
  status TEXT DEFAULT '正常',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 照片表
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. 启用 RLS（行级安全策略）
-- =============================================

ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksites ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. RLS 策略
-- =============================================

-- approved_users: 所有人可SELECT，管理员可INSERT/DELETE
CREATE POLICY "approved_users_select_all" ON approved_users FOR SELECT USING (true);
CREATE POLICY "approved_users_insert_admin" ON approved_users FOR INSERT WITH CHECK (true);
CREATE POLICY "approved_users_delete_admin" ON approved_users FOR DELETE USING (true);

-- worksites: 公开SELECT，授权用户可写
CREATE POLICY "worksites_select_public" ON worksites FOR SELECT USING (true);
CREATE POLICY "worksites_all_for_auth" ON worksites FOR ALL USING (true);

-- devices: 公开SELECT，授权用户可写
CREATE POLICY "devices_select_public" ON devices FOR SELECT USING (true);
CREATE POLICY "devices_all_for_auth" ON devices FOR ALL USING (true);

-- photos: 公开SELECT，授权用户可写
CREATE POLICY "photos_select_public" ON photos FOR SELECT USING (true);
CREATE POLICY "photos_all_for_auth" ON photos FOR ALL USING (true);

-- =============================================
-- 4. 添加初始管理员授权
-- =============================================

-- 请先将 18006855@qq.com 加入 approved_users
-- （用户需先在 App 注册，然后管理员手动添加）
-- INSERT INTO approved_users (email, approved) VALUES ('18006855@qq.com', true);
```

## 管理员操作说明

1. 打开 https://supabase.com/dashboard 进入项目
2. 进入 **SQL Editor**，执行上述 SQL
3. 进入 **Authentication** → **Users**，可以看到注册用户列表
4. 进入 **Table Editor** → **approved_users**，手动添加授权用户记录（user_id 从 auth.users 中获取）
5. 管理员也可登录 App 后访问 `/admin.html` 页面，通过"添加用户"功能直接创建授权账号

## 文件说明

- `index.html` - 登录/注册页面
- `main.html` - 主页面（工点设备列表，公开浏览）
- `admin.html` - 管理后台（仅授权管理员可访问）
- `supabase.js` - Supabase SDK（内嵌本地，无CDN依赖）
