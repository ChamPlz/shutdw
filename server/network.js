const os = require("os");
const dgram = require("dgram");
const net = require("node:net");

const IPV6_TEST_ENDPOINT = "https://api6.ipify.org";
const IPV6_STATUS_TTL = 5 * 60 * 1000;

let ipv6StatusCache = null;
let ipv6StatusCacheTime = 0;

/**
 * Verifica se um IP é IPv6
 * @param {string} ip
 * @returns {boolean}
 */
function isIPv6(ip) {
  return ip.includes(':') && !ip.includes('.');
}

/**
 * Verifica se um endereço IPv6 é link-local (fe80::/10)
 * @param {string|null} ip
 * @returns {boolean}
 */
function isLinkLocal(ip) {
  return typeof ip === "string" && /^fe[89ab][0-9a-f]:/i.test(ip);
}

/**
 * Obtém IP de saída via socket UDP (sem enviar dados)
 * @param {'udp4'|'udp6'} family - Família do socket
 * @param {string} target - IP de destino para descobrir a rota
 * @param {number} timeout - Timeout em ms
 * @returns {Promise<string|null>}
 */
function getOutboundAddress(family, target, timeout = 1000) {
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket(family);
      const timer = setTimeout(() => {
        socket.close();
        resolve(null);
      }, timeout);

      socket.connect(53, target, () => {
        clearTimeout(timer);
        try {
          resolve(socket.address().address || null);
        } catch {
          resolve(null);
        }
        socket.close();
      });

      socket.on("error", () => {
        clearTimeout(timer);
        socket.close();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Obtém IP de saída IPv4
 * @param {number} timeout
 * @returns {Promise<string>}
 */
async function getOutboundIp(timeout = 1000) {
  const ip = await getOutboundAddress("udp4", "8.8.8.8", timeout);
  return ip || "localhost";
}

/**
 * Obtém IP de saída IPv6
 * @param {number} timeout
 * @returns {Promise<string|null>}
 */
async function getOutboundIpv6(timeout = 1000) {
  return getOutboundAddress("udp6", "2001:4860:4860::8888", timeout);
}

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
    return net.isIP(ip) === 6 ? ip : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classifica a conectividade IPv6: saída externa confirmada, apenas local ou indisponível
 * Nota: confirma conectividade IPv6 de saída; não verifica reachability inbound (firewall/porta)
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

/**
 * Verifica se há IPv6 disponível nas interfaces de rede
 * @returns {boolean}
 */
function hasIPv6Available() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === "IPv6" && !addr.internal) {
        return true;
      }
    }
  }
  return false;
}

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
