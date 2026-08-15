# Unreleased
## Change Log
### Próxima Versão

---

# 1.4.0
## Change Log
### Version v1.4.0 - 2026-08-15 — Notificações Flutuantes & Overlay com Visual de Toast

#### Added
- **Notificações flutuantes (toasts)** em desktop e web (`shared/api.js`)
  - `showToast` compartilhado: toasts fixos no canto inferior direito com auto-dismiss (4s sucesso, 6s erro) e botão "×"
  - Empilhamento com a mais nova no topo (máx. 5) e `aria-live` para acessibilidade
  - Timer de contagem regressiva agora é um toast separado (`#timerToast`)
- **Overlay de contagem regressiva com visual de toast** (`overlay/`)
  - Barra escura translúcida com borda roxa e cantos arredondados, tempo em roxo
  - Botão "×" no canto da barra (esconde a janela, mantém o desligamento); "cancelar" cancela o shutdown
- **Teste externo de IPv6** para acesso remoto (PR #16)
  - Status de IPv6 em `external|local|unavailable` via `/config/ipv6-available`; `/ip6` passa a usar o IP público

#### Changed
- `savePinChange` agora recebe callback de resultado; `showStatus`/`showConfigStatus` mantidas mas sem uso nas UIs
- Toda a lógica de toasts reutilizada entre desktop e web via código compartilhado
- CSS dos toasts usa `overflow-wrap: anywhere` no lugar do `word-break: break-word` obsoleto

#### Developer Experience
- **Suíte de testes ampliada para 85 testes** (9 suites) — toasts, callback de PIN, IPv6 externo
- Especificações e planos de implementação documentados em `docs/superpowers/`

---

# 1.3.0
## Change Log
### Version v1.3.0 - 2026-08-14 — Robustez, Segurança & Electron 43

#### Security
- **Bugs P0 corrigidos (fixes #14, PR #15)** — revisão completa (arquitetura + produto + implementação)
  - **Input validation**: `/shutdown/:minutes` e `/schedule` agora rejeitam valores inválidos (NaN, passado, `HH:MM` fora de 00–59/00–23) — elimina overlay travado em `NaN:NaN`
  - **CORS same-origin IPv6**: middleware extraído (`server/cors.js`), comparação exata de origin e suporte a `http://[fe80::1]:3333` — acesso remoto via IPv6 volta a funcionar
  - **Dual-stack**: IPs `::ffff:` normalizados nos middlewares IPv6
  - **Fim do bypass de localhost**: todas as rotas destrutivas exigem PIN válido de qualquer origem (inclui `/config/pin` e `/shutdown/:minutes`)
  - **Modal web**: remoção de `style="display:none"` inline que impedia a criação do PIN na interface web
  - **Restauração no boot**: `restorePendingShutdown` re-agenda desligamentos futuros persistidos e limpa agendamentos expirados (sem phantom de 0s no `/status`)
  - **Validação antes de agir**: `scheduleShutdown` valida o timestamp antes de limpar timer/cancelar shutdown do SO — um NaN não destrói um agendamento ativo
- **`electron` atualizado para 43.4.0** — corrige `extract-zip` (GHSA-jmr9-qjv8-65gv) e sandboxed iframe (GHSA-9f4c-93c8-jc8g); `npm audit` reporta **0 vulnerabilidades**
- **Cache de configuração**: `loadConfig`/`saveConfig` preservam a mesma referência em memória (`server/config.js`) — `/status` sempre reflete o `scheduledAt` mais recente do tray
- Dependências de produção atualizadas: `express@4.22.2`, `electron-updater@6.8.9`, `builder-util-runtime@9.7.0`, `ip-address@10.5.0`, `js-yaml@4.3.1`

#### Developer Experience
- **Suíte de testes ampliada para 55 testes** (7 suites)
  - `__tests__/shutdown.test.js` — validação de timestamp, restauração no boot, preservação de agendamento ativo
  - `__tests__/routes.test.js` — validação de rotas, `HH:MM` estrito, timestamp não-finito
  - `__tests__/cors.test.js` — CORS same-origin IPv4/IPv6, preflight e 403
  - `__tests__/config.test.js` — referência estável do cache de configuração
- CI restaurado para auditar todas as dependências (dev incluído)

---

# 1.2.1
## Change Log
### Version v1.2.1 - 2026-05-16

#### Fixed
- **Botão "Remoto" persiste após desativar IPv6**
  - Adiciona `clearLocalIPCache("ipv6")` em `shared/api.js`
  - `toggleIPv6(false)` agora limpa o cache local e esconde o botão "Remoto" imediatamente
  - Volta automaticamente para a aba "Local" se o usuário estiver na aba remota
- **Flash duplo ao restaurar da tray** (fixes #8)
  - Substitui `win.hide()` por `win.minimize()` no handler de close — mantém a superfície DWM "quente", evitando recriação branca ao restaurar
  - Move `setSkipTaskbar(true)` antes do `minimize()` para evitar aparição breve na taskbar
  - Remove `win.focus()` redundante de `restoreWindow()` — `show()` e `restore()` já ativam a janela; o focus extra causava o segundo flash

#### Performance
- **Polling de status otimizado** (`shared/api.js`)
  - Substitui `setInterval` por `setTimeout` recursivo — evita requisições paralelas caso o servidor demore mais que o intervalo
  - Intervalo dinâmico: 5s ocioso → 1s quando shutdown ativo (`remaining > 0`)
  - Pausa automática via `visibilitychange` quando a janela/aba não está visível (economiza CPU e bateria)
  - Correção de estado: só considera ativo quando `remaining > 0`, evitando polling desnecessário após o timer zerar

---

# 1.2.0
## Change Log
### Version v1.2.0 - 2026-05-09 — Security Hardening & Observability Release

#### Security
- **Content Security Policy (CSP)** implementado em todas as interfaces
  - Desktop, web remote e overlay com CSP rigoroso
  - Previne XSS e injeção de scripts maliciosos
- **Security headers** adicionados em todas as respostas HTTP
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`
  - `Permissions-Policy` bloqueando APIs sensíveis (geolocation, microphone, camera, payment, USB, etc.)
- **CORS hardening** com origin allowlist dinâmica
  - Inclui IP local da rede detectado automaticamente
  - Preflight OPTIONS com cache de 24 horas
  - Bloqueio de origins não permitidas com 403
- **PIN input hardening**
  - `inputmode="numeric"`, `pattern="[0-9]*"`, `maxlength="20"`, `autocomplete="off"`
  - Validação em tempo real, proteção contra paste malicioso, feedback visual CSS
- **Rate limiting diferenciado**
  - Leitura: 120 req/min, Ação: 20 req/min, Autenticação: 5 req/min
- **Graceful shutdown** do servidor Express
  - `server.close()` + draining de conexões + timeout de 10s
  - Handlers SIGTERM/SIGINT configurados
- **Overlay CSP compliant**
  - Event listeners injetados via `executeJavaScript` após page load
  - Remove inline handlers para compatibilidade com CSP
- **Remoção de sistema de telemetria Sentry**
  - Elimina envio de dados de diagnóstico para serviços externos

#### Performance
- **Cache de IP/QR code double-layer**
  - Server-side: Map com TTL de 5 minutos
  - Client-side: localStorage + timestamp (funciona offline entre recargas)
- **Centralização de constantes** em `shared/constants.js`
  - Elimina magic numbers em toda a base de código

#### Observability
- **Logging estruturado** com winston + winston-daily-rotate-file
  - Logs diários com rotação automática (14 dias normais, 30 dias erros)
  - Contexto estruturado: timestamp, level, componente, action
  - Request logging com IP, método, rota, duração e status code
  - Handlers globais para `uncaughtException` e `unhandledRejection`

#### Fixed
- **3 blockers críticos de runtime** corrigidos
- **Memory leaks no overlay**: prevent IPC listener accumulation
- **Memory leaks no renderer/web**: polling cleanup on page unload
- **Event listener accumulation** em links de QR code
- **Graceful shutdown timer** limpo em todos os caminhos de saída
- **TypeScript annotations** removidas de `webServer.js`

#### Developer Experience
- **Test suite** adicionada (Jest + SuperTest)
  - 18 testes unitários cobrindo auth e rate limiting
- **CI/CD**
  - GitHub Actions workflow para validação de PRs
  - Dependabot configurado para atualizações automáticas de dependências

---

# 1.1.10
## Change Log
### Version v1.1.10 - 2026-05-08 — Security Hardening Release

#### Security
- **Content Security Policy (CSP)** implementado em ambas as interfaces (desktop e web)
  - Desktop: CSP com `'self' 'unsafe-eval'` (requisito Electron)
  - Web Remote: CSP rigoroso sem inline scripts — protege contra XSS
  - Overlay CSP via `webPreferences` no Electron
- **Inline event handlers removidos** do overlay (CSP compliant)
  - Event listeners injetados via `executeJavaScript` após page load
- **PIN input hardening** implementado
  - HTML: `inputmode="numeric"`, `pattern="[0-9]*"`, `maxlength="20"`, `autocomplete="off"`
  - JS: validação em tempo real, proteção contra paste malicioso, feedback visual CSS
  - Limitações: apenas dígitos, comprimento máximo de 20 caracteres
- **Rate limiting diferenciado** para cada tipo de endpoint
  - Leitura: 120 req/min (`/status`, `/ip`, `/ip6`, `/config/*` GETs)
  - Ação: 20 req/min (`/shutdown`, `/schedule`, `/cancel`, `/config/*` POSTs)
  - Autenticação: 5 req/min (`/config/pin` create/update)
- **CORS hardening** com origin allowlist e preflight OPTIONS
  - Apenas localhost/app/file — bloqueia origins não confiáveis
  - `Access-Control-Max-Age` de 24 horas para reduzir preflight calls
- **Security headers** adicionados em todas as respostas
  - `X-XSS-Protection: 1; mode=block`
  - `Permissions-Policy` bloqueando APIs sensíveis (geolocation, microphone, camera, etc.)
- **Graceful shutdown** do servidor Express
  - `server.close()` + connection draining + timeout de 10 segundos
  - SIGTERM/SIGINT handlers configurados
- **PIN security** reforçada com Argon2id
  - Salt automático, hash persistido no `config.json`
  - Verificação constante-time previne timing attacks
- **QR code cache double-layer** implementado
  - Server-side: Map com TTL de 5 minutos (evita lookup desnecessário)
  - Client-side: localStorage + timestamp (funciona offline entre recargas)

#### Performance
- **Centralização de constantes** em `shared/constants.js`
  - Elimina magic numbers, facilita manutenção e revisão
  - Módulos refatorados: server/routes, server/webServer, shared/api, logger, renderer e web
- **QR code endpoint caching** em memória (server-side) + localStorage (client-side)
  - TTL de 5 minutos, elimina redes desnecessárias
- **Polling de status com backoff inteligente**
  - 1 Hz quando shutdown ativo, 0.2 Hz ocioso — menos CPU

#### Observability
- **Logging estruturado** com winston + winston-daily-rotate-file
  - Logs diários com rotação automática (14 dias normais, 30 dias para erros)
  - Contexto estruturado: timestamp, level, component, action
  - Handlers globais para uncaughtException e unhandledRejection
- **Request logging** com IP, método, rota, duração e status code

#### Developer Experience
- **Test suite** adicionada (Jest + SuperTest)
  - 15 testes unitários cobrindo auth e rate limiting
  - Coverage configurado para server/auth e modules relacionados
- **Documentação de validação** adicionada
  - `__tests__/CSP_VALIDATION.md` — guia passo-a-passo para validar CSP no DevTools
  - `__tests__/RATE_LIMIT_CURL.md` — roteiro de testes de rate limiting via curl

#### Changed
- Dependências atualizadas para maior segurança e performance.

---

# 1.1.9 (previous release)
## Change Log
### Version v1.1.9 - 2026-05-05

#### Fixed
- Sentry DSN atualizado no processo de build — injetado dinamicamente via electron-builder extraMetadata.

#### Changed
- Dependências atualizadas (`electron` + patching de dependências vulneráveis).

---

#### Added
- Arquivo `.env.example` com template para configuração local.

#### Changed
- README traduzido para inglês com novo banner e melhor formatação visual.

---

# 1.1.3
## Change Log
### Version v1.1.3 - 2026-04-21

#### Added
- Dependabot configurado para atualizações automáticas de dependências (`.github/dependabot.yml`).

#### Changed
- Dependências atualizadas para maior estabilidade e segurança:
  - `electron-builder` atualizado para v26.8.1
  - `tar` atualizado (correções de segurança)
  - `electron` atualizado para v39.8.5
  - `argon2` atualizado para v0.44.0
  - `express-rate-limit` atualizado para v8.2.2

#### Performance
- Cache em memória da configuração (`server/config.js`) para evitar I/O síncrono em cada requisição.
- Polling de status com backoff inteligente: reduz de 1s para 5s quando não há shutdown ativo (`shared/api.js`).
- Auto-updater agora aguarda 3 segundos após startup para verificar atualizações, não bloqueando a inicialização da UI (`main.js`).
- Animação CSS do background com GPU acceleration (`will-change: transform`) para renderização mais suave (`renderer/style.css`).

#### Fixed
- Debounce em `checkPinConfigured()` para evitar múltiplas requisições paralelas à API (`renderer/renderer.js`).
- Timeout de 5 segundos em todos os comandos `exec()` para prevenir processos zombie (`server/shutdown.js`, `server/routes.js`).
- `require("http")` movido para o topo do arquivo, evitando carregamento repetido em chamadas do tray menu (`main.js`).
- Função de cleanup do polling de status para prevenir memory leak em sessões longas (`renderer/renderer.js`).

---

# 1.1.3 (previous pre-audit release)
## Change Log
### Version v1.1.3 - 2026-04-21

#### Added
- Dependabot configurado para atualizações automáticas de dependências.

#### Changed
- Dependências atualizadas: electron v39.8.5, electron-builder v26.8.1, argon2 v0.44.0, express-rate-limit v8.2.2, tar security update.

#### Performance
- Config cache em memória (server/config.js)
- Status polling com backoff inteligente
- Auto-updater delay de 3s no startup
- GPU acceleration em animações CSS

#### Fixed
- Debounce em checkPinConfigured()
- Timeout de 5s em todos os exec() calls
- http require movido para topo de main.js
- Cleanup de status polling para evitar memory leak

---

# 1.1.1
## Change Log
### Version v1.1.1 - 2026-03-28

#### Fixed
- Ícone redimensionado para 512×512 (requisito macOS)
- Campo author no package.json inclui email (requisito Linux .deb)

---

# 1.1.0
## Change Log
### Version v1.1.0 - 2026-03-28

#### Added
- Suporte multiplataforma (Windows, Linux, macOS)
- Workflow CI/CD completo (GitHub Actions)

#### Changed
- Licença: PolyForm Noncommercial 1.0.0
- Otimizações do Electron Builder

---
# 1.0.41
## Change Log
### Version v1.0.41 - 2026-03-18

#### Fixed
- Melhoria na correção do ícone da barra de tarefas (Taskbar Bug): os tempos de atualização foram escalonados (delays de 100ms e 150ms) para garantir que o Windows processe o redesenho do ícone com sucesso ao restaurar o app.

---
# 1.0.40
## Change Log
### Version v1.0.40 - 2026-03-17

#### Fixed
- Correção avançada para o *bug* crônico do Electron no Windows onde o ícone do aplicativo desaparecia misteriosamente da barra de tarefas principal do sistema após uma janela transparente e sem bordas (*frameless*) ser escondida e restaurada. Foi implementado um sistema de redrawn dinâmico nas interações via System Tray.

---
# 1.0.39
## Change Log
### Version v1.0.39 - 2026-03-16

#### Fixed
- Resolvido um *bug* crítico de corrida (Race Condition) no overlay de contagem onde múltiplos cliques rápidos em "60 minutos" causavam janelas fantasmas incontroláveis. Agora a janela sobreposta existente é inteligentemente reciclada ao reagendar.

---
# 1.0.38
## Change Log
### Version v1.0.38 - 2026-03-16

#### Added
- Nova aba "Sobre" com exibição dinâmica da versão atual, informações do projeto e link GitHub.
- Verificador interno de atualizações integrado com barra de progresso e botão para aplicar instalação.
- Limitadores de taxa (Rate Limiting) diferenciados: limites altos para leitura, médios para ações e estritos (`/config/pin`) para autenticação (prevenção de bruteforce).
- Novo Context Menu inteligente na bandeja (Systray) contendo desligamento rápido (10, 30 e 60 minutos) e cancelamento.

#### Changed
- Refatoração profunda da arquitetura do servidor: divisão do `webServer.js` em módulos específicos (`network.js`, `shutdown.js`, `routes.js`).
- Remoção da redundância de código de interface, reunindo lógicas idênticas do Web e Desktop no arquivo independente `shared/api.js`.
- O atualizador (auto-updater) agora utiliza IPC (Inter-Process Communication) em vez de caixas de diálogo síncronas, evitando travar a thread principal.

#### Fixed
- Bug crítico que fazia o ícone da bandeja sumir silenciosamente ao fechar/arquivar a janela no modo transparente foi solucionado usando `restoreWindow()`.
- O loop recursivo na inicialização da troca de abas (`switchTab`) que travava a exibição principal.
- Bug do endpoint `/shutdown` via POST que falhava ao reter a resposta da API (agora retorna via JSON imediato).
- Evento `second-instance` para tratar corretamente quando usuários iniciam várias instâncias do aplicativo em vez de abrir processos soltos.
