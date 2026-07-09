const apiUrl = process.env.API_URL ?? "http://localhost:3333";
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
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

if (!login.response.ok || !login.cookie) {
  throw new Error("Login smoke failed");
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
  headers: { "Content-Type": "application/json" },
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
  headers: { cookie: login.cookie },
});

if (!logout.response.ok) {
  throw new Error("logout smoke failed");
}

console.log("Auth smoke OK");
