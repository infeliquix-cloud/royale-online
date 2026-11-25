# Royale Online — servidor + cliente

## Rodar no seu PC (teste com 2 dispositivos na mesma rede Wi‑Fi)
1. Instale Node.js 18+.
2. `npm install` (baixa o `ws`) e depois `npm start`.
3. Abra `http://IP-DO-PC:3000` em dois celulares/abas (descubra o IP com `ipconfig`/`ifconfig`).
4. Crie duas contas (nome + senha), use AMIGOS > Buscar para se adicionar, convide, e toque em JOGAR ONLINE.
   A partida começa 15 s depois que 2 jogadores estão na fila (`MINP=2`).

## Hospedar na internet (necessário para jogar fora do seu Wi‑Fi)
Qualquer host de Node com WebSocket e HTTPS: Render, Railway, Fly.io, um VPS.
- Comando de build: `npm install` · Comando de start: `npm start`
- Variáveis: `REGION` (ex.: `BR-SP`), `MINP` (mínimo de jogadores), `DB` (caminho do db.json).
- **Disco persistente**: monte um volume e aponte `DB` para ele, senão contas/amizades somem a cada deploy.
- Uma região por servidor: para várias regiões, suba uma instância em cada uma (o jogo mostra o ping da instância atual).

## O que o servidor controla
Contas (senha com scrypt, token de reconexão), amizades, pedidos, convites, equipes, chat (amigo/equipe/sala),
bloqueio/denúncia/privacidade, salas e matchmaking (até 50), zona segura, vida/colete, dano por zona do corpo,
cadência, munição, alcance, mortes e resultado. O cliente só envia posição e intenção de tiro.
Anti-trapaça: limite de velocidade (teleporte é revertido), limite de mensagens, validação do tiro no servidor.

## Limitações conhecidas (honestas)
- Colisão com casas/árvores é só no cliente (o servidor não tem o mapa); o mapa é gerado aleatório em cada cliente,
  então cenários diferem entre jogadores. Próximo passo: mapa por seed compartilhada + colisão no servidor.
- Online: todos começam com rifle + 50 de colete (loot, granadas e paraquedas ainda não sincronizados).
- Sem bots online, sem moderação automática das denúncias (ficam em `db.json`).
