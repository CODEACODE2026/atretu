const apiUrl = process.env.API_URL ?? "http://localhost:3333";
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@atretu.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "SenhaForte123";
const secretaryEmail =
  process.env.SMOKE_SECRETARIA_EMAIL ?? "secretaria@atretu.local";
const secretaryPassword = process.env.SMOKE_SECRETARIA_PASSWORD ?? "SenhaForte123";
const runId = `smoke-${Date.now()}`;

if (!setupToken) {
  throw new Error("ADMIN_SETUP_TOKEN is required for Sprint 2 smoke");
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

function json(cookie, body) {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { cookie } : {}),
  };
}

async function ensureUsers() {
  await request("/auth/bootstrap/super-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-setup-token": setupToken,
    },
    body: JSON.stringify({
      name: "Smoke Admin",
      email: adminEmail,
      password: adminPassword,
    }),
  });

  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (!login.response.ok || !login.cookie) {
    throw new Error("Admin login failed");
  }

  await request("/auth/users", {
    method: "POST",
    headers: json(login.cookie),
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
    throw new Error("Secretaria login failed");
  }

  return { adminCookie: login.cookie, secretaryCookie: secretaryLogin.cookie };
}

async function exerciseBaseRecord({
  cookie,
  path,
  name,
  body,
  updateBody,
  duplicateBody,
}) {
  const created = await request(path, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(body),
  });

  if (!created.response.ok) {
    throw new Error(`${name} create failed: ${created.body.message}`);
  }

  const duplicate = await request(path, {
    method: "POST",
    headers: json(cookie),
    body: JSON.stringify(duplicateBody ?? body),
  });

  if (duplicate.response.status !== 409) {
    throw new Error(`${name} duplicate validation failed`);
  }

  const detail = await request(`${path}/${created.body.id}`, {
    headers: json(cookie),
  });

  if (!detail.response.ok || detail.body.id !== created.body.id) {
    throw new Error(`${name} detail failed`);
  }

  const updated = await request(`${path}/${created.body.id}`, {
    method: "PATCH",
    headers: json(cookie),
    body: JSON.stringify(updateBody),
  });

  if (!updated.response.ok) {
    throw new Error(`${name} update failed: ${updated.body.message}`);
  }

  const inactive = await request(`${path}/${created.body.id}/inactivate`, {
    method: "PATCH",
    headers: json(cookie),
  });

  if (!inactive.response.ok || inactive.body.status !== "INACTIVE") {
    throw new Error(`${name} inactivate failed`);
  }

  const activeList = await request(`${path}?status=active&search=${runId}`, {
    headers: json(cookie),
  });

  if (!activeList.response.ok || activeList.body.data.length !== 0) {
    throw new Error(`${name} active filter failed`);
  }

  const inactiveList = await request(`${path}?status=inactive&search=${runId}`, {
    headers: json(cookie),
  });

  if (!inactiveList.response.ok || inactiveList.body.data.length < 1) {
    throw new Error(`${name} inactive filter failed`);
  }

  const allList = await request(
    `${path}?status=all&search=${runId}&sort=name&order=asc&page=1&limit=10`,
    { headers: json(cookie) },
  );

  if (!allList.response.ok || allList.body.pagination.total < 1) {
    throw new Error(`${name} list/search/pagination failed`);
  }

  const reactivated = await request(`${path}/${created.body.id}/reactivate`, {
    method: "PATCH",
    headers: json(cookie),
  });

  if (!reactivated.response.ok || reactivated.body.status !== "ACTIVE") {
    throw new Error(`${name} reactivate failed`);
  }
}

const unauthorized = await request("/institutions");
if (unauthorized.response.status !== 401) {
  throw new Error("Unauthenticated access was not blocked");
}

const { adminCookie, secretaryCookie } = await ensureUsers();

await exerciseBaseRecord({
  cookie: adminCookie,
  path: "/institutions",
  name: "institution",
  body: { name: `Instituicao ${runId}` },
  updateBody: { name: `Instituicao ${runId} Atualizada` },
  duplicateBody: { name: `Instituicao   ${runId}` },
});

await exerciseBaseRecord({
  cookie: secretaryCookie,
  path: "/shifts",
  name: "shift",
  body: { name: `Turno ${runId}` },
  updateBody: { name: `Turno ${runId} Atualizado` },
  duplicateBody: { name: `Turno   ${runId}` },
});

await exerciseBaseRecord({
  cookie: adminCookie,
  path: "/buses",
  name: "bus",
  body: { name: `Onibus ${runId}`, capacity: 40 },
  updateBody: { name: `Onibus ${runId} Atualizado`, capacity: 35 },
  duplicateBody: { name: `Onibus   ${runId}`, capacity: 40 },
});

const invalidCapacity = await request("/buses", {
  method: "POST",
  headers: json(adminCookie),
  body: JSON.stringify({ name: `Onibus invalido ${runId}`, capacity: 0 }),
});

if (invalidCapacity.response.status !== 400) {
  throw new Error("Bus capacity validation failed");
}

console.log("Sprint 2 base records smoke OK");
