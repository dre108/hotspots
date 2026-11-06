import express from "express";
import { spotsRouter } from "./spots/spots.routes.js";

export const app = express();

app.use(express.json());

app.use("/spots", spotsRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok"});
});

app.get("/hello/:name", (req, res) => {
    const { name } = req.params;
    res.json({ message: `Welcome to Hotspots, ${name}!` });
});

