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

    test("retorna null quando corpo tem dois-pontos mas não é IPv6 válido", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => "foo:bar" });
      await expect(network.getPublicIpv6()).resolves.toBeNull();
    });

    test("retorna null em falha de rede", async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(network.getPublicIpv6()).resolves.toBeNull();
    });

    test("retorna null quando o fetch é abortado pelo timeout", async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn((_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("The operation was aborted")));
        })
      );
      const promise = network.getPublicIpv6(5000);
      jest.advanceTimersByTime(5000);
      await expect(promise).resolves.toBeNull();
      jest.useRealTimers();
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

    test("expira o cache após o TTL de 5 minutos", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => "2001:db8::1" });
      await network.getIPv6StatusCached();
      await network.getIPv6StatusCached();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      Date.now.mockReturnValue(now + 5 * 60 * 1000 + 1);
      await network.getIPv6StatusCached();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});