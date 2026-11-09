import { SignJWT, jwtVerify } from "jose";

// HS256 needs a key at least as long as its 256-bit hash (RFC 7518, section 3.2).
const MIN_SECRET_BYTES = 32;
const ALGORITHM = "HS256";
const TOKEN_LIFETIME = "1h";

// Checked once, when the server starts: a missing or weak secret should stop
// the server with a clear message, not fail later on someone's login.
const secret = process.env.JWT_SECRET;
if (!secret || Buffer.byteLength(secret) < MIN_SECRET_BYTES) {
    throw new Error(`JWT_SECRET must be set to at least ${MIN_SECRET_BYTES} characters (see .env.example).`);
}
const key = new TextEncoder().encode(secret);

export async function createToken(user) {
    return new SignJWT({ username: user.username })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(String(user.id)) // "sub" (subject) = who the token is about
        .setIssuedAt()
        .setExpirationTime(TOKEN_LIFETIME)
        .sign(key);
}

// Returns the token's payload, or throws if it's expired, tampered with,
// or signed some other way. Only HS256 is accepted, so a token that claims
// "alg: none" (no signature) is rejected (RFC 8725, section 3.1).
export async function verifyToken(token) {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    return payload;
}
