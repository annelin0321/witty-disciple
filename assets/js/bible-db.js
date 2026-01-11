// 聖經資料庫設定
const BIBLE_DB_URL = 'https://raw.githubusercontent.com/annelin0321/bible-zh/main/bible_complete.db';
let db = null;
let isDbLoading = false;
let dbCols = {};

// 初始化資料庫 (所有頁面通用)
async function initBibleDB() {
    if (db) return db;
    if (isDbLoading) return new Promise(resolve => {
        const check = setInterval(() => { if(db || !isDbLoading) { clearInterval(check); resolve(db); } }, 100);
    });

    isDbLoading = true;
    try {
        // 確保 sql-wasm.js 已在 HTML 中引入
        const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm` });
        const response = await fetch(BIBLE_DB_URL);
        if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const buffer = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(buffer));
        console.log("Bible DB Loaded Successfully");
        
        // 自動偵測欄位名稱
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values;
        let validTable = tables.find(t => /bible|verse|scripture/i.test(t[0]));
        if (!validTable) validTable = tables.find(t => t[0] !== 'sqlite_sequence');
        const tableName = validTable ? validTable[0] : tables[0][0];
        
        const cols = db.exec(`PRAGMA table_info(${tableName})`)[0].values.map(r=>r[1]);
        
        dbCols = {
            tableName: tableName,
            book: cols.find(c => /book|b|書|vol/i.test(c)) || cols[0],
            chap: cols.find(c => /chapter|chap|c|章/i.test(c)) || cols[1],
            ver: cols.find(c => /verse|v|節/i.test(c)) || cols[2],
            text: cols.find(c => /lection|content|text|scripture|經文|經文/i.test(c)) || cols[cols.length - 1]
        };

        return db;
    } catch (err) {
        console.error("DB Error", err);
        return null;
    } finally {
        isDbLoading = false;
    }
}

// 解析經文引用 (例如 "約翰福音 3:16")
function parseBibleReference(text) {
    if (!text) return null;
    text = text.replace(/[\(\)\uff08\uff09]/g, ' ').replace(/：/g, ':').trim();
    const bookPat = "([1-3]?\\s?[\\u4e00-\\u9fa5]{1,15}|[1-3]?\\s?[a-zA-Z]+)";
    const chapVersePat = "(\\d+)\\s*:\\s*(\\d+)(?:\\s*[-–~]\\s*(\\d+))?";
    
    // 嘗試 "書卷 章:節"
    const cvRegex = new RegExp(`${bookPat}\\s*${chapVersePat}`, 'g');
    let match = null;
    let lastMatch = null;
    while ((match = cvRegex.exec(text)) !== null) { lastMatch = match; }

    if (lastMatch) {
        return {
            book: lastMatch[1].trim(),
            chapter: parseInt(lastMatch[2]),
            verse: parseInt(lastMatch[3]),
            endVerse: lastMatch[4] ? parseInt(lastMatch[4]) : parseInt(lastMatch[3])
        };
    }
    
    // 嘗試 "書卷 章"
    const chapRegex = new RegExp(`${bookPat}\\s*(\\d+)\\s*$`, 'g'); 
    while ((match = chapRegex.exec(text)) !== null) { lastMatch = match; }
    
    if (lastMatch) {
        return { book: lastMatch[1].trim(), chapter: parseInt(lastMatch[2]), verse: 1, endVerse: null };
    }

    return null;
}

// 開啟經文 Modal (通用版)
// 注意：這需要 HTML 頁面中有 id="bible-modal" 的結構
async function openScripture(reference, highlightVerse = null) {
    const modal = document.getElementById('bible-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if(!modal) {
        console.warn("Bible modal not found in this page");
        // 如果頁面沒有 modal (例如簡單的入口頁)，則跳轉到圖書館
        if(confirm(`閱讀經文：${reference}\n\n是否前往圖書館閱讀完整內容？`)) {
            // 判斷當前路徑深度
            const pathPrefix = window.location.pathname.includes('/daily/') || window.location.pathname.includes('/school/') ? '../' : '';
            window.location.href = `${pathPrefix}library/index.html`;
        }
        return;
    }

    modal.classList.add('show');
    modalBody.innerHTML = `<div class="flex justify-center py-10"><i data-lucide="loader-2" class="w-8 h-8 animate-spin text-[#8D7B68]"></i></div>`;
    if(window.lucide) lucide.createIcons();

    const database = await initBibleDB();
    if (!database) { 
        modalBody.innerHTML = `<p class="text-center text-red-500">資料庫讀取中，請稍後再試...</p>`; 
        return; 
    }

    try {
        const parsed = parseBibleReference(reference);
        if (parsed) {
            let query;
            if (parsed.endVerse && parsed.endVerse > parsed.verse) {
                 query = `SELECT ${dbCols.ver}, ${dbCols.text} FROM ${dbCols.tableName} WHERE ${dbCols.book} LIKE '%${parsed.book}%' AND ${dbCols.chap} = ${parsed.chapter} AND ${dbCols.ver} >= ${parsed.verse} AND ${dbCols.ver} <= ${parsed.endVerse} ORDER BY ${dbCols.ver}`;
            } else {
                 query = `SELECT ${dbCols.ver}, ${dbCols.text} FROM ${dbCols.tableName} WHERE ${dbCols.book} LIKE '%${parsed.book}%' AND ${dbCols.chap} = ${parsed.chapter} ORDER BY ${dbCols.ver}`;
            }

            const res = database.exec(query);
            if (res.length > 0) {
                let html = '';
                res[0].values.forEach(row => {
                    const v = row[0], t = row[1];
                    const highlightClass = (parsed.endVerse && v >= parsed.verse && v <= parsed.endVerse) || (v === highlightVerse) ? 'bg-yellow-100/80 p-1 rounded' : '';
                    html += `<p class="verse-text ${highlightClass}"><span class="verse-num">${v}</span>${t}</p>`;
                });
                modalTitle.innerText = `${parsed.book} 第 ${parsed.chapter} 章`;
                modalBody.innerHTML = html;
            } else {
                modalBody.innerHTML = `<p class="text-center">找不到經文資料</p>`;
            }
        } else {
            // 如果解析失敗，顯示純文字提示
            modalTitle.innerText = "經文引用";
            modalBody.innerHTML = `<p class="text-center text-lg mb-4">${reference}</p><p class="text-center text-gray-400 text-sm">請前往圖書館搜尋完整章節。</p>`;
        }
    } catch (e) {
        console.error(e);
        modalBody.innerHTML = `<p class="text-center text-red-500">讀取錯誤</p>`;
    }
}

function closeBibleModal(event) {
    if (event && event.target.closest('.modal-content') && event.target.id !== 'bible-modal') return;
    const modal = document.getElementById('bible-modal');
    if(modal) modal.classList.remove('show');
}