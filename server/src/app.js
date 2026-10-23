import express from "express";

export const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok"});
});

app.get("/hello/:name", (req, res) => {
    const { name } = req.params;
    res.json({ message: `Welcome to Hotspots, ${name}!` });
});

