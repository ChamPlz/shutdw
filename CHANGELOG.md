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
