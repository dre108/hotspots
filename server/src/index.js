import express from "express";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok"});
});

app.get("/hello/:name", (req, res) => {
    const { name } = req.params;
    res.json({ message: `Welcome to Hotspots, ${name}!` });
});

app.listen(PORT, () => {
    console.log(`Hotspots API running at http://localhost:${PORT}`);
});
