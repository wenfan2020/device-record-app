-- =====================================================
-- CZ12标设备管理 - Supabase 数据库初始化脚本
-- =====================================================
-- 川藏铁路雅安至林芝段 CZSCZQ-12标
-- 设备管理系统
-- =====================================================

-- 启用 UUID 扩展
create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. profiles 表（用户信息）
-- =====================================================
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    name text,
    email text,
    is_main_admin boolean default false,  -- 主管理员标志
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 自动创建 profile（用户注册时触发）
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, name, email)
    values (
        new.id,
        new.raw_user_meta_data->>'name',
        new.email
    );
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- =====================================================
-- 2. worksites 表（工点）- 增加 org 字段
-- =====================================================
create table if not exists public.worksites (
    id uuid default uuid_generate_v4() primary key,
    org text not null check (org in ('局指', '一分部', '二分部')),  -- 所属单位
    name text not null,
    created_by uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 策略
alter table public.worksites enable row level security;

-- 所有登录用户可查看所有工点（但只有被授权才能编辑）
create policy "登录用户可查看工点" on public.worksites
    for select using (auth.uid() is not null);

create policy "创建者可更新工点" on public.worksites
    for update using (auth.uid() = created_by);

create policy "创建者可删除工点" on public.worksites
    for delete using (auth.uid() = created_by);

create policy "登录用户可创建工点" on public.worksites
    for insert with check (auth.uid() = created_by);

-- =====================================================
-- 3. worksite_members 表（工点成员权限）
-- =====================================================
create table if not exists public.worksite_members (
    id uuid default uuid_generate_v4() primary key,
    worksite_id uuid references public.worksites(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    role text check (role in ('editor', 'viewer')) not null default 'viewer',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(worksite_id, user_id)
);

alter table public.worksite_members enable row level security;

-- 创建者和主管理员可管理成员
create policy "创建者和主管理员可查看成员" on public.worksite_members
    for select using (
        exists (
            select 1 from public.worksites 
            where id = worksite_id and created_by = auth.uid()
        ) or
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and is_main_admin = true
        )
    );

create policy "创建者和主管理员可添加成员" on public.worksite_members
    for insert with check (
        exists (
            select 1 from public.worksites 
            where id = worksite_id and created_by = auth.uid()
        ) or
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and is_main_admin = true
        )
    );

create policy "创建者和主管理员可删除成员" on public.worksite_members
    for delete using (
        exists (
            select 1 from public.worksites 
            where id = worksite_id and created_by = auth.uid()
        ) or
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and is_main_admin = true
        )
    );

-- 成员可查看自己所在工点的成员
create policy "成员可查看工点成员" on public.worksite_members
    for select using (
        user_id = auth.uid() or
        exists (
            select 1 from public.worksites 
            where id = worksite_id and created_by = auth.uid()
        )
    );

-- =====================================================
-- 4. devices 表（设备）
-- =====================================================
create table if not exists public.devices (
    id uuid default uuid_generate_v4() primary key,
    worksite_id uuid references public.worksites(id) on delete cascade not null,
    name text not null,
    device_type text not null check (device_type in ('大中型设备', '特种设备')),  -- 设备类别
    status text not null default '正常' check (status in ('正常', '维修中', '报废')),
    description text,
    created_by uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.devices enable row level security;

-- 所有人可查看设备（只读）
create policy "所有人可查看设备" on public.devices
    for select using (auth.uid() is not null);

-- 创建者、主管理员、编辑者可增删改设备
create policy "创建者主管理员编辑者可管理设备" on public.devices
    for all using (
        created_by = auth.uid() or
        exists (
            select 1 from public.worksites 
            where id = worksite_id and created_by = auth.uid()
        ) or
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and is_main_admin = true
        ) or
        exists (
            select 1 from public.worksite_members 
            where worksite_id = devices.worksite_id 
            and user_id = auth.uid() 
            and role = 'editor'
        )
    );

-- =====================================================
-- 5. photos 表（照片）
-- =====================================================
create table if not exists public.photos (
    id uuid default uuid_generate_v4() primary key,
    device_id uuid references public.devices(id) on delete cascade not null,
    url text not null,
    caption text,
    created_by uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.photos enable row level security;

-- 所有人可查看照片
create policy "所有人可查看照片" on public.photos
    for select using (auth.uid() is not null);

-- 创建者、主管理员、编辑者可上传删除照片
create policy "创建者主管理员编辑者可管理照片" on public.photos
    for insert with check (
        created_by = auth.uid() or
        exists (
            select 1 from public.devices d
            join public.worksites w on d.worksite_id = w.id
            where d.id = device_id and w.created_by = auth.uid()
        ) or
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and is_main_admin = true
        ) or
        exists (
            select 1 from public.devices d
            join public.worksite_members m on d.worksite_id = m.worksite_id
            where d.id = device_id 
            and m.user_id = auth.uid() 
            and m.role = 'editor'
        )
    );

create policy "创建者主管理员编辑者可删除照片" on public.photos
    for delete using (
        created_by = auth.uid() or
        exists (
            select 1 from public.devices d
            join public.worksites w on d.worksite_id = w.id
            where d.id = device_id and w.created_by = auth.uid()
        ) or
        exists (
            select 1 from public.profiles 
            where id = auth.uid() and is_main_admin = true
        ) or
        exists (
            select 1 from public.devices d
            join public.worksite_members m on d.worksite_id = m.worksite_id
            where d.id = device_id 
            and m.user_id = auth.uid() 
            and m.role = 'editor'
        )
    );

-- =====================================================
-- 6. 存储 Bucket（照片存储）
-- =====================================================
insert into storage.buckets (id, name, public)
values ('device-photos', 'device-photos', true)
on conflict (id) do nothing;

-- 存储策略
create policy "登录用户可上传照片" on storage.objects
    for insert with check (
        bucket_id = 'device-photos' and auth.uid() is not null
    );

create policy "所有人可查看照片" on storage.objects
    for select using (bucket_id = 'device-photos');

create policy "创建者和主管理员可删除照片" on storage.objects
    for delete using (
        bucket_id = 'device-photos' and auth.uid() is not null
    );

-- =====================================================
-- 7. 设置主管理员（可选）
-- =====================================================
-- 执行以下SQL将指定邮箱的用户设为主管理员
-- 将 'your-email@example.com' 替换为你的邮箱
/*
update public.profiles 
set is_main_admin = true 
where email = 'your-email@example.com';
*/

-- =====================================================
-- 完成！
-- =====================================================
