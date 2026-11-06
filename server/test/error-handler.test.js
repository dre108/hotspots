import { afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { app } from "../src/app.js";
import { errorHandler } from "../src/middleware/error-handler.js";

// A tiny app used only by these tests, with routes that fail on purpose,
// so the 500 path can be tested without breaking a real route.
function makeTestApp() {
    const testApp = express();
    testApp.use(express.json({ limit: "1kb" }));
    testApp.get("/sync-crash", () => {
        throw new Error("secret internal detail");
    });
    testApp.get("/async-crash", async () => {
        throw new Error("secret internal detail");
    });
    testApp.post("/echo", (req, res) => res.json(req.body));
    testApp.use(errorHandler);
    return testApp;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("error handler on the real app", () => {
    it("answers malformed JSON with a 400 JSON error instead of an HTML page", async () => {
        const res = await request(app)
            .post("/spots")
            .set("Content-Type", "application/json")
            .send('{"name": "Test", ');

        expect(res.status).toBe(400);
        expect(res.headers["content-type"]).toMatch(/application\/json/);
        expect(res.body).toEqual({ error: "Request body must be valid JSON." });
    });
});

describe("error handler", () => {
    it.each(["/sync-crash", "/async-crash"])("turns a crash in %s into a 500 without leaking details", async (path) => {
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});

        const res = await request(makeTestApp()).get(path);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Something went wrong." });
        expect(JSON.stringify(res.body)).not.toContain("secret internal detail");
        // The details still reach the server log for debugging.
        expect(logged).toHaveBeenCalledOnce();
    });

    it("keeps Express's own client errors, like a body that's too large (413)", async () => {
        const res = await request(makeTestApp())
            .post("/echo")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ text: "x".repeat(2000) }));

        expect(res.status).toBe(413);
        expect(res.body.error).toBeTypeOf("string");
    });

    it("leaves normal requests alone", async () => {
        const res = await request(makeTestApp()).post("/echo").send({ ok: true });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
