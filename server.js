const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();

// 中间件配置
app.use(express.json({ limit: '20mb' })); 
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(__dirname));       

let db;

// 1. 初始化数据库及建表逻辑
async function initDatabase() {
    db = await open({
        filename: path.join(__dirname, 'database.db'),
        driver: sqlite3.Database
    });

    // 创建号码库存表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS phone_repository (
            phone_number TEXT PRIMARY KEY,
            upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 创建查询历史日志表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS query_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL,
            querier_name TEXT NOT NULL,
            is_in_repo TEXT NOT NULL,
            query_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('Database & Tables initialized successfully.');
}

// 2. 接口：批量上传号码到库存
app.post('/api/upload', async (req, res) => {
    const { phones } = req.body;
    
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
        return res.status(400).json({ success: false, message: '无效的号码列表' });
    }

    try {
        await db.exec('BEGIN TRANSACTION');
        const stmt = await db.prepare('INSERT OR IGNORE INTO phone_repository (phone_number) VALUES (?)');
        
        for (const phone of phones) {
            const trimmed = phone.trim();
            if (trimmed) {
                await stmt.run(trimmed);
            }
        }
        
        await stmt.finalize();
        await db.exec('COMMIT'); 
        
        res.json({ success: true, message: `成功导入 ${phones.length} 个号码` });
    } catch (error) {
        await db.exec('ROLLBACK'); 
        res.status(500).json({ success: false, message: '数据库写入失败', error: error.message });
    }
});

// 3. 接口：查询单个号码，并记录日志
app.get('/api/check', async (req, res) => {
    const { phone, querier } = req.query;
    
    if (!phone || !querier) {
        return res.status(400).json({ success: false, message: '号码和查询人不能为空' });
    }

    const trimmedPhone = phone.trim();
    const trimmedQuerier = querier.trim();

    try {
        // 步骤 A: 判断号码是否在库存库中
        const inRepoRow = await db.get('SELECT 1 FROM phone_repository WHERE phone_number = ? LIMIT 1', [trimmedPhone]);
        const inRepository = !!inRepoRow;
        const statusText = inRepository ? '在库' : '不在库';

        // 步骤 B: 统计该号码的历史被查次数
        const countRow = await db.get('SELECT COUNT(*) as total FROM query_logs WHERE phone_number = ?', [trimmedPhone]);
        const historyCount = countRow ? countRow.total : 0;
        const isFirstQuery = historyCount === 0;

        // 【核心条件】：只有在库（重复）的号码，才写入动态日志供全网看见
        if (inRepository) {
            await db.run(
                'INSERT INTO query_logs (phone_number, querier_name, is_in_repo) VALUES (?, ?, ?)', 
                [trimmedPhone, trimmedQuerier, statusText]
            );
        }

        // 返回给前端结果
        res.json({
            success: true,
            phone: trimmedPhone,
            inRepository: inRepository,
            isFirstQuery: isFirstQuery,
            historyCount: historyCount,
            message: '查询成功'
        });

    } catch (error) {
        res.status(500).json({ success: false, message: '服务器处理出错', error: error.message });
    }
});

// 4. 接口：获取最近 50 条【重复号码】的公开查询动态，并附带合并的历史查询人
app.get('/api/recent-logs', async (req, res) => {
    try {
        // 使用 GROUP_CONCAT 聚合函数，自动把该号码历史上所有查询过的人合并成一个字符串（按时间先后排序）
        const logs = await db.all(`
            SELECT 
                main.phone_number, 
                main.querier_name, 
                main.is_in_repo, 
                datetime(main.query_time, 'localtime') as q_time,
                (
                    SELECT GROUP_CONCAT(querier_name, '、') 
                    FROM (
                        SELECT querier_name 
                        FROM query_logs 
                        WHERE phone_number = main.phone_number AND id < main.id
                        ORDER BY id ASC
                    )
                ) as history_queriers
            FROM query_logs as main
            WHERE main.is_in_repo = '在库'
            ORDER BY main.id DESC 
            LIMIT 50
        `);
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 启动服务器
const PORT = 3000;
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});
