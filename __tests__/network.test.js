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