import express, {Express, Request, Response} from 'express';
import path from 'path';

const app: Express = express();
app.set("port", process.env.PORT || 3000);

app.get('/', (req: Request, res: Response) => {
    res.statusCode = 200;
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.listen(app.get("port"), () => {
    console.log(`Server is running at http://localhost:${app.get("port")}`);
});
