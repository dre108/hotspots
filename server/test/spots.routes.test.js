import { afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

// These tests write to the dev database, so every row they create uses
// this email domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@spots-routes.test";

async function cleanUp() {
    await prisma.spot.deleteMany({ where: { createdBy: { email: { endsWith: TEST_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
}

async function makeUser() {
    return prisma.user.create({
        data: { email: `owner${TEST_DOMAIN}`, username: "spots_routes_test", passwordHash: "not-a-real-hash" },
    });
}

beforeEach(cleanUp);

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

describe("GET /spots", () => {
    it("lists spots newest first, with only the creator's id and username", async () => {
        const user = await makeUser();
        const older = await prisma.spot.create({
            data: { name: "Older Spot", category: "Park", address: "1 Test St", createdById: user.id, createdAt: new Date("2026-01-01") },
        });
        const newer = await prisma.spot.create({
            data: { name: "Newer Spot", category: "Bar", address: "2 Test St", createdById: user.id, createdAt: new Date("2026-02-01") },
        });

        const res = await request(app).get("/spots");

        expect(res.status).toBe(200);
        // Other test files may add spots at the same time, so look only at ours.
        const ours = res.body.filter((s) => s.createdBy.id === user.id);
        expect(ours.map((s) => s.id)).toEqual([newer.id, older.id]);
        expect(ours[0].createdBy).toEqual({ id: user.id, username: "spots_routes_test" });
    });
});

describe("GET /spots/:id", () => {
    it("returns one spot without the creator's email or password hash", async () => {
        const user = await makeUser();
        const spot = await prisma.spot.create({
            data: { name: "Test Tacos", category: "Restaurant", address: "3 Test St", createdById: user.id },
        });

        const res = await request(app).get(`/spots/${spot.id}`);

        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Test Tacos");
        expect(res.body.category).toBe("Restaurant");
        expect(res.body.createdBy).toEqual({ id: user.id, username: "spots_routes_test" });
        expect(JSON.stringify(res.body)).not.toContain("passwordHash");
        expect(JSON.stringify(res.body)).not.toContain(TEST_DOMAIN);
    });

    it("returns 404 for an id that doesn't exist", async () => {
        const res = await request(app).get("/spots/2147483647");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Spot not found." });
    });

    it.each(["abc", "0", "-5", "1.5", "2147483648"])("returns 400 for the bad id %s", async (badId) => {
        const res = await request(app).get(`/spots/${badId}`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Spot id must be a positive whole number." });
    });
});
