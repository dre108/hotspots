import { Router } from "express";
import { hash } from "@node-rs/argon2";
import { prisma } from "../db.js";
import { validateSignup } from "./auth.validation.js";

export const authRouter = Router();

// Never select passwordHash: the response must not contain it.
const USER_FIELDS = { id: true, email: true, username: true, createdAt: true };

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
