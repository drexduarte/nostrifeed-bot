# 🗞️ NostriFeed Bot

**NostriFeed** é um bot que conecta o mundo dos **feeds RSS tradicionais** com o universo **descentralizado do Nostr**.

Com ele, você pode importar automaticamente notícias de portais como **NYTimes**, **BBC**, blogs ou qualquer site com RSS — e publicá-las em **relays Nostr** em tempo real, como eventos assinados pela sua chave.

<p align="center">
  <img src="https://img.shields.io/github/license/drexduarte/nostrifeed-bot" alt="MIT License">
  <img src="https://img.shields.io/github/last-commit/drexduarte/nostrifeed-bot" alt="Last Commit">
  <img src="https://img.shields.io/badge/made%20with-%E2%9D%A4-orange" alt="Made with Love">
</p>

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
   git clone https://github.com/drexduarte/nostrifeed-bot.git
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

## 🛠️ Contribuindo

Quer colaborar? Sinta-se à vontade para enviar sugestões, issues ou pull requests! Confira o [guia de contribuição](CONTRIBUTING.md) para começar.

---

## 💡 Ideias futuras

- Painel web para gerenciar feeds dinamicamente
- Suporte a conteúdo completo via Readability
- Agendamento inteligente e curadoria baseada em zaps
- Suporte a banco de dados para histórico de publicações

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).
