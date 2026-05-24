const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = 'database.json';

if(!fs.existsSync(DB_FILE)){

    fs.writeFileSync(DB_FILE,JSON.stringify([]));

}

function readDB(){

    return JSON.parse(fs.readFileSync(DB_FILE));

}

function writeDB(data){

    fs.writeFileSync(DB_FILE,JSON.stringify(data,null,2));

}

app.post('/query',(req,res)=>{

    const username = req.body.username;
    const phone = req.body.phone;

    let db = readDB();

    let existing = db.find(item=>item.phone === phone);

    if(existing){

        existing.count += 1;

        if(!existing.users.includes(username)){

            existing.users.push(username);

        }

        writeDB(db);

        return res.json({

            message:`该号码已被查询 ${existing.count} 次`,
            users:existing.users

        });

    }

    const newData = {

        phone:phone,
        count:1,
        users:[username]

    };

    db.push(newData);

    writeDB(db);

    res.json({

        message:'该号码首次被查询',
        users:[username]

    });

});

// 查看所有号码
app.get('/all',(req,res)=>{

    const db = readDB();

    res.json(db);

});

app.listen(process.env.PORT || 3000,()=>{

    console.log('服务器启动成功');

});
