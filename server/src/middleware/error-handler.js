// Express treats any middleware with four arguments (err, req, res, next) as an
// error handler. It runs when a route throws (Express 5 also catches rejected
// async handlers) or calls next(err). Register it last, after every route.
export function errorHandler(err, req, res, next) {
    // If part of the response was already sent, Express's built-in handler has
    // to finish the job (it closes the connection cleanly).
    if (res.headersSent) {
        return next(err);
    }

    // express.json() couldn't parse the request body.
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Request body must be valid JSON." });
    }

    // Other client errors Express already labels as safe to show
    // (for example a body that's too large: 413).
    if (err.expose && err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ error: err.message });
    }

    // Anything else is a bug or an outage. Log the details on the server, but
    // never send them to the client: stack traces reveal how the code works.
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
}
