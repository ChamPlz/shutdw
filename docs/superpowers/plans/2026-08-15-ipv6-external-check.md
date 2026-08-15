# Teste externo de IPv6 para acesso remoto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determinar, nas configurações, se o IPv6 é utilizável para acesso remoto via um teste HTTP externo real (com fallback para "apenas IPv6 local").

**Architecture:** `server/network.js` ganha um teste externo via `fetch` a um serviço só-IPv6 (`https://api6.ipify.org`), com fallback para o endereço global local e cache de 5 min. `server/routes.js` expõe o status em `/config/ipv6-available` e usa o IP público retornado em `/ip6`. O renderer classifica `external` / `local` / `unavailable` com mensagens distintas.

**Tech Stack:** Node.js (global `fetch` + `AbortController`), Express, Electron renderer, Jest + Supertest.

## Global Constraints

- Endpoint do teste externo: `https://api6.ipify.org` (constante `IPV6_TEST_ENDPOINT` em `server/network.js`).
- TTL do cache de status: 5 minutos (`IPV6_STATUS_TTL = 5 * 60 * 1000`), mesmo TTL do QR cache.
- Timeout do `fetch`: 5 segundos via `AbortController`.
- Link-local (`fe80::/10`) nunca conta como IPv6 utilizável.
- Testes em `__tests__/` com Jest (`npm test` / `npx jest`). Não há jsdom: renderer não é testável via unidade; verificação manual.
- Não alterar o middleware de bloqueio de IPv6 nem a rota de shutdown.

---

### Task 1: Helpers de IPv6 em `server/network.js`

**Files:**
- Modify: `server/network.js`
- Test: `__tests__/network.test.js` (novo)

**Interfaces:**
- Produces:
  - `isLinkLocal(ip: string|null) => boolean`
  - `getPublicIpv6(timeout?: number) => Promise<string|null>`
  - `getIPv6Status(publicLookup?, outboundLookup?) => Promise<{ status: "external"|"local"|"unavailable"; publicIp?: string; ipv6?: string }>`
  - `getIPv6StatusCached() => Promise<{ status; publicIp?; ipv6? }>`
  - `resetIpv6StatusCache() => void` (para testes)

- [ ] **Step 1: Write the failing test**

Create `__tests__/network.test.js`:

```js
const network = require("../server/network");

describe("network.js — helpers de IPv6", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    network.resetIpv6StatusCache();
  });

  describe("isLinkLocal", () => {
    test("identifica link-local fe80::/10", () => {
      expect(network.isLinkLocal("fe80::1")).toBe(true);
      expect(network.isLinkLocal("febf:ffff::1")).toBe(true);
      expect(network.isLinkLocal("fec0::1")).toBe(false);
    });

    test("rejeita endereços globais e valores inválidos", () => {
      expect(network.isLinkLocal("2001:db8::1")).toBe(false);
      expect(network.isLinkLocal(null)).toBe(false);
    });
  });

  describe("getPublicIpv6", () => {
    test("retorna IP público quando serviço responde", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => "2001:db8::1\n",
      });
      await expect(network.getPublicIpv6()).resolves.toBe("2001:db8::1");
    });

    test("retorna null quando resposta não-ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "" });
      await expect(network.getPublicIpv6()).resolves.toBeNull();
    });

    test("retorna null quando corpo não é IPv6", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => "not-an-ip" });
      await expect(network.getPublicIpv6()).resolves.toBeNull();
    });

    test("retorna null em falha de rede", async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(network.getPublicIpv6()).resolves.toBeNull();
    });
  });

  describe("getIPv6Status", () => {
    test("external quando teste público funciona", async () => {
      const publicLookup = jest.fn().mockResolvedValue("2001:db8::1");
      const outboundLookup = jest.fn();
      await expect(network.getIPv6Status(publicLookup, outboundLookup)).resolves.toEqual({
        status: "external",
        publicIp: "2001:db8::1",
      });
      expect(outboundLookup).not.toHaveBeenCalled();
    });

    test("local quando teste externo falha mas há endereço global", async () => {
      const publicLookup = jest.fn().mockResolvedValue(null);
      const outboundLookup = jest.fn().mockResolvedValue("2001:db8::2");
      await expect(network.getIPv6Status(publicLookup, outboundLookup)).resolves.toEqual({
        status: "local",
        ipv6: "2001:db8::2",
      });
    });

    test("unavailable quando só há link-local", async () => {
      const publicLookup = jest.fn().mockResolvedValue(null);
      const outboundLookup = jest.fn().mockResolvedValue("fe80::1");
      await expect(network.getIPv6Status(publicLookup, outboundLookup)).resolves.toEqual({
        status: "unavailable",
      });
    });
  });

  describe("getIPv6StatusCached", () => {
    test("reutiliza resultado em cache sem nova requisição", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => "2001:db8::1",
      });
      const a = await network.getIPv6StatusCached();
      const b = await network.getIPv6StatusCached();
      expect(a).toBe(b);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/network.test.js -v`
Expected: FAIL — `TypeError: network.isLinkLocal is not a function` (helpers ainda não existem).

- [ ] **Step 3: Implement in `server/network.js`**

Add at top, after the `dgram` require:

```js
const IPV6_TEST_ENDPOINT = "https://api6.ipify.org";
const IPV6_STATUS_TTL = 5 * 60 * 1000;

let ipv6StatusCache = null;
let ipv6StatusCacheTime = 0;
```

Add after the existing `isIPv6` function:

```js
/**
 * Verifica se um endereço IPv6 é link-local (fe80::/10)
 * @param {string|null} ip
 * @returns {boolean}
 */
function isLinkLocal(ip) {
  return typeof ip === "string" && /^fe[89ab][0-9a-f]:/i.test(ip);
}
```

Add after `getOutboundIpv6`:

```js
/**
 * Obtém o IP público IPv6 via requisição HTTPS a um serviço só-IPv6
 * @param {number} timeout - Timeout em ms
 * @returns {Promise<string|null>}
 */
async function getPublicIpv6(timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(IPV6_TEST_ENDPOINT, { signal: controller.signal });
    if (!response.ok) return null;
    const ip = (await response.text()).trim();
    return isIPv6(ip) ? ip : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classifica a disponibilidade de IPv6: externo, apenas local ou indisponível
 * @param {Function} [publicLookup] - Função do teste externo (injetável p/ teste)
 * @param {Function} [outboundLookup] - Função que devolve endereço de saída (injetável p/ teste)
 * @returns {Promise<{status: string, publicIp?: string, ipv6?: string}>}
 */
async function getIPv6Status(publicLookup = getPublicIpv6, outboundLookup = getOutboundIpv6) {
  const publicIp = await publicLookup();
  if (publicIp) return { status: "external", publicIp };

  const localIp = await outboundLookup();
  if (localIp && !isLinkLocal(localIp)) return { status: "local", ipv6: localIp };

  return { status: "unavailable" };
}

/**
 * Retorna o status de IPv6 com cache em memória (TTL 5 min)
 * @returns {Promise<{status: string, publicIp?: string, ipv6?: string}>}
 */
async function getIPv6StatusCached() {
  if (ipv6StatusCache && Date.now() - ipv6StatusCacheTime < IPV6_STATUS_TTL) {
    return ipv6StatusCache;
  }
  ipv6StatusCache = await getIPv6Status();
  ipv6StatusCacheTime = Date.now();
  return ipv6StatusCache;
}

/**
 * Limpa o cache de status de IPv6 (usado em testes)
 */
function resetIpv6StatusCache() {
  ipv6StatusCache = null;
  ipv6StatusCacheTime = 0;
}
```

Update `module.exports` to:

```js
module.exports = {
  isIPv6,
  isLinkLocal,
  getOutboundIp,
  getOutboundIpv6,
  getPublicIpv6,
  getIPv6Status,
  getIPv6StatusCached,
  resetIpv6StatusCache,
  hasIPv6Available,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/network.test.js -v`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add server/network.js __tests__/network.test.js
git commit -m "feat: adicionar teste externo de IPv6 e status local/external/unavailable"
```

---

### Task 2: Rotas `/config/ipv6-available` e `/ip6`

**Files:**
- Modify: `server/routes.js:4`, `server/routes.js:87-89`, `server/routes.js:151-168`
- Modify: `__tests__/routes.test.js:34-39` e final do arquivo

**Interfaces:**
- Consumes: `getIPv6StatusCached()` de `server/network.js` (Task 1).
- Produces: `GET /config/ipv6-available` → `{ status, enabled, publicIp?, ipv6? }`; `GET /ip6` → `{ ipv6, url, enabled, external }`.

- [ ] **Step 1: Write the failing test**

Update the network mock in `__tests__/routes.test.js` (lines 34-39) to:

```js
jest.mock("../server/network", () => ({
  getOutboundIp: jest.fn().mockResolvedValue("192.168.1.10"),
  getOutboundIpv6: jest.fn().mockResolvedValue("fe80::1"),
  getIPv6StatusCached: jest.fn().mockResolvedValue({ status: "external", publicIp: "2001:db8::1" }),
  isIPv6: jest.fn((ip) => ip.includes(":") && !ip.includes(".")),
}));
```

Append this `describe` block at the end of `__tests__/routes.test.js`:

```js
describe("routes.js — disponibilidade de IPv6 externo", () => {
  let app;
  let config;
  let network;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    const { createRoutes } = require("../server/routes");
    const auth = require("../server/auth");
    network = require("../server/network");
    config = {
      pin: await auth.hashPin("1234"),
      scheduledAt: null,
      useIPv6: true,
      autoStart: false,
    };
    app = express();
    app.use(express.json());
    app.use(createRoutes(config));
  });

  test("GET /config/ipv6-available devolve status external e enabled", async () => {
    network.getIPv6StatusCached.mockResolvedValue({ status: "external", publicIp: "2001:db8::1" });
    const res = await request(app).get("/config/ipv6-available");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "external", enabled: true, publicIp: "2001:db8::1" });
  });

  test("GET /config/ipv6-available devolve status local", async () => {
    network.getIPv6StatusCached.mockResolvedValue({ status: "local", ipv6: "2001:db8::2" });
    const res = await request(app).get("/config/ipv6-available");
    expect(res.body).toMatchObject({ status: "local", enabled: true, ipv6: "2001:db8::2" });
  });

  test("GET /ip6 usa endereço público quando external", async () => {
    network.getIPv6StatusCached.mockResolvedValue({ status: "external", publicIp: "2001:db8::1" });
    const res = await request(app).get("/ip6");
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("http://[2001:db8::1]:3333");
    expect(res.body.external).toBe(true);
  });

  test("GET /ip6 usa endereço local quando apenas local", async () => {
    network.getIPv6StatusCached.mockResolvedValue({ status: "local", ipv6: "2001:db8::2" });
    const res = await request(app).get("/ip6");
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("http://[2001:db8::2]:3333");
    expect(res.body.external).toBe(false);
  });

  test("GET /ip6 retorna 404 quando unavailable", async () => {
    network.getIPv6StatusCached.mockResolvedValue({ status: "unavailable" });
    const res = await request(app).get("/ip6");
    expect(res.status).toBe(404);
  });

  test("GET /ip6 retorna 403 quando useIPv6 desabilitado", async () => {
    config.useIPv6 = false;
    const res = await request(app).get("/ip6");
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/routes.test.js -v`
Expected: FAIL — `TypeError: hasIPv6Available is not a function` (o mock não exporta mais `hasIPv6Available`, mas `server/routes.js` ainda o usa).

- [ ] **Step 3: Implement in `server/routes.js`**

Update line 4 import to:

```js
const { getOutboundIp, getIPv6StatusCached, isIPv6 } = require("./network");
```

Replace the `/config/ipv6-available` route (lines 87-89):

```js
router.get('/config/ipv6-available', async (req, res) => {
  const status = await getIPv6StatusCached();
  res.json({ ...status, enabled: config.useIPv6 });
});
```

Replace the body of `/ip6` (lines 151-168) with:

```js
router.get("/ip6", async (req, res) => {
  if (!config.useIPv6) {
    return res.status(403).json({ error: "Acesso IPv6 desabilitado" });
  }
  const cached = getCachedIP("ipv6");
  if (cached) {
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json(cached);
  }
  const status = await getIPv6StatusCached();
  const ipv6Address = status.publicIp || status.ipv6;
  if (!ipv6Address) {
    return res.status(404).json({ error: "IPv6 não disponível" });
  }
  const data = { ipv6: ipv6Address, url: `http://[${ipv6Address}]:${PORT}`, enabled: true, external: status.status === "external" };
  setCachedIP("ipv6", data);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=30");
  res.json(data);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/routes.test.js -v`
Expected: PASS — todos os testes do arquivo (existentes + 6 novos).

- [ ] **Step 5: Run full suite**

Run: `npx jest`
Expected: PASS — 8 suites, 80 testes (64 existentes + 10 de network + 6 novos de rotas).

- [ ] **Step 6: Commit**

```bash
git add server/routes.js __tests__/routes.test.js
git commit -m "feat: expor status de IPv6 externo em /config/ipv6-available e usar IP público em /ip6"
```

---

### Task 3: Renderer — mensagens de status por classificação

**Files:**
- Modify: `renderer/renderer.js:245-274` (`setupIPv6Settings`)

**Interfaces:**
- Consumes: `GET /config/ipv6-available` retornando `{ status, enabled, publicIp?, ipv6? }`.
- Produces: três estados visuais — `external`, `local`, `unavailable`.

- [ ] **Step 1: Implement `setupIPv6Settings`**

Replace the `.then(data => {...})` block inside `setupIPv6Settings` (currently `renderer/renderer.js:247-267`) with:

```js
    .then(data => {
      if (!el.ipv6Message) return;

      if (data.status === "external") {
        el.ipv6Message.textContent = "IPv6 disponível para acesso remoto";
        el.ipv6Message.style.color = "#27ae60";
        el.ipv6ToggleContainer?.style.setProperty("display", "flex");
        if (el.ipv6Toggle) el.ipv6Toggle.checked = data.enabled;
        if (el.ipv6StatusText) {
          el.ipv6StatusText.textContent = data.enabled
            ? "✓ IPv6 habilitado - acesso remoto disponível"
            : "IPv6 desabilitado - sem acesso remoto via IPv6";
        }
        if (data.enabled) loadIPv6Link();
      } else if (data.status === "local") {
        el.ipv6Message.textContent = "IPv6 disponível apenas na rede local";
        el.ipv6Message.style.color = "#e67e22";
        el.ipv6ToggleContainer?.style.setProperty("display", "flex");
        if (el.ipv6Toggle) el.ipv6Toggle.checked = data.enabled;
        if (el.ipv6StatusText) {
          el.ipv6StatusText.textContent = "Acesso remoto externo não confirmado - apenas IPv6 local";
        }
        if (data.enabled) loadIPv6Link();
      } else {
        el.ipv6Message.textContent = "IPv6 não está disponível";
        el.ipv6Message.style.color = "#e74c3c";
        if (el.ipv6ToggleContainer) el.ipv6ToggleContainer.style.display = "none";
        if (el.ipv6StatusText) el.ipv6StatusText.textContent = "Sem conectividade IPv6";
      }
    })
```

- [ ] **Step 2: Verify syntax and client compatibility**

Run: `npx jest __tests__/client-require.test.js -v`
Expected: PASS — renderer.js não contém `require(`.

- [ ] **Step 3: Manual verification**

Run: `npm start`
Expected:
- Aba Configurações → Acesso Remoto IPv6:
  - Com IPv6 externo funcional: "IPv6 disponível para acesso remoto" (verde) + toggle.
  - Sem internet/sem rota externa mas com IPv6 global: "IPv6 disponível apenas na rede local" (laranja).
  - Sem IPv6: "IPv6 não está disponível" (vermelho), sem toggle.

- [ ] **Step 4: Commit**

```bash
git add renderer/renderer.js
git commit -m "feat: diferenciar status externo/local/indisponivel de IPv6 no renderer"
```