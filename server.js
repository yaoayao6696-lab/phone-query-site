const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = 'database.json';

// 初始化数据库
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// 读取数据库
function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

// 写入数据库
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 查询接口
app.post('/query', (req, res) => {

    const phone = req.body.phone;

    let db = readDB();

    let existing = db.find(item => item.phone === phone);

    // 已存在
    if (existing) {

        existing.count += 1;

        writeDB(db);

        return res.json({
            message: `该号码已被查询 ${existing.count} 次`
        });
    }

    // 不存在
    const newData = {
        phone: phone,
        count: 1
    };

    db.push(newData);

    writeDB(db);

    res.json({
        message: '该号码首次被查询'
    });
});

// 查看全部数据
app.get('/all', (req, res) => {

    const db = readDB();

    res.json(db);
});

app.listen(3000, () => {
    console.log('服务器启动成功');
    console.log('http://localhost:3000');
});
