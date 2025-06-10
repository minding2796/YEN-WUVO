import express, {Express, Request, Response} from 'express';
import path from 'path';
import {setInterval} from "node:timers";
import {randomUUID} from "node:crypto";

const app: Express = express();

const stonk = {
    value: 100000
};

const ranking = new Map();

app.set("port", process.env.PORT || 3000);
app.use(express.json());

app.get('/uuid', (req: Request, res: Response) => {
    res.statusCode = 200;
    res.send(randomUUID());
});

app.get('/stonk', (req: Request, res: Response) => {
    res.statusCode = 200;
    res.send(JSON.stringify(stonk));
});

app.get('/ranking', (req: Request, res: Response) => {
    res.statusCode = 200;
    const list = [];
    for (const item of ranking.values()) list.push(item);
    res.send(JSON.stringify(list));
});

app.post('/submit', (req: Request, res: Response) => {
    res.statusCode = 200;
    const data = req.body;
    ranking.set(data.uuid, data);
    res.send('success');
});

app.get('/', (req: Request, res: Response) => {
    res.statusCode = 200;
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.listen(app.get("port"), () => {
    console.log(`Server is running at http://localhost:${app.get("port")}`);
});

setInterval(() => {
    stonk.value += (Math.random() - 0.5) * 1000;
    stonk.value = Math.round(Math.max(stonk.value, 0));
});