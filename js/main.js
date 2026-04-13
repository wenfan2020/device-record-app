/**
 * CZ12标设备管理 - 极简稳定版
 * 认证方式：简单密码（无注册系统）
 */

const SUPABASE_URL = 'https://thvpdhayyyfgddzwffzv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M12fCv3XXGBkqV7iVELxhg_Ez_qaUOJ';

// 管理密码（首次设置后保存在数据库）
const ADMIN_PASSWORD = 'CZ12admin2026';

// 管理员的 UUID（固定值，对应 18006855@qq.com）
const ADMIN_UUID = '5e09b426-2ad5-4f79-8269-a3bd27c8abcf';

// 当前状态
let isAdmin = false;
let currentUser = { email: 'admin' };

// ============ Supabase REST API 调用 ============
async function supabaseRequest(table, options = {}) {
    const { method = 'GET', body, params } = options;
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    
    if (params) {
        const query = new URLSearchParams(params).toString();
        url += `?${query}`;
    }
    
    const headers = {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    };
    
    if (body) {
        headers['Prefer'] = 'return=representation';
    }
    
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '请求失败');
    return data;
}

// ============ 认证 ============
function checkAdminStatus() {
    isAdmin = localStorage.getItem('cz12_admin') === 'true';
    return isAdmin;
}

function doLogin(password) {
    if (password === ADMIN_PASSWORD) {
        localStorage.setItem('cz12_admin', 'true');
        isAdmin = true;
        return true;
    }
    return false;
}

function doLogout() {
    localStorage.removeItem('cz12_admin');
    isAdmin = false;
}

// ============ 页面导航 ============
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId)?.classList.remove('hidden');
}

// ============ 加载工点列表 ============
async function loadWorksites() {
    const list = document.getElementById('worksite-list');
    list.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const data = await supabaseRequest('worksites', {
            params: { select: '*,devices(count)', order: 'created_at.desc' }
        });
        
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="icon">🏗️</div><p>暂无工点</p></div>';
            return;
        }
        
        list.innerHTML = data.map(ws => {
            const count = ws.devices?.[0]?.count || 0;
            const orgClass = ws.org === '局指' ? 'juzhi' : ws.org === '一分部' ? 'yifenbu' : 'erfenbu';
            return `
                <div class="card" onclick="goToWorksite('${ws.id}')">
                    <div class="card-header">
                        <div class="card-title">${escapeHtml(ws.name)} <span class="org-badge ${orgClass}">${ws.org}</span></div>
                        ${isAdmin ? `<div class="card-actions"><button onclick="event.stopPropagation();editWorksite('${ws.id}','${ws.org}','${escapeHtml(ws.name)}')">✏️</button><button onclick="event.stopPropagation();delWorksite('${ws.id}','${escapeHtml(ws.name)}')">🗑️</button></div>` : ''}
                    </div>
                    <div class="card-meta">创建于 ${formatDate(ws.created_at)}</div>
                    <div class="card-stats">📋 ${count} 台设备</div>
                </div>`;
        }).join('');
        
        // 隐藏/显示添加按钮
        document.getElementById('btn-add-worksite').style.display = isAdmin ? '' : 'none';
        
    } catch (err) {
        list.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>加载失败: ${err.message}</p></div>`;
    }
}

// ============ 加载设备列表 ============
async function loadDevices(worksiteId, worksiteName) {
    const list = document.getElementById('device-list');
    document.getElementById('worksite-title').textContent = worksiteName;
    list.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const data = await supabaseRequest('devices', {
            params: { 
                select: '*,photos(count)', 
                eq_worksite_id: worksiteId,
                order: 'created_at.desc'
            }
        });
        
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="icon">🔧</div><p>暂无设备</p></div>';
            return;
        }
        
        const statusEmoji = { '正常': '🟢', '维修中': '🟠', '报废': '🔴' };
        const typeClass = { '大中型设备': 'large', '特种设备': 'special' };
        
        list.innerHTML = data.map(d => {
            const photoCount = d.photos?.[0]?.count || 0;
            return `
                <div class="card" onclick="goToDevice('${d.id}','${worksiteId}')">
                    <div class="card-header">
                        <div class="card-title">${escapeHtml(d.name)} <span class="type-badge ${typeClass[d.device_type] || ''}">${d.device_type}</span></div>
                        ${isAdmin ? `<div class="card-actions"><button onclick="event.stopPropagation();editDevice('${d.id}')">✏️</button><button onclick="event.stopPropagation();delDevice('${d.id}','${escapeHtml(d.name)}')">🗑️</button></div>` : ''}
                    </div>
                    <div class="card-meta">${statusEmoji[d.status]} ${d.status}</div>
                    ${d.description ? `<div class="card-meta">${escapeHtml(d.description.substring(0,50))}</div>` : ''}
                    <div class="card-stats">📷 ${photoCount}张 · ${formatDate(d.created_at)}</div>
                </div>`;
        }).join('');
        
        document.getElementById('btn-add-device').style.display = isAdmin ? '' : 'none';
        
    } catch (err) {
        list.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>加载失败</p></div>`;
    }
}

// ============ 添加工点 ============
async function submitWorksite(e) {
    e.preventDefault();
    const org = document.getElementById('ws-org').value;
    const name = document.getElementById('ws-name').value.trim();
    
    if (!name) { showToast('请输入名称'); return; }
    
    try {
        await supabaseRequest('worksites', {
            method: 'POST',
            body: { org, name, created_by: ADMIN_UUID }
        });
        showToast('添加成功');
        closeModal('ws-modal');
        loadWorksites();
    } catch (err) {
        showToast('添加失败: ' + err.message);
    }
}

// ============ 编辑工点 ============
let editingWsId = null;
function editWorksite(id, org, name) {
    editingWsId = id;
    document.getElementById('ws-modal-title').textContent = '编辑工点';
    document.getElementById('ws-org').value = org;
    document.getElementById('ws-name').value = name;
    document.getElementById('ws-modal').classList.remove('hidden');
}

async function deleteWorksite(id, name) {
    if (!confirm(`确定删除「${name}」？`)) return;
    try {
        await supabaseRequest(`worksites?id=eq.${id}`, { method: 'DELETE' });
        showToast('已删除');
        loadWorksites();
    } catch (err) {
        showToast('删除失败');
    }
}

// ============ 提交设备 ============
async function submitDevice(e) {
    e.preventDefault();
    const name = document.getElementById('dev-name').value.trim();
    const device_type = document.getElementById('dev-type').value;
    const status = document.getElementById('dev-status').value;
    const description = document.getElementById('dev-desc').value.trim();
    
    if (!name) { showToast('请输入名称'); return; }
    
    try {
        if (editingDevId) {
            await supabaseRequest(`devices?id=eq.${editingDevId}`, {
                method: 'PATCH',
                body: { name, device_type, status, description }
            });
            showToast('更新成功');
        } else {
            await supabaseRequest('devices', {
                method: 'POST',
                body: { worksite_id: currentWsId, name, device_type, status, description, created_by: ADMIN_UUID }
            });
            showToast('添加成功');
        }
        closeModal('dev-modal');
        loadDevices(currentWsId, currentWsName);
    } catch (err) {
        showToast('保存失败: ' + err.message);
    }
}

// ============ 编辑/删除设备 ============
let editingDevId = null;
function editDevice(id) {
    // 先获取数据再编辑
    supabaseRequest('devices', { params: { id: `eq.${id}`, select: '*' } }).then(data => {
        if (data && data[0]) {
            editingDevId = id;
            document.getElementById('dev-modal-title').textContent = '编辑设备';
            document.getElementById('dev-name').value = data[0].name;
            document.getElementById('dev-type').value = data[0].device_type;
            document.getElementById('dev-status').value = data[0].status;
            document.getElementById('dev-desc').value = data[0].description || '';
            document.getElementById('dev-modal').classList.remove('hidden');
        }
    });
}

async function deleteDevice(id, name) {
    if (!confirm(`确定删除「${name}」？`)) return;
    try {
        await supabaseRequest(`devices?id=eq.${id}`, { method: 'DELETE' });
        showToast('已删除');
        loadDevices(currentWsId, currentWsName);
    } catch (err) {
        showToast('删除失败');
    }
}

// ============ 全局变量 ============
let currentWsId = null;
let currentWsName = '';

// ============ 导航 ============
function goToWorksite(id) {
    currentWsId = id;
    // 获取工点名称
    supabaseRequest('worksites', { params: { id: `eq.${id}`, select: 'name' } }).then(data => {
        currentWsName = data[0]?.name || '工点';
        loadDevices(id, currentWsName);
    });
    showPage('worksite-page');
}

function goToDevice(id, wsId) {
    window.location.href = `device.html?id=${id}&worksite=${wsId}`;
}

function goHome() {
    currentWsId = null;
    loadWorksites();
    showPage('main-page');
}

// ============ 弹窗 ============
function openAddWorksite() {
    editingWsId = null;
    document.getElementById('ws-modal-title').textContent = '添加工点';
    document.getElementById('ws-org').value = '局指';
    document.getElementById('ws-name').value = '';
    document.getElementById('ws-modal').classList.remove('hidden');
}

function openAddDevice() {
    editingDevId = null;
    document.getElementById('dev-modal-title').textContent = '添加设备';
    document.getElementById('dev-name').value = '';
    document.getElementById('dev-type').value = '大中型设备';
    document.getElementById('dev-status').value = '正常';
    document.getElementById('dev-desc').value = '';
    document.getElementById('dev-modal').classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2000);
}

// ============ 工具 ============
function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

function formatDate(s) {
    if (!s) return '';
    const d = new Date(s);
    return `${d.getMonth()+1}月${d.getDate()}日`;
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已登录
    checkAdminStatus();
    
    if (!isAdmin) {
        showPage('login-page');
    } else {
        showPage('main-page');
        loadWorksites();
    }
    
    // 登录表单
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const pw = document.getElementById('password').value;
        if (doLogin(pw)) {
            showToast('登录成功');
            showPage('main-page');
            loadWorksites();
        } else {
            showToast('密码错误');
        }
    };
    
    // 退出
    document.getElementById('btn-logout').onclick = () => {
        doLogout();
        showPage('login-page');
    };
    
    // 事件绑定
    document.getElementById('btn-add-worksite').onclick = openAddWorksite;
    document.getElementById('btn-add-device').onclick = openAddDevice;
    document.getElementById('ws-form').onsubmit = submitWorksite;
    document.getElementById('dev-form').onsubmit = submitDevice;
    document.getElementById('btn-home').onclick = goHome;
    document.getElementById('btn-refresh').onclick = () => {
        if (currentWsId) loadDevices(currentWsId, currentWsName);
        else loadWorksites();
    };
    
    // 关闭弹窗
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => closeModal(btn.dataset.close);
    });
});
