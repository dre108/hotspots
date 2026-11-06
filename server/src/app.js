import express from "express";
import { authRouter } from "./auth/auth.routes.js";
import { spotsRouter } from "./spots/spots.routes.js";
import { reviewsRouter } from "./reviews/reviews.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(express.json());

app.use("/auth", authRouter);
app.use("/spots", spotsRouter);
app.use("/spots/:spotId/reviews", reviewsRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok"});
});

app.get("/hello/:name", (req, res) => {
    const { name } = req.params;
    res.json({ message: `Welcome to Hotspots, ${name}!` });
});

// Must stay last: Express only sends errors to handlers registered after the routes.
app.use(errorHandler);

