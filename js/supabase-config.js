/**
 * Supabase 配置 - 必须先加载
 */

const SUPABASE_URL = 'https://thvpdhayyyfgddzwffzv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M12fCv3XXGBkqV7iVELxhg_Ez_qaUOJ';

let supabase = null;

/**
 * 初始化 Supabase 客户端
 */
function initSupabase() {
    console.log('[Supabase] 初始化中...');
    
    // 等待 SDK 加载
    function waitForSDK(retries = 10) {
        if (typeof window.supabase !== 'undefined') {
            console.log('[Supabase] SDK 已就绪');
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Supabase] 客户端创建成功');
            return true;
        }
        if (retries > 0) {
            console.log(`[Supabase] 等待 SDK 加载... (剩余 ${retries} 次)`);
            setTimeout(() => waitForSDK(retries - 1), 200);
            return false;
        }
        console.error('[Supabase] SDK 加载失败！');
        return false;
    }
    
    if (typeof window.supabase === 'undefined') {
        console.warn('[Supabase] SDK 未定义，尝试加载...');
        // 动态加载 SDK
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            console.log('[Supabase] SDK 动态加载完成');
            waitForSDK();
        };
        script.onerror = () => {
            console.error('[Supabase] SDK 加载失败');
        };
        document.head.appendChild(script);
    } else {
        waitForSDK();
    }
}

console.log('%c⚙️ CZ12标设备管理 - Supabase 配置', 'font-size: 16px; font-weight: bold;');
console.log('Supabase URL:', SUPABASE_URL);

// 页面加载后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}
