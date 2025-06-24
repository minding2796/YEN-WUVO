// noinspection SqlNoDataSourceInspection

import express, {Express, Request, Response} from 'express';
import path from 'path';
import {setInterval} from "node:timers";
import {randomUUID} from "node:crypto";
import sqlite3 from 'sqlite3';
import {Database, open} from 'sqlite';
import fs from 'fs';

const app: Express = express();

const stonk = {
    value: 100000
};

let db: Database;

// Database initialization
(async () => {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, {recursive: true});
    }
    db = await open({
        filename: path.join(__dirname, '../data/users.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            uuid TEXT PRIMARY KEY NOT NULL,
            name TEXT default '익명',
            money INTEGER default 1000000,
            stocks INTEGER default 0,
            last_work_time INTEGER
        )
    `);
})();

// 노가다 작업 쿨다운 시간 (밀리초)
const WORK_COOLDOWN = 5000; // 5초

// 사용자 데이터 유효성 검사
// noinspection JSUnusedLocalSymbols
function validateUserData(data: any): boolean {
    // 필수 필드 확인
    if (!data || typeof data !== 'object') return false;
    if (!data.uuid || typeof data.uuid !== 'string') return false;
    return !(typeof data.m !== 'number' || typeof data.s !== 'number');
}

app.set("port", process.env.PORT || 3000);
app.use(express.json());

app.get('/uuid', (_req: Request, res: Response) => {
    res.statusCode = 200;
    res.send(randomUUID());
});

app.get('/stonk', (_req: Request, res: Response) => {
    res.statusCode = 200;
    res.send(JSON.stringify(stonk));
});

app.get('/ranking', async (_req: Request, res: Response) => {
    res.statusCode = 200;
    const users = await db.all('SELECT * FROM users');
    res.send(JSON.stringify(users));
});

// 사용자 데이터 조회 API
app.get('/user/:uuid', async (req: Request, res: Response): Promise<any> => {
    const {uuid} = req.params;
    const user = await db.get('SELECT * FROM users WHERE uuid = ?', uuid);

    if (!uuid || !user) {
        return res.status(404).json({success: false, message: '사용자를 찾을 수 없습니다.'});
    }

    return res.json({
        success: true,
        userData: {
            uuid: user.uuid,
            name: user.name,
            m: user.money,
            s: user.stocks
        }
    });
});

// 사용자 초기화 API
app.post('/initUser', async (req: Request, res: Response): Promise<any> => {
    const {uuid, name} = req.body;

    if (!uuid) {
        return res.status(400).json({success: false, message: 'UUID가 필요합니다.'});
    }

    // 이미 존재하는 사용자인지 확인
    const existingUser = await db.get('SELECT * FROM users WHERE uuid = ?', uuid);
    if (existingUser) {
        return res.json({
            success: true,
            message: '사용자가 이미 존재합니다.',
            userData: {
                uuid: existingUser.uuid,
                name: existingUser.name,
                m: existingUser.money,
                s: existingUser.stocks
            }
        });
    }

    // 신규 사용자 데이터 생성
    const userData = {
        uuid,
        name: name || '익명',
        m: 1000000, // 초기 자금
        s: 0        // 초기 주식 수
    };

    // 사용자 데이터 저장
    await db.run('INSERT INTO users (uuid, name, money, stocks) VALUES (?, ?, ?, ?)',
        userData.uuid, userData.name, userData.m, userData.s);

    return res.json({
        success: true,
        message: '사용자 초기화 완료',
        userData
    });
});

app.post('/buy', async (req: Request, res: Response): Promise<any> => {
    const {uuid} = req.body;

    const user = await db.get('SELECT * FROM users WHERE uuid = ?', uuid);
    if (!user) {
        return res.status(400).json({success: false, message: '사용자를 찾을 수 없습니다.'});
    }

    if (user.money >= stonk.value) {
        await db.run('UPDATE users SET money = ?, stocks = ? WHERE uuid = ?',
            user.money - stonk.value, user.stocks + 1, uuid);

        const userData = {
            uuid: user.uuid,
            name: user.name,
            m: user.money - stonk.value,
            s: user.stocks + 1
        };

        return res.json({
            success: true,
            message: `주식 1주를 ${stonk.value}원에 매수했습니다.`,
            userData
        });
    } else {
        return res.json({
            success: false,
            message: '자금이 부족합니다!',
            userData: {
                uuid: user.uuid,
                name: user.name,
                m: user.money,
                s: user.stocks
            }
        });
    }
});

app.post('/sell', async (req: Request, res: Response): Promise<any> => {
    const {uuid} = req.body;

    const user = await db.get('SELECT * FROM users WHERE uuid = ?', uuid);
    if (!user) {
        return res.status(400).json({success: false, message: '사용자를 찾을 수 없습니다.'});
    }

    if (user.stocks > 0) {
        await db.run('UPDATE users SET money = ?, stocks = ? WHERE uuid = ?',
            user.money + stonk.value, user.stocks - 1, uuid);

        const userData = {
            uuid: user.uuid,
            name: user.name,
            m: user.money + stonk.value,
            s: user.stocks - 1
        };

        return res.json({
            success: true,
            message: `주식 1주를 ${stonk.value}원에 매도했습니다.`,
            userData
        });
    } else {
        return res.json({
            success: false,
            message: '보유한 주식이 없습니다!',
            userData: {
                uuid: user.uuid,
                name: user.name,
                m: user.money,
                s: user.stocks
            }
        });
    }
});

app.post('/work', async (req: Request, res: Response): Promise<any> => {
    const {uuid} = req.body;

    const user = await db.get('SELECT * FROM users WHERE uuid = ?', uuid);
    if (!user) {
        return res.status(400).json({success: false, message: '사용자를 찾을 수 없습니다.'});
    }

    const currentTime = Date.now();
    const lastTime = user.last_work_time || 0;
    const timeSinceLastWork = currentTime - lastTime;

    // 남은 대기 시간 계산 (밀리초)
    const remainingTime = WORK_COOLDOWN - timeSinceLastWork;

    // 아직 대기 시간이 남아있으면
    if (remainingTime > 0) {
        const remainingSeconds = Math.ceil(remainingTime / 1000);
        return res.json({
            success: false,
            message: `${remainingSeconds}초 후에 다시 시도해주세요.`,
            userData: {
                uuid: user.uuid,
                name: user.name,
                m: user.money,
                s: user.stocks
            },
            cooldown: {
                remaining: remainingTime,
                total: WORK_COOLDOWN
            }
        });
    }

    // 대기 시간이 지났으면 작업 처리
    await db.run('UPDATE users SET money = ?, last_work_time = ? WHERE uuid = ?',
        user.money + 10000, currentTime, uuid);

    const userData = {
        uuid: user.uuid,
        name: user.name,
        m: user.money + 10000,
        s: user.stocks
    };

    return res.json({
        success: true,
        message: '10000원을 벌었습니다!',
        userData,
        cooldown: {
            remaining: WORK_COOLDOWN,
            total: WORK_COOLDOWN
        }
    });
});

app.post('/changeName', async (req: Request, res: Response): Promise<any> => {
    const {uuid, name} = req.body;

    const user = await db.get('SELECT * FROM users WHERE uuid = ?', uuid);
    if (!user) {
        return res.status(400).json({success: false, message: '사용자를 찾을 수 없습니다.'});
    }

    if (!name) {
        return res.status(400).json({success: false, message: '이름을 입력해주세요.'});
    }

    await db.run('UPDATE users SET name = ? WHERE uuid = ?', name, uuid);

    const userData = {
        uuid: user.uuid,
        name: name,
        m: user.money,
        s: user.stocks
    };

    return res.json({
        success: true,
        message: '이름이 변경되었습니다.',
        userData
    });
});

app.get('/', (_req: Request, res: Response) => {
    res.statusCode = 200;
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

// 관리자 콘솔 페이지 라우트
app.get('/admin-console', (_req: Request, res: Response) => {
    res.statusCode = 200;
    res.sendFile(path.join(__dirname, 'pages', 'admin-console.html'));
});

// 서버 사이드 JavaScript 실행 API
app.post('/execute-code', (req: Request, res: Response): any => {
    const { code, password } = req.body;

    // 관리자 비밀번호 검증
    if (password !== 'admin123') {
        return res.status(401).json({ success: false, message: '관리자 인증 실패' });
    }

    // 코드가 없는 경우
    if (!code) {
        return res.status(400).json({ success: false, message: '실행할 코드를 입력해주세요.' });
    }

    try {
        
        // 코드 실행
        const result = eval(code);

        // Promise 객체인 경우 처리
        if (result instanceof Promise) {
            result
                .then(value => {
                    res.json({success: true, result: value});
                })
                .catch(error => {
                    res.json({
                        success: false,
                        error: error.message,
                        stack: error.stack
                    });
                });
        } else {
            // Promise가 아닌 경우 바로 반환
            res.json({success: true, result});
        }
    } catch (error: any) {
        res.json({
            success: false, 
            error: error.message, 
            stack: error.stack 
        });
    }
});

app.listen(app.get("port"), () => {
    console.log(`Server is running at https://yen-wuvo.thinkinggms.com`);
    console.log(`the port is ${app.get("port")}`);
});

setInterval(() => {
    if (Math.floor(stonk.value *= (Math.random() - 0.5) * 0.015 + 1) <= 5000) delisting();
    stonk.value = Math.round(stonk.value);
});

function delisting() {
    stonk.value = 100000;
    db.run('UPDATE users SET money = money + stocks * 5000, stocks = 0').then(_ => {});
}
