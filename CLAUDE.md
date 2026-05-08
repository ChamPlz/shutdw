# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de Desenvolvimento

```bash
# Iniciar o app em modo desenvolvimento
npm run dev
# ou
npm start

# Build para Windows
npm run build
# ou
npm run build:win

# Build para outras plataformas
npm run build:linux
npm run build:mac
npm run build:all  # Windows x64 e ia32

# Publicar release
npm run publish
```

**Nota:** Este projeto não possui scripts de `test` ou `lint` configurados no momento.

## Arquitetura de Alto Nível

### Estrutura Geral

ShutDW é um app Electron que combina:
- **Desktop app** (Electron) com interface local
- **Servidor HTTP local** (Express na porta 3333)
- **Interface web remota** acessível via browser/celular

### Componentes Principais

#### 1. Processo Principal Electron (`main.js`)
- Gerencia janela principal, system tray e auto-updater
- Define handlers IPC para comunicação com renderer
- Hardening de segurança: valida URLs externas (apenas `http:`/`https:`)
- Inicia o servidor Express via `require("./server/webServer")`

#### 2. Renderer Desktop (`renderer/`)
- `index.html`: UI principal do app desktop
- `renderer.js`: lógica da interface desktop
- Comunica com backend local via `http://localhost:3333`
- Usa `shared/api.js` para chamadas HTTP

#### 3. Preload Bridge (`preload.js`)
- Expõe APIs seguras via `contextBridge`:
  - `close`, `resetPin`, `autoStart`, `checkAutoStart`
  - `openExternal`, `getVersion`
  - `checkForUpdates`, `installUpdate`, `onUpdateEvent`
- **Importante:** não expõe Node.js diretamente ao renderer

#### 4. Backend Local (`server/`)
- `webServer.js`: ponto de entrada Express, serve `web/` e `shared/`
- `routes.js`: define toda a API REST local
  - Rotas públicas: `/config/pin`, `/config/ipv6-available`
  - Rotas autenticadas: `/shutdown`, `/shutdown/:minutes`, `/schedule`, `/cancel`, `/status`, `/ip`, `/ip6`, `/config/pin`, `/config/ipv6`
  - Middleware de auth por PIN (header `x-pin`)
  - Middleware de bloqueio IPv6 quando desabilitado
- `auth.js`: hashing/verificação de PIN com Argon2id
- `config.js`: persistência de configuração em JSON (`userData/config/config.json`)
- `shutdown.js`: agendamento de desligamento + overlay de contagem regressiva
- `network.js`: detecção de IPs IPv4/IPv6
- `platform.js`: comandos de shutdown específicos por plataforma

#### 5. Interface Web Remota (`web/`)
- `index.html`, `style.css`, `app.js`
- Servida estaticamente pelo Express
- Usa `shared/api.js` (mesmo código da UI desktop)
- Acessa backend via URL relativa (mesma origem)

#### 6. Código Compartilhado (`shared/`)
- `api.js`: funções reutilizáveis para ambas as UIs
  - `apiRequest`, `sendAction`, `startStatusPolling`
  - `createInitialPin`, `savePinChange`, `scheduleExactTime`
  - `loadQRCode`, `updateTimer`
- Permite manter lógica consistente entre desktop e web

### Fluxo de Autenticação

1. Primeiro uso: modal pede criação de PIN (mínimo 4 dígitos)
2. PIN é hasheado com Argon2id e salvo em `config.json`
3. Requisições POST enviam PIN via header `x-pin`
4. Backend verifica hash antes de executar ações
5. Localhost tem bypass parcial (exceto `/shutdown`)

### Fluxo de Shutdown

1. Usuário agenda via timer rápido, horário específico ou shutdown imediato
2. `server/shutdown.js` cria overlay de contagem regressiva
3. Timer atualiza a cada segundo via `sendRemaining`
4. Ao chegar em zero, executa comando de shutdown da plataforma
5. Cancelamento limpa timer, fecha overlay e cancela shutdown do sistema

### Acesso Remoto

- **IPv4 (padrão)**: QR code com IP local da rede
- **IPv6 (opcional)**: toggle em configurações, permite acesso via internet
- Middleware em `routes.js` bloqueia IPv6 quando desabilitado
- Rate limiting diferenciado por tipo de rota (leitura/ação/auth)

## Convenções Importantes

- **Segurança**: sempre validar URLs externas antes de `shell.openExternal`
- **PIN**: nunca armazenar em texto puro, sempre usar `auth.hashPin`
- **Config**: usar `loadConfig`/`saveConfig` para persistência, nunca manipular JSON diretamente
- **IPC**: toda comunicação renderer→main deve passar por `preload.js`
- **Shared code**: lógica comum entre desktop/web vai em `shared/api.js`

## Dependências Principais

- `electron`: framework desktop
- `electron-updater`: auto-update
- `express`: servidor HTTP local
- `express-rate-limit`: proteção contra brute-force
- `argon2`: hashing seguro de PIN
