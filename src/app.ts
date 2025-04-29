import express, {Express, Request, Response} from 'express';

const app: Express = express();
app.set("port", process.env.PORT || 3000);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, TypeScript Express Server!');
});

app.listen(app.get("port"), () => {
    console.log(`Server is running at http://localhost:${app.get("port")}`);
});
