const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const allowedOrigin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const email = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const password = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for auth smoke");
}

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return {
    response,
    body,
    cookie: response.headers.get("set-cookie"),
  };
}

await request("/auth/bootstrap/super-admin", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: allowedOrigin,
    "x-admin-setup-token": setupToken,
  },
  body: JSON.stringify({
    name: "Smoke Admin",
    email,
    password,
  }),
});

const login = await request("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: allowedOrigin },
  body: JSON.stringify({ email, password }),
});

if (!login.response.ok || !login.cookie) {
  throw new Error("Login smoke failed");
}
assertCookie(login.cookie, { secure: process.env.NODE_ENV === "production" });

const health = await request("/health", { headers: { Origin: allowedOrigin } });
if (
  !health.response.ok ||
  health.response.headers.get("x-content-type-options") !== "nosniff" ||
  health.response.headers.get("referrer-policy") !== "no-referrer"
) {
  throw new Error("Helmet headers smoke failed");
}

const preflight = await fetch(`${apiUrl}/auth/login`, {
  method: "OPTIONS",
  headers: {
    Origin: allowedOrigin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
  },
});
if (
  !preflight.ok ||
  preflight.headers.get("access-control-allow-origin") !== allowedOrigin ||
  preflight.headers.get("access-control-allow-credentials") !== "true"
) {
  throw new Error("CORS preflight smoke failed");
}

const blockedOrigin = await request("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://evil.test" },
  body: JSON.stringify({ email, password }),
});
if (blockedOrigin.response.status !== 403) {
  throw new Error("Origin check smoke failed");
}

const me = await request("/auth/me", {
  headers: { cookie: login.cookie },
});

if (!me.response.ok || me.body.user?.email !== email) {
  throw new Error("/auth/me smoke failed");
}

const adminCheck = await request("/auth/admin-check", {
  headers: { cookie: login.cookie },
});

if (!adminCheck.response.ok) {
  throw new Error("admin-check smoke failed");
}

await request("/auth/users", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: allowedOrigin,
    cookie: login.cookie,
  },
  body: JSON.stringify({
    name: "Smoke Secretaria",
    email: secretaryEmail,
    password: secretaryPassword,
    role: "SECRETARIA",
  }),
});

const secretaryLogin = await request("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: allowedOrigin },
  body: JSON.stringify({
    email: secretaryEmail,
    password: secretaryPassword,
  }),
});

if (!secretaryLogin.response.ok || !secretaryLogin.cookie) {
  throw new Error("Secretaria login smoke failed");
}

const operationalCheck = await request("/auth/operational-check", {
  headers: { cookie: secretaryLogin.cookie },
});

if (!operationalCheck.response.ok) {
  throw new Error("operational-check smoke failed");
}

const blockedAdminCheck = await request("/auth/admin-check", {
  headers: { cookie: secretaryLogin.cookie },
});

if (blockedAdminCheck.response.status !== 403) {
  throw new Error("Secretaria restricted access smoke failed");
}

const logout = await request("/auth/logout", {
  method: "POST",
  headers: { cookie: login.cookie, Origin: allowedOrigin },
});

if (!logout.response.ok) {
  throw new Error("logout smoke failed");
}
if (
  !logout.cookie?.includes("Max-Age=0") &&
  !logout.cookie?.includes("Expires=Thu, 01 Jan 1970")
) {
  throw new Error("Logout did not clear auth cookie");
}

console.log("Auth smoke OK");

function assertCookie(cookie, input) {
  if (!cookie.includes("HttpOnly")) {
    throw new Error("Auth cookie is not HttpOnly");
  }
  if (!cookie.includes("SameSite=Lax")) {
    throw new Error("Auth cookie SameSite is not Lax");
  }
  if (!cookie.includes("Path=/")) {
    throw new Error("Auth cookie path is not root");
  }
  if (!cookie.includes("Max-Age=")) {
    throw new Error("Auth cookie has no Max-Age");
  }
  if (input.secure && !cookie.includes("Secure")) {
    throw new Error("Production auth cookie is not Secure");
  }
  if (!input.secure && cookie.includes("Secure")) {
    throw new Error("Local auth cookie should not be Secure");
  }
}
