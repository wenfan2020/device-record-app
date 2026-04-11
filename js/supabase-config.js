/**
 * Supabase 配置
 */

const SUPABASE_URL = 'https://thvpdhayyyfgddzwffzv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M12fCv3XXGBkqV7iVELxhg_Ez_qaUOJ';

let supabase = null;

function initSupabase() {
    console.log('[Supabase Config] Checking SDK status...');
    console.log('[Supabase Config] window.supabase type:', typeof window.supabase);
    console.log('[Supabase Config] window.supabase value:', window.supabase);
    
    if (typeof window.supabase !== 'undefined') {
        console.log('[Supabase Config] SDK loaded, creating client...');
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[Supabase Config] Client created. supabase.auth:', typeof supabase.auth);
        console.log('✅ Supabase 初始化成功');
        return true;
    } else {
        console.error('❌ Supabase SDK 未加载！');
        console.error('尝试直接使用 supabase 全局（如果有）...');
        if (typeof supabase !== 'undefined' && supabase && supabase.auth) {
            console.log('使用已有的 supabase 全局');
            return true;
        }
        document.getElementById('toast')?.classList.remove('hidden');
        document.getElementById('toast').textContent = 'SDK加载失败，请刷新页面或联系管理员';
        document.getElementById('toast').style.background = '#e74c3c';
        setTimeout(() => document.getElementById('toast')?.classList.add('hidden'), 5000);
        return false;
    }
}

console.log('%c⚙️ CZ12标设备管理 - Supabase 配置', 'font-size: 16px; font-weight: bold;');
console.log('Supabase URL:', SUPABASE_URL);

// 等待 DOM 加载完成再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}
