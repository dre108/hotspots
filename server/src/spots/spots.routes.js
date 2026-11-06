import { Router } from "express";
import { prisma } from "../db.js";

export const spotsRouter = Router();

// What a spot looks like in every response. The creator is limited to id and
// username so an email or password hash can never leak through this route.
const SPOT_FIELDS = {
    id: true,
    name: true,
    category: true,
    address: true,
    latitude: true,
    longitude: true,
    googlePlaceId: true,
    createdAt: true,
    createdBy: { select: { id: true, username: true } },
};

// Postgres INTEGER tops out at 2,147,483,647. Anything bigger would make
// Prisma throw, so it's rejected here as a bad id instead.
const MAX_ID = 2147483647;

function parseId(value) {
    if (!/^\d+$/.test(value)) return null;
    const id = Number(value);
    if (id < 1 || id > MAX_ID) return null;
    return id;
}

spotsRouter.get("/", async (req, res) => {
    const spots = await prisma.spot.findMany({
        select: SPOT_FIELDS,
        // Newest first; id breaks ties when two spots share a timestamp.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    res.json(spots);
});

spotsRouter.get("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
        return res.status(400).json({ error: "Spot id must be a positive whole number." });
    }

    const spot = await prisma.spot.findUnique({ where: { id }, select: SPOT_FIELDS });
    if (!spot) {
        return res.status(404).json({ error: "Spot not found." });
    }

    res.json(spot);
});
