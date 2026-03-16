const os = require("os");
const dgram = require("dgram");

/**
 * Verifica se um IP é IPv6
 * @param {string} ip
 * @returns {boolean}
 */
function isIPv6(ip) {
  return ip.includes(':') && !ip.includes('.');
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
  getOutboundIp,
  getOutboundIpv6,
  hasIPv6Available,
};
