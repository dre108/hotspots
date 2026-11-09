import { afterEach, describe, it, expect, vi } from "vitest";
import { SignJWT, UnsecuredJWT, decodeJwt } from "jose";
import { createToken, verifyToken } from "../src/auth/tokens.js";

const USER = { id: 42, username: "token_test" };
const realKey = () => new TextEncoder().encode(process.env.JWT_SECRET);

describe("createToken / verifyToken", () => {
    it("round-trips: the token names the user and lasts one hour", async () => {
        const token = await createToken(USER);
        const payload = await verifyToken(token);

        expect(payload.sub).toBe("42");
        expect(payload.username).toBe("token_test");
        expect(payload.exp - payload.iat).toBe(60 * 60);
    });

    it("rejects an expired token", async () => {
        const token = await new SignJWT({ username: USER.username })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject("42")
            .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
            .sign(realKey());

        await expect(verifyToken(token)).rejects.toMatchObject({ code: "ERR_JWT_EXPIRED" });
    });

    it("rejects a token signed with a different secret", async () => {
        const otherKey = new TextEncoder().encode("a-completely-different-secret-that-is-long-enough");
        const token = await new SignJWT({ username: USER.username })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject("42")
            .setExpirationTime("1h")
            .sign(otherKey);

        await expect(verifyToken(token)).rejects.toMatchObject({ code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" });
    });

    it("rejects an edited token (the payload no longer matches the signature)", async () => {
        // A token is header.payload.signature; swap in a payload claiming to be user 1.
        const token = await createToken(USER);
        const [header, , signature] = token.split(".");
        const forged = Buffer.from(JSON.stringify({ ...decodeJwt(token), sub: "1" })).toString("base64url");

        await expect(verifyToken(`${header}.${forged}.${signature}`)).rejects.toMatchObject({
            code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
        });
    });

    it("rejects a token using another algorithm, even with the right secret", async () => {
        const token = await new SignJWT({ username: USER.username })
            .setProtectedHeader({ alg: "HS512" })
            .setSubject("42")
            .setExpirationTime("1h")
            .sign(realKey());

        await expect(verifyToken(token)).rejects.toMatchObject({ code: "ERR_JOSE_ALG_NOT_ALLOWED" });
    });

    it('rejects an unsigned "alg: none" token', async () => {
        const token = new UnsecuredJWT({ username: USER.username }).setSubject("42").setExpirationTime("1h").encode();

        await expect(verifyToken(token)).rejects.toThrow();
    });
});

describe("JWT_SECRET check at startup", () => {
    const saved = process.env.JWT_SECRET;

    afterEach(() => {
        process.env.JWT_SECRET = saved;
        vi.resetModules();
    });

    it.each([
        ["missing", undefined],
        ["too short", "only-31-characters-long-secret!"],
    ])("refuses to load when the secret is %s", async (_, value) => {
        if (value === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = value;
        vi.resetModules();

        await expect(import("../src/auth/tokens.js")).rejects.toThrow(/JWT_SECRET must be set/);
    });
});
