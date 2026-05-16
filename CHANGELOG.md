# Unreleased
## Change Log
### Próxima Versão

#### Performance
- **Polling de status otimizado** (`shared/api.js`)
  - Substitui `setInterval` por `setTimeout` recursivo — evita requisições paralelas caso o servidor demore mais que o intervalo
  - Intervalo dinâmico: 5s ocioso → 1s quando shutdown ativo (`remaining > 0`)
  - Pausa automática via `visibilitychange` quando a janela/aba não está visível (economiza CPU e bateria)
  - Correção de estado: só considera ativo quando `remaining > 0`, evitando polling desnecessário após o timer zerar

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
