/**
 * Client-side require() incompatibility test
 * Garante que arquivos servidos ao browser NÃO usam require() do Node.js
 */

const fs = require("fs");
const path = require("path");

describe("Client-side require() incompatibility", () => {
  const clientFiles = [
    { file: "web/app.js", label: "Web App (browser)" },
    { file: "renderer/renderer.js", label: "Renderer Desktop (preload context)" },
    { file: "shared/api.js", label: "Shared API (used by both UIs)" },
  ];

  clientFiles.forEach(({ file, label }) => {
    test(`${label} (${file}) não deve conter require() — código deve ser browser-compatível`, () => {
      const fullPath = path.join(__dirname, `../${file}`);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Não deve conter require() — isso é incompatível com browsers
      const hasRequire = /require\s*\(/.test(content);
      expect(hasRequire).toBe(false);
    });
  });
});
