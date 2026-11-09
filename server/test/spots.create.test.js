import { afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { createToken } from "../src/auth/tokens.js";

// These tests write to the dev database, so every row they create uses
// this email domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@spots-create.test";
const NEW_SPOT = { name: "Joe's Pizza", category: "Restaurant", address: "1 Main St, Chicago" };

let user;
let otherUser;
let token;

async function cleanUp() {
    await prisma.spot.deleteMany({ where: { createdBy: { email: { endsWith: TEST_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
}

beforeEach(async () => {
    await cleanUp();
    user = await prisma.user.create({
        data: { email: `maker${TEST_DOMAIN}`, username: "spot_maker", passwordHash: "not-a-real-hash" },
    });
    otherUser = await prisma.user.create({
        data: { email: `other${TEST_DOMAIN}`, username: "spot_other", passwordHash: "not-a-real-hash" },
    });
    token = await createToken(user);
});

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

function postSpot(body, authToken = token) {
    const req = request(app).post("/spots");
    return (authToken ? req.set("Authorization", `Bearer ${authToken}`) : req).send(body);
}

function countMySpots() {
    return prisma.spot.count({ where: { createdBy: { email: { endsWith: TEST_DOMAIN } } } });
}

describe("POST /spots", () => {
    it("creates the spot for the signed-in user and says where it lives", async () => {
        const res = await postSpot(NEW_SPOT);

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe(`/spots/${res.body.id}`);
        expect(res.body).toMatchObject({
            ...NEW_SPOT,
            latitude: null,
            longitude: null,
            googlePlaceId: null,
            createdBy: { id: user.id, username: "spot_maker" },
        });
        // Same shape as GET: the creator never includes an email or hash.
        expect(Object.keys(res.body.createdBy).sort()).toEqual(["id", "username"]);

        const saved = await prisma.spot.findUnique({ where: { id: res.body.id } });
        expect(saved.createdById).toBe(user.id);
    });

    it("saves trimmed values", async () => {
        const res = await postSpot({ name: "  Joe's Pizza ", category: "Restaurant", address: " 1 Main St, Chicago " });

        expect(res.status).toBe(201);
        const saved = await prisma.spot.findUnique({ where: { id: res.body.id } });
        expect(saved).toMatchObject(NEW_SPOT);
    });

    it("ignores a createdById in the body: the creator comes from the token", async () => {
        const res = await postSpot({ ...NEW_SPOT, createdById: otherUser.id });

        expect(res.status).toBe(201);
        expect(res.body.createdBy.id).toBe(user.id);
        const saved = await prisma.spot.findUnique({ where: { id: res.body.id } });
        expect(saved.createdById).toBe(user.id);
    });

    it("ignores coordinates and a Google place id sent by the user", async () => {
        const res = await postSpot({ ...NEW_SPOT, latitude: 41.88, longitude: -87.63, googlePlaceId: "ChIJ-made-up" });

        expect(res.status).toBe(201);
        const saved = await prisma.spot.findUnique({ where: { id: res.body.id } });
        expect(saved).toMatchObject({ latitude: null, longitude: null, googlePlaceId: null });
    });

    it("refuses a request without a token and saves nothing", async () => {
        const res = await postSpot(NEW_SPOT, null);

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Sign in required." });
        expect(await countMySpots()).toBe(0);
    });

    it("refuses a bad token and saves nothing", async () => {
        const res = await postSpot(NEW_SPOT, `${token}x`);

        expect(res.status).toBe(401);
        expect(await countMySpots()).toBe(0);
    });

    it("returns 400 naming every missing field, and saves nothing", async () => {
        const res = await postSpot({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            errors: {
                name: "Name is required.",
                category: "Category is required.",
                address: "Address is required.",
            },
        });
        expect(await countMySpots()).toBe(0);
    });

    it("returns 400 for an unknown category, and saves nothing", async () => {
        const res = await postSpot({ ...NEW_SPOT, category: "cafe" });

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.errors)).toEqual(["category"]);
        expect(await countMySpots()).toBe(0);
    });

    it("returns 400 when no body is sent at all", async () => {
        const res = await request(app).post("/spots").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.errors).sort()).toEqual(["address", "category", "name"]);
    });

    it("shows the new spot in GET /spots and GET /spots/:id", async () => {
        const created = (await postSpot(NEW_SPOT)).body;

        const list = await request(app).get("/spots");
        expect(list.body.map((spot) => spot.id)).toContain(created.id);

        const one = await request(app).get(`/spots/${created.id}`);
        expect(one.status).toBe(200);
        expect(one.body).toEqual(created);
    });
});
