/**
 * 设备详情页逻辑 - 照片管理
 */

let deviceId = null;
let worksiteId = null;
let deviceData = null;
let currentUserRole = 'viewer';
let isMainAdmin = false;
let pendingDeletePhotoId = null;

const statusEmoji = { '正常': '🟢', '维修中': '🟠', '报废': '🔴' };
const statusClass = { '正常': 'normal', '维修中': 'repair', '报废': 'scrap' };
const typeClass = { '大中型设备': 'large', '特种设备': 'special' };

/**
 * 获取 URL 参数
 */
function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
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
 * 加载设备信息
 */
async function loadDeviceInfo() {
    try {
        const { data: device, error } = await supabase
            .from('devices')
            .select('*')
            .eq('id', deviceId)
            .single();

        if (error) throw error;
        deviceData = device;

        // 更新页面显示
        document.getElementById('page-title').textContent = device.name;
        document.title = device.name + ' - CZ12标设备管理';
        document.getElementById('device-name').textContent = device.name;
        document.getElementById('device-meta').innerHTML = 
            `${statusEmoji[device.status]} ${device.status} · ${formatDate(device.created_at)}`;
        
        // 类型标签
        const typeBadge = document.getElementById('device-type-badge');
        typeBadge.textContent = device.device_type;
        typeBadge.className = `type-badge ${typeClass[device.device_type] || ''}`;
        
        if (device.description) {
            document.getElementById('device-description').textContent = device.description;
        }

        // 状态指示器
        const indicator = document.getElementById('device-status-indicator');
        indicator.className = `device-status ${statusClass[device.status]}`;

        // 检查权限
        await checkUserRole();

    } catch (error) {
        console.error('加载设备失败:', error);
        showToast('加载失败');
    }
}

/**
 * 检查权限
 */
async function checkUserRole() {
    // 获取工点信息
    const { data: worksite } = await supabase
        .from('worksites')
        .select('created_by')
        .eq('id', deviceData.worksite_id)
        .single();
    
    // 检查是否为总管理员
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_main_admin')
        .eq('id', currentUser.id)
        .single();
    
    isMainAdmin = profile?.is_main_admin === true;
    
    if (isMainAdmin) {
        currentUserRole = 'admin';
        showEditButtons();
        return;
    }

    if (worksite.created_by === currentUser.id) {
        currentUserRole = 'owner';
        showEditButtons();
        return;
    }

    const { data: member } = await supabase
        .from('worksite_members')
        .select('role')
        .eq('worksite_id', deviceData.worksite_id)
        .eq('user_id', currentUser.id)
        .single();
    
    currentUserRole = member?.role || 'viewer';
    showEditButtons();
}

/**
 * 根据权限显示操作按钮
 */
function showEditButtons() {
    if (currentUserRole !== 'viewer') {
        document.getElementById('device-actions').classList.remove('hidden');
        document.getElementById('btn-add-photo').style.display = '';
    } else {
        document.getElementById('btn-add-photo').style.display = 'none';
    }
}

/**
 * 加载照片列表
 */
async function loadPhotos() {
    const grid = document.getElementById('photo-grid');
    const countSpan = document.getElementById('photo-count');

    try {
        const { data: photos, error } = await supabase
            .from('photos')
            .select('*')
            .eq('device_id', deviceId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        countSpan.textContent = photos?.length || 0;

        if (!photos || photos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
                    <div class="icon">📷</div>
                    <p>暂无照片</p>
                    ${currentUserRole !== 'viewer' ? '<p>点击上方按钮拍照或上传</p>' : ''}
                </div>
            `;
            return;
        }

        const canDelete = currentUserRole !== 'viewer';
        
        grid.innerHTML = photos.map(photo => `
            <div style="position: relative; cursor: pointer;" onclick="viewPhoto('${photo.url}')">
                <img src="${photo.url}" alt="设备照片" loading="lazy">
                ${canDelete ? `
                    <button onclick="event.stopPropagation(); confirmDeletePhoto('${photo.id}')" 
                            style="position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; background: rgba(0,0,0,0.5); border: none; border-radius: 4px; color: #fff; font-size: 12px; cursor: pointer;">×</button>
                ` : ''}
            </div>
        `).join('');

    } catch (error) {
        console.error('加载照片失败:', error);
        showToast('加载照片失败');
    }
}

/**
 * 触发拍照/上传
 */
function triggerPhotoUpload() {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限上传照片');
        return;
    }
    document.getElementById('photo-input').click();
}

/**
 * 处理照片上传
 */
async function handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (currentUserRole === 'viewer') {
        showToast('您没有权限上传照片');
        return;
    }

    showToast('上传中...');

    for (const file of files) {
        try {
            // 生成唯一文件名
            const ext = file.name.split('.').pop();
            const fileName = `${deviceId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            // 上传到 Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('device-photos')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 获取公开URL
            const { data: urlData } = supabase.storage
                .from('device-photos')
                .getPublicUrl(fileName);

            // 保存到数据库
            const { error: dbError } = await supabase
                .from('photos')
                .insert({
                    device_id: deviceId,
                    url: urlData.publicUrl,
                    created_by: currentUser.id
                });

            if (dbError) throw dbError;

        } catch (error) {
            console.error('上传失败:', error);
            showToast('上传失败: ' + error.message);
        }
    }

    showToast('上传完成');
    loadPhotos();
    e.target.value = '';
}

/**
 * 查看照片
 */
function viewPhoto(url) {
    const viewer = document.getElementById('photo-viewer');
    const img = document.getElementById('photo-viewer-img');
    img.src = url;
    viewer.classList.remove('hidden');
}

/**
 * 确认删除照片
 */
function confirmDeletePhoto(photoId) {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限删除照片');
        return;
    }
    pendingDeletePhotoId = photoId;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

/**
 * 删除照片
 */
async function deletePhoto() {
    if (!pendingDeletePhotoId) return;
    
    if (currentUserRole === 'viewer') {
        showToast('您没有权限删除照片');
        return;
    }

    try {
        // 获取照片信息
        const { data: photo } = await supabase
            .from('photos')
            .select('url')
            .eq('id', pendingDeletePhotoId)
            .single();

        if (photo) {
            // 从Storage删除文件
            const fileName = photo.url.split('/').pop();
            await supabase.storage
                .from('device-photos')
                .remove([fileName]);

            // 从数据库删除
            await supabase
                .from('photos')
                .delete()
                .eq('id', pendingDeletePhotoId);
        }

        showToast('已删除');
        loadPhotos();

    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败');
    }

    pendingDeletePhotoId = null;
}

/**
 * 关闭照片查看器
 */
function closePhotoViewer() {
    document.getElementById('photo-viewer').classList.add('hidden');
}

/**
 * 打开编辑弹窗
 */
function openEditDeviceModal() {
    if (currentUserRole === 'viewer') {
        showToast('您没有权限编辑设备');
        return;
    }
    
    document.getElementById('device-id').value = deviceData.id;
    document.getElementById('device-name-input').value = deviceData.name;
    document.getElementById('device-type').value = deviceData.device_type;
    document.getElementById('device-status').value = deviceData.status;
    document.getElementById('device-description').value = deviceData.description || '';
    document.getElementById('device-modal').classList.remove('hidden');
}

/**
 * 提交设备编辑表单
 */
async function submitDeviceForm(e) {
    e.preventDefault();
    
    if (currentUserRole === 'viewer') {
        showToast('您没有权限编辑设备');
        return;
    }

    const name = document.getElementById('device-name-input').value.trim();
    const device_type = document.getElementById('device-type').value;
    const status = document.getElementById('device-status').value;
    const description = document.getElementById('device-description').value.trim();

    if (!name) {
        showToast('请输入设备名称');
        return;
    }

    try {
        const { error } = await supabase
            .from('devices')
            .update({ name, device_type, status, description })
            .eq('id', deviceId);

        if (error) throw error;

        showToast('更新成功');
        closeModal('device-modal');
        loadDeviceInfo();

    } catch (error) {
        console.error('更新失败:', error);
        showToast('更新失败');
    }
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    deviceId = getUrlParam('id');
    worksiteId = getUrlParam('worksite');

    if (!deviceId) {
        showToast('无效的设备ID');
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

    await checkSession();
    
    await loadDeviceInfo();
    await loadPhotos();

    if (!currentUser) {
        // 访客模式：隐藏编辑相关按钮
        document.getElementById('btn-add-photo')?.style && (document.getElementById('btn-add-photo').style.display = 'none');
        document.getElementById('btn-edit-device')?.style && (document.getElementById('btn-edit-device').style.display = 'none');
        return;
    }

    // 事件绑定
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        loadDeviceInfo();
        loadPhotos();
    });

    document.getElementById('btn-add-photo')?.addEventListener('click', triggerPhotoUpload);
    document.getElementById('photo-input')?.addEventListener('change', handlePhotoUpload);
    document.getElementById('btn-edit-device')?.addEventListener('click', openEditDeviceModal);
    document.getElementById('device-form')?.addEventListener('submit', submitDeviceForm);

    document.getElementById('confirm-ok')?.addEventListener('click', () => {
        deletePhoto();
        closeModal('confirm-modal');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
});
