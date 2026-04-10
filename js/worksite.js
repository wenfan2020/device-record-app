/**
 * 工点详情页逻辑 - 设备管理
 */

let worksiteId = null;
let worksiteData = null;
let currentUserRole = 'viewer'; // owner/admin/editor/viewer
let isMainAdmin = false;
let editingDeviceId = null;
let pendingDeleteCallback = null;

// 筛选状态
let filterType = '';
let filterStatus = '';
let filterSearch = '';

// 所有设备数据（缓存）
let allDevices = [];

// 状态对应的emoji
const statusEmoji = {
    '正常': '🟢',
    '维修中': '🟠',
    '报废': '🔴'
};

// 状态对应的CSS class
const statusClass = {
    '正常': 'normal',
    '维修中': 'repair',
    '报废': 'scrap'
};

// 设备类别对应的CSS class
const typeClass = {
    '大中型设备': 'large',
    '特种设备': 'special'
};

/**
 * 获取 URL 参数
 */
function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

/**
 * 显示提示
 */
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

/**
 * 加载工点信息
 */
async function loadWorksiteInfo() {
    try {
        const { data: worksite, error } = await supabase
            .from('worksites')
            .select('*')
            .eq('id', worksiteId)
            .single();

        if (error) throw error;
        worksiteData = worksite;

        document.getElementById('page-title').textContent = worksite.name;
        document.title = worksite.name + ' - CZ12标设备管理';

        // 检查用户权限
        await checkUserRole();

    } catch (error) {
        console.error('加载工点失败:', error);
        showToast('加载失败');
    }
}

/**
 * 检查用户在当前工点的角色
 */
async function checkUserRole() {
    // 检查是否为总管理员
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_main_admin')
        .eq('id', currentUser.id)
        .single();
    
    isMainAdmin = profile?.is_main_admin === true;
    
    if (isMainAdmin) {
        currentUserRole = 'admin';
        return;
    }

    // 如果是工点创建者
    if (worksiteData.created_by === currentUser.id) {
        currentUserRole = 'owner';
        return;
    }

    // 查询成员表
    const { data: member } = await supabase
        .from('worksite_members')
        .select('role')
        .eq('worksite_id', worksiteId)
        .eq('user_id', currentUser.id)
        .single();

    currentUserRole = member?.role || 'viewer';

    // 根据权限控制界面
    if (currentUserRole === 'viewer') {
        document.getElementById('btn-add-device').style.display = 'none';
    }
}

/**
 * 加载设备列表
 */
async function loadDevices() {
    const listContainer = document.getElementById('device-list');
    listContainer.innerHTML = '<div class="loading">加载中...</div>';

    try {
        const { data: devices, error } = await supabase
            .from('devices')
            .select(`
                *,
                photos(count)
            `)
            .eq('worksite_id', worksiteId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 缓存所有设备
        allDevices = devices || [];

        // 应用筛选
        let filtered = allDevices;
        
        if (filterType) {
            filtered = filtered.filter(d => d.device_type === filterType);
        }
        
        if (filterStatus) {
            filtered = filtered.filter(d => d.status === filterStatus);
        }
        
        if (filterSearch) {
            const search = filterSearch.toLowerCase();
            filtered = filtered.filter(d => 
                d.name.toLowerCase().includes(search) ||
                (d.description && d.description.toLowerCase().includes(search))
            );
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔧</div>
                    <p>${allDevices.length === 0 ? '还没有设备' : '筛选结果为空'}</p>
                    ${allDevices.length === 0 && currentUserRole !== 'viewer' ? '<p>点击下方 + 按钮添加第一台设备</p>' : ''}
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(device => {
            const photoCount = device.photos?.[0]?.count || 0;
            const canEdit = currentUserRole !== 'viewer';
            
            return `
                <div class="card device-card" onclick="goToDevice('${device.id}')">
                    <div class="card-header">
                        <div class="card-title">
                            <span class="device-status ${statusClass[device.status]}"></span>
                            ${escapeHtml(device.name)}
                            <span class="type-badge ${typeClass[device.device_type]}">${device.device_type}</span>
                        </div>
                        <div class="card-actions" onclick="event.stopPropagation()">
                            ${canEdit ? `
                                <button onclick="editDevice('${device.id}')" title="编辑">✏️</button>
                                <button onclick="confirmDeleteDevice('${device.id}', '${escapeHtml(device.name)}')" title="删除">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-meta">${statusEmoji[device.status]} ${device.status}</div>
                    ${device.description ? `<div style="font-size: 13px; color: #666; margin-top: 4px;">${escapeHtml(device.description.substring(0, 50))}${device.description.length > 50 ? '...' : ''}</div>` : ''}
                    <div class="card-stats">
                        <span>📷 ${photoCount} 张照片</span>
                        <span>📅 ${formatDate(device.created_at)}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('加载设备失败:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="icon">❌</div>
                <p>加载失败</p>
            </div>
        `;
    }
}

/**
 * 跳转到设备详情页
 */
function goToDevice(deviceId) {
    window.location.href = `device.html?id=${deviceId}&worksite=${worksiteId}`;
}

/**
 * 检查设备上限
 */
async function checkDeviceLimit() {
    const { data: devices } = await supabase
        .from('devices')
        .select('id')
        .eq('worksite_id', worksiteId);
    
    const count = devices?.length || 0;
    const limit = 300; // 工点级别上限
    
    return { count, limit, canAdd: count < limit };
}

/**
 * 打开添加设备弹窗
 */
async function openAddDeviceModal() {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限添加设备');
        return;
    }
    
    const { count, limit, canAdd } = await checkDeviceLimit();
    
    if (!canAdd) {
        showToast(`工点设备已达上限 ${limit} 台`);
        return;
    }
    
    editingDeviceId = null;
    document.getElementById('device-modal-title').textContent = '添加设备';
    document.getElementById('device-id').value = '';
    document.getElementById('device-name').value = '';
    document.getElementById('device-type').value = '大中型设备';
    document.getElementById('device-status').value = '正常';
    document.getElementById('device-description').value = '';
    document.getElementById('device-limit-info').innerHTML = `当前 ${count}/${limit} 台`;
    document.getElementById('device-modal').classList.remove('hidden');
}

/**
 * 编辑设备
 */
async function editDevice(deviceId) {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限编辑设备');
        return;
    }
    
    try {
        const { data: device, error } = await supabase
            .from('devices')
            .select('*')
            .eq('id', deviceId)
            .single();

        if (error) throw error;

        editingDeviceId = deviceId;
        document.getElementById('device-modal-title').textContent = '编辑设备';
        document.getElementById('device-id').value = deviceId;
        document.getElementById('device-name').value = device.name;
        document.getElementById('device-type').value = device.device_type;
        document.getElementById('device-status').value = device.status;
        document.getElementById('device-description').value = device.description || '';
        
        const { count, limit } = await checkDeviceLimit();
        document.getElementById('device-limit-info').innerHTML = `当前 ${count}/${limit} 台`;
        
        document.getElementById('device-modal').classList.remove('hidden');

    } catch (error) {
        console.error('加载设备失败:', error);
        showToast('加载失败');
    }
}

/**
 * 确认删除设备
 */
function confirmDeleteDevice(id, name) {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限删除设备');
        return;
    }
    
    document.getElementById('confirm-message').textContent = `确定要删除设备「${name}」吗？`;
    pendingDeleteCallback = () => deleteDevice(id);
    document.getElementById('confirm-modal').classList.remove('hidden');
}

/**
 * 删除设备
 */
async function deleteDevice(id) {
    try {
        const { error } = await supabase
            .from('devices')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('删除成功');
        loadDevices();
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败');
    }
}

/**
 * 提交设备表单
 */
async function submitDeviceForm(e) {
    e.preventDefault();

    const name = document.getElementById('device-name').value.trim();
    const device_type = document.getElementById('device-type').value;
    const status = document.getElementById('device-status').value;
    const description = document.getElementById('device-description').value.trim();

    if (!name) {
        showToast('请输入设备名称');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        if (editingDeviceId) {
            // 更新
            const { error } = await supabase
                .from('devices')
                .update({ name, device_type, status, description })
                .eq('id', editingDeviceId);

            if (error) throw error;
            showToast('更新成功');
        } else {
            // 新增前再次检查上限
            const { count, limit, canAdd } = await checkDeviceLimit();
            if (!canAdd) {
                showToast(`工点设备已达上限 ${limit} 台`);
                return;
            }
            
            // 新增
            const { error } = await supabase
                .from('devices')
                .insert({
                    worksite_id: worksiteId,
                    name,
                    device_type,
                    status,
                    description,
                    created_by: currentUser.id
                });

            if (error) throw error;
            showToast('添加成功');
        }

        closeModal('device-modal');
        loadDevices();
    } catch (error) {
        console.error('保存失败:', error);
        showToast('保存失败: ' + error.message);
    } finally {
        btn.disabled = false;
    }
}

/**
 * 加载成员列表
 */
async function loadMembers() {
    const memberList = document.getElementById('member-list');
    memberList.innerHTML = '<div class="loading">加载中...</div>';

    try {
        // 获取所有成员
        const { data: members, error } = await supabase
            .from('worksite_members')
            .select(`
                *,
                profile:profiles(id, name, email)
            `)
            .eq('worksite_id', worksiteId);

        if (error) throw error;

        // 添加创建者（owner）
        const ownerProfile = { id: worksiteData.created_by, name: currentUser.user_metadata?.name, email: currentUser.email };
        
        let html = `
            <div class="member-item">
                <div class="member-info">
                    <div class="member-avatar">${(ownerProfile.name || ownerProfile.email || '?')[0].toUpperCase()}</div>
                    <div>
                        <div class="member-name">${escapeHtml(ownerProfile.name || '创建者')}</div>
                        <div class="member-email">${ownerProfile.email || ''}</div>
                    </div>
                </div>
                <span class="role-badge owner">创建者</span>
            </div>
        `;

        (members || []).forEach(member => {
            if (member.profile) {
                const roleText = member.role === 'editor' ? '可编辑' : '只读';
                const roleBadgeClass = member.role === 'editor' ? 'editor' : 'viewer';
                html += `
                    <div class="member-item">
                        <div class="member-info">
                            <div class="member-avatar">${(member.profile.name || member.profile.email || '?')[0].toUpperCase()}</div>
                            <div>
                                <div class="member-name">${escapeHtml(member.profile.name || '未知')}</div>
                                <div class="member-email">${member.profile.email || ''}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${currentUserRole !== 'viewer' ? `<button onclick="removeMember('${member.id}')" class="btn-icon" style="font-size: 16px;">🗑️</button>` : ''}
                            <span class="role-badge ${roleBadgeClass}">${roleText}</span>
                        </div>
                    </div>
                `;
            }
        });

        memberList.innerHTML = html;

    } catch (error) {
        console.error('加载成员失败:', error);
        memberList.innerHTML = '<p style="text-align: center; color: #999;">加载失败</p>';
    }
}

/**
 * 邀请成员
 */
async function inviteMember() {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限添加成员');
        return;
    }
    
    const email = document.getElementById('invite-email').value.trim();
    const role = document.getElementById('invite-role').value;

    if (!email) {
        showToast('请输入邮箱');
        return;
    }

    if (email === currentUser.email) {
        showToast('不能添加自己');
        return;
    }

    try {
        // 查找用户
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', email)
            .single();

        if (profileError || !profiles) {
            showToast('该用户尚未注册或邮箱不存在');
            return;
        }

        // 检查是否已是成员
        const { data: existing } = await supabase
            .from('worksite_members')
            .select('id')
            .eq('worksite_id', worksiteId)
            .eq('user_id', profiles.id)
            .single();

        if (existing) {
            showToast('该用户已是成员');
            return;
        }

        // 添加成员
        const { error: insertError } = await supabase
            .from('worksite_members')
            .insert({
                worksite_id: worksiteId,
                user_id: profiles.id,
                role: role
            });

        if (insertError) throw insertError;

        showToast('添加成功');
        document.getElementById('invite-email').value = '';
        loadMembers();

    } catch (error) {
        console.error('添加成员失败:', error);
        showToast('添加失败');
    }
}

/**
 * 移除成员
 */
async function removeMember(memberId) {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限移除成员');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('worksite_members')
            .delete()
            .eq('id', memberId);

        if (error) throw error;

        showToast('已移除');
        loadMembers();
    } catch (error) {
        console.error('移除失败:', error);
        showToast('移除失败');
    }
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
}

/**
 * 处理筛选变化
 */
function handleFilterChange() {
    filterType = document.getElementById('filter-type').value;
    filterStatus = document.getElementById('filter-status').value;
    filterSearch = document.getElementById('filter-search').value.trim();
    
    loadDevices();
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    // 获取工点ID
    worksiteId = getUrlParam('id');
    if (!worksiteId) {
        showToast('无效的工点ID');
        history.back();
        return;
    }

    // 初始化 Supabase
    if (!supabase) {
        if (!initSupabase()) {
            showToast('请先配置 Supabase');
            return;
        }
    }

    // 检查会话
    await checkSession();

    if (!currentUser) {
        return; // 未登录，auth.js 会处理跳转
    }

    // 加载数据
    await loadWorksiteInfo();
    await loadDevices();

    // 绑定事件
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        loadWorksiteInfo();
        loadDevices();
    });
    document.getElementById('btn-add-device')?.addEventListener('click', openAddDeviceModal);
    document.getElementById('btn-members')?.addEventListener('click', () => {
        loadMembers();
        document.getElementById('members-modal').classList.remove('hidden');
    });
    document.getElementById('btn-invite')?.addEventListener('click', inviteMember);
    document.getElementById('device-form')?.addEventListener('submit', submitDeviceForm);
    
    // 筛选事件
    document.getElementById('filter-type')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-status')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-search')?.addEventListener('input', handleFilterChange);

    // 关闭按钮
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // 确认删除
    document.getElementById('confirm-ok')?.addEventListener('click', () => {
        if (pendingDeleteCallback) {
            pendingDeleteCallback();
            pendingDeleteCallback = null;
        }
        closeModal('confirm-modal');
    });

    // 点击背景关闭弹窗
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
});
