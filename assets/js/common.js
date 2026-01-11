// 當頁面載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化 Lucide 圖示
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // 2. 處理導覽列 active 狀態 (簡單版)
    // 這會根據當前網址自動幫 nav-item 加上 active class
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-item');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        // 簡單比對路徑是否包含 href (例如 daily/index.html)
        if (href && href !== '#' && currentPath.includes(href.replace('../', '').replace('./', ''))) {
            // 先移除所有 active
            navLinks.forEach(n => n.classList.remove('active'));
            // 加上 active
            link.classList.add('active');
        }
    });
});

// 取得今日日期字串 (MM-DD)
function getTodayString() {
    const d = new Date();
    return `${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

// 從 ISO 時間字串提取 MM-DD
function extractMonthDay(dateStr) {
    if (!dateStr) return null;
    // 簡單處理 ISO 格式 (YYYY-MM-DD...)
    let s = dateStr.replace(/[^\d\-\/\.]/g,'');
    let p = s.split(/[-/.]/).filter(x=>x);
    if(p.length>=2) return `${parseInt(p[p.length-2]).toString().padStart(2,'0')}-${parseInt(p[p.length-1]).toString().padStart(2,'0')}`;
    return null;
}