/**
 * 主应用逻辑 - CZ12标设备管理
 */

// 当前用户信息
let currentUser = null;
let currentUserRole = 'viewer'; // admin/editor/viewer
let isMainAdmin = false;

// 设备上限配置
const DEVICE_LIMITS = {
    '局指': 100,
    '一分部': 300,
    '二分部': 300
};

// 当前编辑的工点ID
let editingWorksiteId = null;
// 当前删除的确认回调
let pendingDeleteCallback = null;

// 筛选状态
let filterOrg = '';
let filterType = '';
let filterSearch = '';

// 所有工点数据（缓存）
let allWorksites = [];

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
 * 获取设备上限
 */
function getDeviceLimit(org) {
    return DEVICE_LIMITS[org] || 999;
}

/**
 * 获取单位对应的CSS类
 */
function getOrgClass(org) {
    if (org === '局指') return 'juzhi';
    if (org === '一分部') return 'yifenbu';
    if (org === '二分部') return 'erfenbu';
    return '';
}

/**
 * 加载工点列表
 */
async function loadWorksites() {
    const listContainer = document.getElementById('worksite-list');
    listContainer.innerHTML = '<div class="loading">加载中...</div>';

    try {
        const { data: worksites, error } = await supabase
            .from('worksites')
            .select(`
                *,
                devices(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 缓存所有工点
        allWorksites = worksites || [];

        // 应用筛选
        let filtered = allWorksites;
        
        if (filterOrg) {
            filtered = filtered.filter(ws => ws.org === filterOrg);
        }
        
        if (filterSearch) {
            const search = filterSearch.toLowerCase();
            filtered = filtered.filter(ws => 
                ws.name.toLowerCase().includes(search) ||
                (ws.devices && ws.devices.some(d => d.name.toLowerCase().includes(search)))
            );
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🏗️</div>
                    <p>${allWorksites.length === 0 ? '还没有工点' : '筛选结果为空'}</p>
                    ${allWorksites.length === 0 ? '<p>点击下方 + 按钮创建第一个工点</p>' : ''}
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(ws => {
            const deviceCount = ws.devices?.[0]?.count || 0;
            const limit = getDeviceLimit(ws.org);
            const isNearLimit = deviceCount >= limit * 0.8;
            const isAtLimit = deviceCount >= limit;
            
            return `
                <div class="card" onclick="goToWorksite('${ws.id}')">
                    <div class="card-header">
                        <div>
                            <div class="card-title">
                                ${escapeHtml(ws.name)}
                                <span class="org-badge ${getOrgClass(ws.org)}">${ws.org}</span>
                            </div>
                            <div class="card-meta">创建于 ${formatDate(ws.created_at)}</div>
                        </div>
                        <div class="card-actions" onclick="event.stopPropagation()">
                            ${isMainAdmin || currentUserRole === 'admin' ? `
                                <button onclick="editWorksite('${ws.id}')" title="编辑">✏️</button>
                                <button onclick="confirmDeleteWorksite('${ws.id}', '${escapeHtml(ws.name)}')" title="删除">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-stats">
                        <span>📋 ${deviceCount} 台设备</span>
                        <span style="color: ${isAtLimit ? '#d32f2f' : isNearLimit ? '#E65100' : '#666'}">
                            (上限 ${limit})
                        </span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('加载工点失败:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="icon">❌</div>
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * 检查用户是否为总管理员
 */
async function checkMainAdmin() {
    // 从 profiles 表获取 admin 标志
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_main_admin')
        .eq('id', currentUser.id)
        .single();
    
    isMainAdmin = profile?.is_main_admin === true;
    
    // 更新界面
    const roleSpan = document.getElementById('user-role');
    if (isMainAdmin) {
        currentUserRole = 'admin';
        roleSpan.textContent = '主管理员';
        roleSpan.className = 'role-badge admin';
        document.getElementById('btn-add-worksite').style.display = '';
    } else {
        // 检查是否是某个工点的 editor
        const { data: members } = await supabase
            .from('worksite_members')
            .select('role')
            .eq('user_id', currentUser.id)
            .eq('role', 'editor');
        
        if (members && members.length > 0) {
            currentUserRole = 'editor';
            roleSpan.textContent = '可编辑';
            roleSpan.className = 'role-badge editor';
        } else {
            currentUserRole = 'viewer';
            roleSpan.textContent = '只读';
            roleSpan.className = 'role-badge viewer';
        }
        
        // 非管理员隐藏添加工点按钮
        document.getElementById('btn-add-worksite').style.display = 'none';
    }
}

/**
 * 跳转工点详情页
 */
function goToWorksite(worksiteId) {
    window.location.href = `worksite.html?id=${worksiteId}`;
}

/**
 * 打开添加工点弹窗
 */
function openAddWorksiteModal() {
    if (!isMainAdmin && currentUserRole !== 'admin') {
        showToast('只有主管理员可以添加工点');
        return;
    }
    
    editingWorksiteId = null;
    document.getElementById('worksite-modal-title').textContent = '添加工点';
    document.getElementById('worksite-id').value = '';
    document.getElementById('worksite-org').value = '局指';
    document.getElementById('worksite-name').value = '';
    updateLimitInfo('局指');
    document.getElementById('worksite-modal').classList.remove('hidden');
}

/**
 * 更新设备上限提示
 */
async function updateLimitInfo(org) {
    const infoDiv = document.getElementById('device-limit-info');
    const limit = getDeviceLimit(org);
    
    // 统计该单位现有工点数量
    const { data: existing } = await supabase
        .from('worksites')
        .select('id')
        .eq('org', org);
    
    const count = existing?.length || 0;
    infoDiv.innerHTML = `<span>该单位已有 ${count} 个工点，单个工点设备上限 ${limit} 台</span>`;
    
    if (count >= 10) {
        infoDiv.className = 'limit-info warning';
    } else {
        infoDiv.className = 'limit-info';
    }
}

/**
 * 编辑工点
 */
function editWorksite(id, org, name) {
    if (!isMainAdmin && currentUserRole !== 'admin') {
        showToast('只有主管理员可以编辑工点');
        return;
    }
    
    editingWorksiteId = id;
    document.getElementById('worksite-modal-title').textContent = '编辑工点';
    document.getElementById('worksite-id').value = id;
    document.getElementById('worksite-org').value = org;
    document.getElementById('worksite-name').value = name;
    updateLimitInfo(org);
    document.getElementById('worksite-modal').classList.remove('hidden');
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/**
 * 确认删除工点
 */
function confirmDeleteWorksite(id, name) {
    if (!isMainAdmin && currentUserRole !== 'admin') {
        showToast('只有主管理员可以删除工点');
        return;
    }
    
    editingWorksiteId = id;
    document.getElementById('confirm-message').textContent = `确定要删除工点「${name}」吗？删除后无法恢复！`;
    pendingDeleteCallback = () => deleteWorksite(id);
    document.getElementById('confirm-modal').classList.remove('hidden');
}

/**
 * 执行删除
 */
async function deleteWorksite(id) {
    try {
        const { error } = await supabase
            .from('worksites')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('删除成功');
        loadWorksites();
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败: ' + error.message);
    }
}

/**
 * 提交工点表单
 */
async function submitWorksiteForm(e) {
    e.preventDefault();
    
    const org = document.getElementById('worksite-org').value;
    const name = document.getElementById('worksite-name').value.trim();
    
    if (!name) {
        showToast('请输入工点名称');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        if (editingWorksiteId) {
            // 更新
            const { error } = await supabase
                .from('worksites')
                .update({ org, name })
                .eq('id', editingWorksiteId);

            if (error) throw error;
            showToast('更新成功');
        } else {
            // 新增
            const { error } = await supabase
                .from('worksites')
                .insert({
                    org,
                    name,
                    created_by: currentUser.id
                });

            if (error) throw error;
            showToast('创建成功');
        }

        closeModal('worksite-modal');
        loadWorksites();
    } catch (error) {
        console.error('保存失败:', error);
        showToast('保存失败: ' + error.message);
    } finally {
        btn.disabled = false;
    }
}

/**
 * 处理筛选变化
 */
function handleFilterChange() {
    filterOrg = document.getElementById('filter-org').value;
    filterType = document.getElementById('filter-type').value;
    filterSearch = document.getElementById('filter-search').value.trim();
    
    // 重新加载并筛选
    loadWorksites();
}

/**
 * 工具函数：HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * 工具函数：格式化日期
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
}

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
    // 等待 Supabase 初始化
    if (!supabase) {
        if (!initSupabase()) {
            document.getElementById('worksite-list').innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚙️</div>
                    <p>请先配置 Supabase 连接信息</p>
                    <p>编辑 js/supabase-config.js 文件</p>
                </div>
            `;
            return;
        }
    }

    // 检查会话
    checkSession();

    // 绑定事件
    document.getElementById('btn-add-worksite')?.addEventListener('click', openAddWorksiteModal);
    document.getElementById('btn-refresh')?.addEventListener('click', loadWorksites);
    document.getElementById('worksite-form')?.addEventListener('submit', submitWorksiteForm);
    
    // 筛选事件
    document.getElementById('filter-org')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-type')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-search')?.addEventListener('input', handleFilterChange);

    // 关闭按钮
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // 确认删除弹窗
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
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    // 单位选择变化时更新提示
    document.getElementById('worksite-org')?.addEventListener('change', (e) => {
        updateLimitInfo(e.target.value);
    });
});
