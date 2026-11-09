import { errors } from "jose";
import { verifyToken } from "../auth/tokens.js";

// "Bearer", any letter case (RFC 9110 section 11.1: the scheme is case-insensitive),
// then one or more spaces and the token (RFC 6750 section 2.1).
const BEARER_PATTERN = /^Bearer +(\S+)$/i;

function signInRequired(res) {
    // RFC 6750 section 3: a 401 for a missing or bad token MUST say which scheme to use.
    res.set("WWW-Authenticate", "Bearer");
    return res.status(401).json({ error: "Sign in required." });
}

// Put this in front of any route that needs a signed-in user. On success the
// route can read req.user ({ id, username }); otherwise the request stops here.
export async function requireAuth(req, res, next) {
    const match = BEARER_PATTERN.exec(req.get("Authorization")?.trim() ?? "");
    if (!match) {
        return signInRequired(res);
    }

    let payload;
    try {
        payload = await verifyToken(match[1]);
    } catch (err) {
        // Expired, edited, wrong key, wrong algorithm, garbled: all the same 401.
        if (err instanceof errors.JOSEError) {
            return signInRequired(res);
        }
        // Anything else is a bug, not a bad token: let the error handler log it as a 500.
        throw err;
    }

    req.user = { id: Number(payload.sub), username: payload.username };
    next();
}
