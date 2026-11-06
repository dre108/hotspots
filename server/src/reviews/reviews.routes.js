import { Router } from "express";
import { prisma } from "../db.js";
import { parseId } from "../ids.js";

// Mounted at /spots/:spotId/reviews. mergeParams lets these routes read
// :spotId, which lives in the mount path, not in the route path.
export const reviewsRouter = Router({ mergeParams: true });

// What a review looks like in every response. The reviewer is limited to id
// and username so an email or password hash can never leak through this route.
const REVIEW_FIELDS = {
    id: true,
    rating: true,
    comment: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { id: true, username: true } },
};

reviewsRouter.get("/", async (req, res) => {
    const spotId = parseId(req.params.spotId);
    if (spotId === null) {
        return res.status(400).json({ error: "Spot id must be a positive whole number." });
    }

    // A missing spot (404) is different from a spot with no reviews yet (200 + []).
    const spot = await prisma.spot.findUnique({ where: { id: spotId }, select: { id: true } });
    if (!spot) {
        return res.status(404).json({ error: "Spot not found." });
    }

    const reviews = await prisma.review.findMany({
        where: { spotId },
        select: REVIEW_FIELDS,
        // Newest first; id breaks ties when two reviews share a timestamp.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    res.json(reviews);
});
