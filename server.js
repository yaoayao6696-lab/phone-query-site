const express = require('express');
const cors = require('cors');
const fs = require('fs');

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

    const username = req.body.username;
    const phone = req.body.phone;

    if (!username || !phone) {
        return res.json({
            message: '请输入姓名和手机号',
            users: []
        });
    }

    let db = readDB();

    let existing = db.find(item => item.phone === phone);

    // 已存在
    if (existing) {

        existing.count += 1;

        if (!existing.users.includes(username)) {
            existing.users.push(username);
        }

        writeDB(db);

        return res.json({
            message: `该号码已被查询 ${existing.count} 次`,
            users: existing.users
        });
    }

    // 新号码
    const newData = {
        phone,
        count: 1,
        users: [username]
    };

    db.push(newData);

    writeDB(db);

    res.json({
        message: '该号码首次被查询',
        users: [username]
    });

});

// 查看全部号码
app.get('/all', (req, res) => {

    const db = readDB();

    res.json(db);

});

// 首页
app.get('/', (req, res) => {

    res.sendFile(__dirname + '/index.html');

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log('服务器启动成功');

});
