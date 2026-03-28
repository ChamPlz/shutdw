# 1.1.0
## Change Log
### Version v1.1.0 - 2026-03-28

#### Added
- Suporte multiplataforma nativo (Windows, Linux, macOS).
- Workflow CI/CD completo (GitHub Actions) para publicação de binários multiplataforma.

#### Changed
- Licença atualizada para PolyForm Noncommercial 1.0.0.
- Otimização do Electron Builder para as novas arquiteturas de destino.

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
