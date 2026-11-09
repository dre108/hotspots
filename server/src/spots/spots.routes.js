import { Router } from "express";
import { prisma } from "../db.js";
import { parseId } from "../ids.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validateSpot } from "./spots.validation.js";

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

spotsRouter.get("/", async (req, res) => {
    const spots = await prisma.spot.findMany({
        select: SPOT_FIELDS,
        // Newest first; id breaks ties when two spots share a timestamp.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    res.json(spots);
});

// Signed-in users only: requireAuth answers 401 before this code runs.
spotsRouter.post("/", requireAuth, async (req, res) => {
    const { errors, data } = validateSpot(req.body);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    const spot = await prisma.spot.create({
        // The creator comes from the verified token, never from the request body.
        data: { ...data, createdById: req.user.id },
        select: SPOT_FIELDS,
    });

    // RFC 9110 section 15.3.2: a 201 names the new resource in the Location header.
    res.status(201).location(`/spots/${spot.id}`).json(spot);
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
