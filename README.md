# ⚡ Controle de Energia

Um aplicativo moderno para **desligar o computador remotamente**, **agendar desligamentos** e **controlar tudo pelo celular** através de uma interface web simples e segura.

> Ideal para quem deixa o PC ligado, servidores caseiros, homelab, pais que querem controlar horários ou simplesmente não querem levantar da cama 😄

---

## ✨ Funcionalidades

- 🖥️ **App Desktop (Windows)** feito com Electron  
- 🌐 **Interface Web** acessível pelo navegador (PC ou celular)
- 📱 Controle remoto via celular na mesma rede
- ⏳ Contador regressivo de desligamento
- ⏰ Agendamento por tempo (10, 30, 60 minutos)
- 🕒 Agendamento por horário exato
- ❌ Cancelamento de desligamento
- 🔐 Proteção por PIN
- 💾 Salvamento de configurações
- 🧲 Minimizar para a bandeja do sistema (system tray)
- 🎨 Interface moderna com tema roxo

---

## 📸 Screenshots

> *(adicione imagens aqui depois)*

---

## 🚀 Como usar

### 1️⃣ Executável (recomendado)
Baixe o instalador na aba **Releases** do GitHub e execute normalmente no Windows.

Após abrir:
- O app inicia em segundo plano
- Um ícone aparece na bandeja do sistema
- A interface web pode ser acessada pelo navegador

---

### 2️⃣ Acesso pelo celular

Com o app rodando, acesse no celular:

http://IP_DO_SEU_PC:3000


O próprio app exibe:
- 📲 QR Code para acesso rápido
- 🔗 Link com IP automático

---

## 🛠️ Rodando em modo desenvolvimento

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
git clone https://github.com/seu-usuario/controle-de-energia.git
cd controle-de-energia
npm install 
```
Rodar o APP
```bash
npm run dev
```

Gerar executável
```bash
npm run build
```

### 🧱 Tecnologias utilizadas

- Electron — aplicativo desktop

- Node.js — backend

- Express — servidor web

- HTML / CSS / JavaScript — interface web

- QRCode — acesso rápido pelo celular

### 🔐 Segurança

- Ações protegidas por PIN

- Comunicação restrita à rede local

- Nenhuma dependência de serviços externos

### 📜 Licença

Este projeto é código aberto para uso não-comercial.

* ✅ Uso pessoal, educacional e não-comercial

* ❌ Uso comercial requer licença paga

📧 Para licenciamento comercial:
carloscaldeira23@gmail.com

Veja o arquivo LICENSE
 para mais detalhes.

### 🤝 Contribuições

Contribuições são bem-vindas!

* Fork o projeto

* Crie uma branch (feature/minha-feature)

* Faça commit

* Abra um Pull Request 🚀

### ⭐ Apoie o projeto

Se este projeto te ajudou:

Deixe uma ⭐ no repositório

Compartilhe com amigos

Use e dê feedback 😄

