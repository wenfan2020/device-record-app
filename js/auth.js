/**
 * 认证模块 - 登录/注册
 */

// 当前用户
let currentUser = null;

// 获取 supabase 客户端（兼容 SDK 加载时机）
function getSupabase() {
    if (typeof supabase !== 'undefined' && supabase && supabase.auth) {
        return supabase;
    }
    if (typeof window.supabase !== 'undefined' && window.supabase && window.supabase.auth) {
        return window.supabase;
    }
    return null;
}

/**
 * 显示提示信息
 */
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

/**
 * 更新界面显示（根据登录状态）
 */
function updateUIForAuthState(user) {
    const loginPage = document.getElementById('login-page');
    const mainPage = document.getElementById('main-page');
    const userNameSpan = document.getElementById('user-name');

    if (user) {
        currentUser = user;
        loginPage?.classList.add('hidden');
        mainPage?.classList.remove('hidden');
        if (userNameSpan) userNameSpan.textContent = user.user_metadata?.name || user.email;
        loadWorksites();
    } else {
        currentUser = null;
        loginPage?.classList.remove('hidden');
        mainPage?.classList.add('hidden');
    }
}

/**
 * 监听登录状态变化
 */
function setupAuthListener() {
    const sb = getSupabase();
    if (!sb) {
        console.warn('Supabase 未初始化，延迟设置监听器');
        setTimeout(setupAuthListener, 500);
        return;
    }
    sb.auth.onAuthStateChange((event, session) => {
        console.log('Auth 状态变化:', event);
        updateUIForAuthState(session?.user || null);
    });
}

/**
 * 检查当前会话
 */
async function checkSession() {
    const sb = getSupabase();
    if (!sb) {
        console.warn('Supabase 未初始化，延迟检查会话');
        setTimeout(checkSession, 500);
        return;
    }
    try {
        const { data: { session } } = await sb.auth.getSession();
        updateUIForAuthState(session?.user || null);
    } catch (error) {
        console.error('会话检查失败:', error);
    }
}

/**
 * 登录/注册表单提交
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const sb = getSupabase();
    if (!sb) {
        showToast('系统加载中，请刷新页面');
        return;
    }
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value.trim();

    if (!email || !password) {
        showToast('请填写邮箱和密码');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '处理中...';

    try {
        // 先尝试登录
        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                const { data: signUpData, error: signUpError } = await sb.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            name: name || email.split('@')[0]
                        }
                    }
                });

                if (signUpError) throw signUpError;
                showToast('注册成功，已自动登录');
            } else {
                throw error;
            }
        } else {
            showToast('登录成功');
        }
    } catch (error) {
        console.error('认证错误:', error);
        showToast(error.message || '认证失败');
    } finally {
        btn.disabled = false;
        btn.textContent = '登录 / 注册';
    }
}

/**
 * 退出登录
 */
async function handleLogout() {
    const sb = getSupabase();
    if (!sb) {
        showToast('系统加载中');
        return;
    }
    const { error } = await sb.auth.signOut();
    if (error) {
        showToast('退出失败');
    } else {
        showToast('已退出登录');
    }
}

// 初始化认证监听和会话检查
document.addEventListener('DOMContentLoaded', () => {
    // 绑定登录表单
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // 绑定退出按钮
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 延迟检查会话，确保 SDK 已加载
    setTimeout(() => {
        setupAuthListener();
        checkSession();
    }, 300);
});
