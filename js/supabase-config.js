/**
 * Supabase 配置
 */

const SUPABASE_URL = 'https://thvpdhayyyfgddzwffzv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M12fCv3XXGBkqV7iVELxhg_Ez_qaUOJ';

let supabase = null;

function initSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase 初始化成功');
        return true;
    } else {
        console.error('❌ Supabase SDK 未加载');
        return false;
    }
}

console.log('%c⚙️ CZ12标设备管理 - Supabase 配置', 'font-size: 16px; font-weight: bold;');
console.log('请在 js/supabase-config.js 中配置您的 Supabase 连接信息');
console.log('访问 https://supabase.com 创建免费项目');

// 自动初始化 Supabase
initSupabase();
