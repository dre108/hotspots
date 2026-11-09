import { randomBytes } from "node:crypto";
import { Router } from "express";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "../db.js";
import { validateLogin, validateSignup } from "./auth.validation.js";
import { createToken } from "./tokens.js";

export const authRouter = Router();

// Never select passwordHash: the response must not contain it.
const USER_FIELDS = { id: true, email: true, username: true, createdAt: true };

// One message for "no such email" and "wrong password", so login can't be
// used to find out which accounts exist.
const LOGIN_FAILED = { error: "Wrong email or password." };

// A real Argon2id hash of a random password nobody knows, made once at startup.
// When the email doesn't exist, login still checks the password against this,
// so that answer takes as long as a wrong password does.
const DUMMY_HASH = await hash(randomBytes(32).toString("hex"));

authRouter.post("/signup", async (req, res) => {
    const { errors, data } = validateSignup(req.body);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    // Argon2id with the library defaults (19 MiB memory, 2 passes: OWASP's
    // minimum). The salt is random and stored inside the hash string itself.
    const passwordHash = await hash(data.password);

    try {
        const user = await prisma.user.create({
            data: { email: data.email, username: data.username, passwordHash },
            select: USER_FIELDS,
        });
        return res.status(201).json(user);
    } catch (err) {
        // P2002 = a unique rule failed (email or username already taken). The
        // database decides, so two signups at the same instant can't both win.
        // One generic message, so the reply doesn't reveal which accounts exist.
        if (err.code === "P2002") {
            return res.status(409).json({ error: "Email or username is already taken." });
        }
        throw err; // anything else goes to the shared error handler (500)
    }
});

authRouter.post("/login", async (req, res) => {
    const { errors, data } = validateLogin(req.body);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    // The hash is needed here to check the password; it's removed before replying.
    const found = await prisma.user.findUnique({
        where: { email: data.email },
        select: { ...USER_FIELDS, passwordHash: true },
    });

    // Always run verify(), even when the email doesn't exist (see DUMMY_HASH).
    const passwordMatches = await verify(found?.passwordHash ?? DUMMY_HASH, data.password);
    if (!found || !passwordMatches) {
        return res.status(401).json(LOGIN_FAILED);
    }

    const { passwordHash, ...user } = found;
    const token = await createToken(user);
    return res.json({ token, user });
});
