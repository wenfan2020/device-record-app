/**
 * 百度 OCR 铭牌识别模块
 * 通过 Supabase Edge Function 代理调用百度高精度文字识别
 */

const OCR_EDGE_FUNCTION = 'https://thvpdhayyyfgddzwffzv.supabase.co/functions/v1/ocr-proxy';

/**
 * 压缩图片并转换为 base64
 */
async function compressImageToBase64(file, quality = 0.85, maxWidth = 1600) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round(height * maxWidth / width);
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            const dataURL = canvas.toDataURL('image/jpeg', quality);
            const base64 = dataURL.split(',')[1];
            resolve(base64);
        };
        img.onerror = reject;
        img.src = url;
    });
}

/**
 * 调用 OCR 识别
 */
async function recognizeNameplate(imageFile) {
    const base64 = await compressImageToBase64(imageFile);
    const response = await fetch(OCR_EDGE_FUNCTION, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sb_publishable_M12fCv3XXGBkqV7iVELxhg_Ez_qaUOJ'
        },
        body: JSON.stringify({ image: base64 })
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error('OCR 请求失败: ' + err);
    }
    const data = await response.json();
    if (data.error_code) {
        throw new Error('百度OCR错误: ' + (data.error_msg || data.error_code));
    }
    const words = data.words_result || [];
    return words.map(w => w.words).join('\n');
}

/**
 * 显示 OCR 结果弹窗
 */
function showOcrResultModal(text, onFill) {
    const existing = document.getElementById('ocr-result-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ocr-result-modal';
    modal.className = 'modal';
    modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div class="modal-content" style="max-height:80vh;overflow-y:auto;width:90%;max-width:400px;background:#fff;border-radius:12px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;font-size:16px;">📋 铭牌识别结果</h3>
                <button onclick="document.getElementById('ocr-result-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#666;">×</button>
            </div>
            <p style="font-size:13px;color:#666;margin-bottom:6px;">识别内容（可编辑后填入）：</p>
            <textarea id="ocr-text-area" style="width:100%;min-height:120px;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;line-height:1.6;box-sizing:border-box;resize:vertical;">${text}</textarea>
            <p style="font-size:12px;color:#999;margin-top:8px;margin-bottom:8px;">选择填入位置：</p>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <button onclick="window._ocrFill('name')" style="width:100%;padding:10px;background:#1565C0;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">→ 填入【设备名称】</button>
                <button onclick="window._ocrFill('desc')" style="width:100%;padding:10px;background:#fff;color:#1565C0;border:1px solid #1565C0;border-radius:6px;font-size:14px;cursor:pointer;">→ 填入【备注说明】</button>
                <button onclick="document.getElementById('ocr-result-modal').remove()" style="width:100%;padding:8px;background:none;color:#999;border:none;font-size:13px;cursor:pointer;">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    window._ocrFill = (target) => {
        const t = document.getElementById('ocr-text-area').value.trim();
        onFill(target, t);
        document.getElementById('ocr-result-modal').remove();
    };
}

/**
 * 触发铭牌 OCR 扫描
 * @param {Function} onFill - 回调(target: 'name'|'desc', text: string)
 */
function triggerNameplateOcr(onFill) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async () => {
        const file = input.files[0];
        document.body.removeChild(input);
        if (!file) return;

        const loadingEl = document.createElement('div');
        loadingEl.id = 'ocr-loading';
        loadingEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;padding:16px 24px;border-radius:8px;font-size:14px;z-index:10000;';
        loadingEl.textContent = '🔍 正在识别铭牌...';
        document.body.appendChild(loadingEl);

        try {
            const text = await recognizeNameplate(file);
            document.getElementById('ocr-loading')?.remove();
            if (!text.trim()) {
                alert('未识别到文字，请重新拍照（保持铭牌清晰、光线充足）');
                return;
            }
            showOcrResultModal(text, onFill);
        } catch (e) {
            document.getElementById('ocr-loading')?.remove();
            console.error('OCR error:', e);
            alert('识别失败：' + e.message + '\n\n请检查网络连接后重试');
        }
    };

    input.click();
}
