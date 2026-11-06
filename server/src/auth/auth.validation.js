// Signup rules (decided 2026-10-23; password rules follow NIST SP 800-63B-4).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 15;
const PASSWORD_MAX = 128;

export function validateSignup(body) {
    const errors = {};
    // Express 5 leaves req.body undefined when no body is sent.
    const { email, username, password } = body ?? {};

    let cleanEmail;
    if (typeof email !== "string" || email.trim() === "") {
        errors.email = "Email is required.";
    } else {
        cleanEmail = email.trim().toLowerCase();
        if (cleanEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(cleanEmail)) {
            errors.email = "Enter a valid email address.";
        }
    }

    // Lowercased because Postgres's unique rule is case-sensitive:
    // "Dre" and "dre" would otherwise be two different accounts.
    let cleanUsername;
    if (typeof username !== "string" || username.trim() === "") {
        errors.username = "Username is required.";
    } else {
        cleanUsername = username.trim().toLowerCase();
        if (!USERNAME_PATTERN.test(cleanUsername)) {
            errors.username = "Username must be 3-20 characters: letters, numbers, or underscores.";
        }
    }

    // Not trimmed: spaces are allowed in passwords and must be kept exactly.
    // Length counts characters as people see them ([...password] splits by
    // Unicode code point), so an emoji counts once, not twice like .length.
    if (typeof password !== "string" || password === "") {
        errors.password = "Password is required.";
    } else {
        const length = [...password].length;
        if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
            errors.password = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
        }
    }

    return { errors, data: { email: cleanEmail, username: cleanUsername, password } };
}
