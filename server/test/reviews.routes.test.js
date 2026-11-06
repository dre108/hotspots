import { afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

// These tests write to the dev database, so every row they create uses
// this email domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@reviews-routes.test";

async function cleanUp() {
    const ours = { email: { endsWith: TEST_DOMAIN } };
    await prisma.review.deleteMany({ where: { user: ours } });
    await prisma.spot.deleteMany({ where: { createdBy: ours } });
    await prisma.user.deleteMany({ where: ours });
}

async function makeUser(name) {
    return prisma.user.create({
        data: { email: `${name}${TEST_DOMAIN}`, username: `${name}_reviews_test`, passwordHash: "not-a-real-hash" },
    });
}

async function makeSpot(owner) {
    return prisma.spot.create({
        data: { name: "Test Grill", category: "Restaurant", address: "20 Test St", createdById: owner.id },
    });
}

beforeEach(cleanUp);

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

describe("GET /spots/:spotId/reviews", () => {
    it("lists a spot's reviews newest first, with only the reviewer's id and username", async () => {
        const owner = await makeUser("owner");
        const amy = await makeUser("amy");
        const ben = await makeUser("ben");
        const spot = await makeSpot(owner);
        const older = await prisma.review.create({
            data: { rating: 4, comment: "Solid", userId: amy.id, spotId: spot.id, createdAt: new Date("2026-03-01") },
        });
        const newer = await prisma.review.create({
            data: { rating: 5, userId: ben.id, spotId: spot.id, createdAt: new Date("2026-04-01") },
        });

        const res = await request(app).get(`/spots/${spot.id}/reviews`);

        expect(res.status).toBe(200);
        expect(res.body.map((r) => r.id)).toEqual([newer.id, older.id]);
        expect(res.body[1]).toMatchObject({ rating: 4, comment: "Solid", user: { id: amy.id, username: "amy_reviews_test" } });
        expect(res.body[0].comment).toBeNull();
        expect(JSON.stringify(res.body)).not.toContain("passwordHash");
        expect(JSON.stringify(res.body)).not.toContain(TEST_DOMAIN);
    });

    it("only returns reviews for the spot that was asked for", async () => {
        const owner = await makeUser("owner");
        const first = await makeSpot(owner);
        const second = await makeSpot(owner);
        await prisma.review.create({ data: { rating: 3, userId: owner.id, spotId: second.id } });

        const res = await request(app).get(`/spots/${first.id}/reviews`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it("returns an empty list for a spot with no reviews yet", async () => {
        const owner = await makeUser("owner");
        const spot = await makeSpot(owner);

        const res = await request(app).get(`/spots/${spot.id}/reviews`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it("returns 404 when the spot doesn't exist", async () => {
        const res = await request(app).get("/spots/2147483647/reviews");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Spot not found." });
    });

    it.each(["abc", "0", "1.5", "2147483648"])("returns 400 for the bad spot id %s", async (badId) => {
        const res = await request(app).get(`/spots/${badId}/reviews`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Spot id must be a positive whole number." });
    });
});
