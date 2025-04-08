# 🗞️ NostriFeed Bot

**NostriFeed** é um bot que conecta o mundo dos **feeds RSS tradicionais** com o universo **descentralizado do Nostr**.

Com ele, você pode importar automaticamente notícias de portais como **NYTimes**, **BBC**, blogs ou qualquer site com RSS — e publicá-las em **relays Nostr** em tempo real, como eventos assinados pela sua chave.

---

## 🚀 Principais funcionalidades

- 🔁 Converte automaticamente feeds RSS em eventos Nostr
- 🧠 Suporte a múltiplos feeds e múltiplos relays
- 🧵 Inclui título, link e fonte da notícia no conteúdo
- 🕓 Atualização periódica configurável (padrão: 30 minutos)
- ⚡ Assinatura via chave Nostr (ed25519)
- 💬 Compatível com apps como Damus, Amethyst, Iris, etc.

---

## 🧰 Tecnologias utilizadas

- [Node.js](https://nodejs.org)
- [rss-parser](https://www.npmjs.com/package/rss-parser)
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools)
- WebSockets para publicação em relays

---

## 📦 Como usar

1. Clone este repositório:
   ```bash
   git clone https://github.com/seu-usuario/nostrifeed-bot.git
   cd nostrifeed-bot
   ```

2. Crie um arquivo `.env` com sua chave privada:
   ```env
   NOSTR_PRIVATE_KEY=sua_chave_em_hex
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```

4. Execute o bot:
   ```bash
   node index.js
   ```

O bot publicará nos relays definidos as últimas notícias dos feeds RSS cadastrados.

---

## ✨ Exemplo de publicação

```
🗞️ *Título da Notícia*
https://link-da-noticia.com
Fonte: BBC
```

---

## 💡 Ideias futuras

- Painel web para gerenciar feeds dinamicamente
- Suporte a conteúdo completo via Readability
- Agendamento inteligente e curadoria baseada em zaps
- Suporte a banco de dados para histórico de publicações

---

Feito com ☕, código aberto e amor pelo Nostr 🧡

---

### 📄 Licença

MIT License
