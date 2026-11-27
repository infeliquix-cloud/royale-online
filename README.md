# FFZINH (Royale Online)

Battle royale multiplayer no navegador — Android / Termux / Render.

## Nome oficial
**FFZINH** (repositório e servidor: royale-online)

## Rodar no Termux / PC
```bash
pkg install nodejs  # Termux
npm install
npm start
```
Abra `http://IP:3000` no Chrome Android.

## Render + MongoDB Atlas
Variáveis de ambiente:
- `MONGODB_URI` — connection string do Atlas (obrigatório para persistência real)
- `MONGODB_DB` — `royale` (opcional)
- `REGION` — ex. `BR-SP`
- `MINP` — mínimo de jogadores (padrão 2)

Sem `MONGODB_URI` usa `db.json` local (some no redeploy do Render Free).

Build: `npm install` · Start: `npm start`

## Recursos
- **Salinhas**: criar (pública/privada + senha), entrar por código, lista pública, líder inicia
- **Gelo**: 5 paredes por partida, botão 🧊, mesh 3D, colisão, sync
- **Loja**: 20 itens, comprar/equipar, diamantes
- **Códigos**: dimas198xz, ffzzx77, Adm778
- **ADM**: conta `Sparky◇dono` (ID interno)
- **Selo ✔** laranja
- Login com “Manter conectado”, logout, revogar sessões
- Multiplayer via WebSocket (WSS no Render)

## Arquivos
- `server.js` / `db.js` — servidor + persistência
- `public/index.html` — jogo 3D
- `public/net.js` — UI social, salinhas, loja
- `public/royale-fx.js` — gelo 3D, sons, tintas

Não faça deploy sem autorização.
