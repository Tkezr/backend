import jwt from "jsonwebtoken";

const JWT_SECRET = "supersecret";

export const handler = async (event) => {
  try {
    const path = event.rawPath || event.path || "/";
    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : (event.body || {});
    const username = body.username || "demo";
    const password = body.password || "demo";

    if (path.endsWith("/auth/login")) {
      const token = jwt.sign(
        { name: username, role: "user" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          access: "granted",
          user: { username, password }
        }),
      };
    }

    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid auth route" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
