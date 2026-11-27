// Servidor FFZINH (Royale Online): contas, amigos, convites, chat, salas e partida autoritativa.
// Persistência: MongoDB Atlas (MONGODB_URI) ou db.json local.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const DB = require('./db');

const PORT = process.env.PORT || 3000;
const REGION = process.env.REGION || 'local';
const MINP = +process.env.MINP || 2;
const MAXP = 50;
const PUB = path.join(__dirname, 'public');

const WP = [22, .11, 30, 130, .02], ZM = [2.4, 1, .75], TS = { solo: 1, duo: 2, squad: 4 };
const on = {}, rmOf = {}, party = {}, pOf = {}, rooms = {}, lobbies = {};
let nid = 0;

const send = (w, o) => { if (w && w.readyState == 1) w.send(JSON.stringify(o)); };
const to = (id, o) => send(on[id], o);
const rm = (a, x) => { const i = a.indexOf(x); if (i >= 0) a.splice(i, 1); };
const rnd = (a, b) => a + Math.random() * (b - a);
const U = id => DB.U(id);

const pub = id => {
  const u = U(id);
  return u && { id, name: u.name, lvl: 1 + Math.floor((u.st && u.st.xp || 0) / 100), on: !!on[id], st: !on[id] ? 'offline' : rmOf[id] ? 'jogando' : 'online', badge: !!u.badge };
};
const me = id => {
  const u = U(id);
  if (!u) return { t: 'me', id };
  return { t: 'me', id, name: u.name, st: u.st, hist: (u.hist || []).slice(-10), fr: (u.fr || []).map(pub), rin: (u.rin || []).map(pub), rout: (u.rout || []).map(pub), bl: u.bl || [], priv: u.priv || {}, diamonds: u.diamonds || 0, inv: u.inv || [], unlocked: u.unlocked || [], badge: !!u.badge, admin: !!u.admin, sessions: (u.sessions || []).map(s => ({ token: s.token, at: s.at, exp: s.exp })) };
};
const refresh = id => to(id, me(id));
const refF = id => { refresh(id); const u = U(id); if (u) (u.fr || []).forEach(f => on[f] && refresh(f)); };
const pv = p => ({ id: p.id, lead: p.lead, mode: p.mode, m: p.m.map(pub) });
const pq = p => p.m.forEach(i => to(i, { t: 'party', p: pv(p) }));

function leaveP(id) { const p = party[pOf[id]]; if (!p) return; rm(p.m, id); delete pOf[id]; to(id, { t: 'party', p: null }); if (!p.m.length) delete party[p.id]; else { if (p.lead == id) p.lead = p.m[0]; pq(p); } }
function autoTeam(r, mode) { const c = {}; Object.values(r.pl).forEach(q => { if (String(q.team)[0] == 'a') c[q.team] = (c[q.team] || 0) + 1; }); for (const t in c) if (c[t] < TS[mode]) return t; return 'a' + (++nid); }
const alive = r => Object.values(r.pl).filter(p => p.alive);
function startMsg(r, id) { return { t: 'start', room: r.id, mode: r.mode, z: [r.zx, r.zz], pl: Object.values(r.pl).map(p => ({ id: p.id, name: p.name, team: p.team, x: p.x, z: p.z, look: on[p.id] && on[p.id].look })) }; }
function startRoom(r) { r.st = 'play'; r.t0 = Date.now(); r.zx = rnd(-60, 60); r.zz = rnd(-60, 60); const base = {}; for (const p of Object.values(r.pl)) { const b = base[p.team] || (base[p.team] = [rnd(-250, 250), rnd(-250, 250)]); p.x = b[0] + rnd(-5, 5); p.z = b[1] + rnd(-5, 5); p.lt = Date.now(); } Object.keys(r.pl).forEach(i => { to(i, startMsg(r, i)); to(i, { t: 'ice_left', n: (r.pl[i].items && r.pl[i].items.ice_wall) || 5 }); }); }
function resume(id) { const r = rooms[rmOf[id]]; if (r && r.st == 'play') { r.pl[id].dc = 0; to(id, startMsg(r, id)); } }
function die(r, q, k) { if (!q.alive) return; q.alive = 0; q.hp = 0; if (k) k.k++; const ts = new Set(alive(r).filter(p => p.team != q.team).map(p => p.team)); q.rank = ts.size + 1; Object.keys(r.pl).forEach(i => to(i, { t: 'kill', v: q.id, a: k && k.id })); to(q.id, { t: 'dead', rank: q.rank }); const t2 = new Set(alive(r).map(p => p.team)); if (t2.size <= 1) endRoom(r, [...t2][0]); }
async function endRoom(r, win) { if (r.st != 'play') return; r.st = 'end'; for (const p of Object.values(r.pl)) { const u = U(p.id), w = p.team == win; if (u) { u.st.g++; u.st.k += p.k; u.st.w += w ? 1 : 0; u.st.xp += 20 + p.k * 10 + (w ? 30 : 0); u.hist.push({ d: Date.now(), k: p.k, r: w ? 1 : p.rank || 2, m: r.mode }); await DB.saveUser(u); } to(p.id, { t: 'end', win: w, rank: w ? 1 : p.rank || 2, k: p.k }); } setTimeout(() => { Object.keys(r.pl).forEach(i => { delete rmOf[i]; refF(i); }); delete rooms[r.id]; }, 4000); }
function leaveRoom(id) { const r = rooms[rmOf[id]]; if (!r) return; if (r.st == 'wait') { delete r.pl[id]; delete rmOf[id]; if (!Object.keys(r.pl).length) delete rooms[r.id]; } else if (r.st == 'play') die(r, r.pl[id], null); }


function roomCode(){let c='';const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';for(let i=0;i<5;i++)c+=A[Math.floor(Math.random()*A.length)];return c}
function lobbyPub(L){return{code:L.code,name:L.name,n:L.m.length,max:L.max,pub:!!L.pub,st:L.st,lead:L.lead,hasPass:!!L.pass}}
function lobbyState(L){return{t:'lobby_state',code:L.code,name:L.name,max:L.max,pub:!!L.pub,st:L.st,lead:L.lead,hasPass:!!L.pass,m:L.m.map(id=>{const u=U(id);return{id,name:u?u.name:'?',lead:id===L.lead,badge:u&&!!u.badge}})}}
function broadcastLobby(L){L.m.forEach(id=>to(id,lobbyState(L)))}

const H = {
  async auth(ws, m) {
    let id = null;
    if (m.token) id = await DB.resolveToken(m.token);
    if (!id) {
      const n = String(m.name || '').trim().slice(0, 16), pw = String(m.pw || '');
      if (n.length < 3 || pw.length < 4) return send(ws, { t: 'err', e: 'Nome (3+) e senha (4+ caracteres)' });
      let e = await DB.getUserByName(n);
      if (!e) { e = await DB.createUser(n, pw); id = e.id; }
      else { if (crypto.scryptSync(pw, e.s, 32).toString('hex') != e.h) return send(ws, { t: 'err', e: 'Senha incorreta' }); id = e.id; }
      m.token = await DB.createToken(id, !!m.keep);
    } else if (m.keep) { await DB.revokeToken(m.token); m.token = await DB.createToken(id, true); }
    const uu = await DB.getUser(id);
    if (!uu) return send(ws, { t: 'err', e: 'Conta inválida' });
    DB.ensureFields(uu);
    if (uu.name === 'Sparky◇dono') { uu.admin = true; uu.badge = true; await DB.saveUser(uu); }
    if (on[id] && on[id] != ws) { const o = on[id]; o.id = null; ws.look = o.look; try { o.close(); } catch (_) {} }
    ws.id = id; on[id] = ws;
    send(ws, { t: 'authok', token: m.token, id, region: REGION, admin: !!uu.admin }); send(ws, { t: 'pzz_state', on: !!global.__pzz });
    refF(id); resume(id);
  },
  look(ws, m) { if (m.look && typeof m.look == 'object') ws.look = { skin: String(m.look.skin), hair: String(m.look.hair), hat: String(m.look.hat || ''), face: (m.look.face || []).slice(0, 4).map(String), back: String(m.look.back) }; },
  p(ws, m) { send(ws, { t: 'p', ts: m.ts, n: Object.keys(on).length }); },
  find(ws, m) { const q = String(m.q || '').toLowerCase().trim(); if (!q) return; const all = Object.values(DB.mem.u); send(ws, { t: 'found', r: all.filter(x => x.id != ws.id && (x.id == q || x.name.toLowerCase().includes(q)) && !(x.bl || []).includes(ws.id)).slice(0, 8).map(x => pub(x.id)) }); },
  prof(ws, m) { const u = U(m.id); if (u && !(u.bl || []).includes(ws.id)) send(ws, { t: 'prof', u: { id: u.id, name: u.name, xp: u.st.xp, g: u.st.g, k: u.st.k, w: u.st.w, badge: !!u.badge } }); },
  async fr_add(ws, m) { const a = U(ws.id), b = U(m.id); if (!b || b.id == a.id || a.fr.includes(b.id) || b.bl.includes(a.id) || a.rout.includes(b.id)) return; if (b.priv && b.priv.noreq) return send(ws, { t: 'err', e: 'Este jogador não aceita pedidos' }); if (a.rin.includes(b.id)) return H.fr_acc(ws, m); a.rout.push(b.id); b.rin.push(a.id); to(b.id, { t: 'note', k: 'req', from: pub(a.id) }); refresh(a.id); refresh(b.id); await DB.saveUser(a); await DB.saveUser(b); },
  async fr_acc(ws, m) { const a = U(ws.id), b = U(m.id); if (!b || !a.rin.includes(b.id)) return; rm(a.rin, b.id); rm(b.rout, a.id); a.fr.push(b.id); b.fr.push(a.id); refresh(a.id); refresh(b.id); await DB.saveUser(a); await DB.saveUser(b); },
  async fr_dec(ws, m) { const a = U(ws.id), b = U(m.id); if (!b) return; rm(a.rin, b.id); rm(b.rout, a.id); refresh(a.id); refresh(b.id); await DB.saveUser(a); await DB.saveUser(b); },
  async fr_cancel(ws, m) { const a = U(ws.id), b = U(m.id); if (!b) return; rm(a.rout, b.id); rm(b.rin, a.id); refresh(a.id); refresh(b.id); await DB.saveUser(a); await DB.saveUser(b); },
  async fr_rem(ws, m) { const a = U(ws.id), b = U(m.id); if (!b) return; rm(a.fr, b.id); rm(b.fr, a.id); refresh(a.id); refresh(b.id); await DB.saveUser(a); await DB.saveUser(b); },
  async block(ws, m) { const a = U(ws.id); if (!U(m.id) || a.bl.includes(m.id)) return; a.bl.push(m.id); H.fr_rem(ws, m); H.fr_dec(ws, m); H.fr_cancel(ws, m); await DB.saveUser(a); },
  async report(ws, m) { await DB.addReport({ by: ws.id, id: m.id, why: String(m.why || '').slice(0, 200), at: Date.now() }); send(ws, { t: 'note', k: 'info', txt: 'Denúncia enviada' }); },
  async priv(ws, m) { const u = U(ws.id); u.priv.noreq = !!m.noreq; await DB.saveUser(u); },
  chat(ws, m) { const a = U(ws.id), tx = String(m.text || '').slice(0, 200); if (!tx) return; let ids = []; if (m.sc == 'friend') { if (a.fr.includes(m.to)) ids = [m.to, a.id]; } else if (m.sc == 'party') { const p = party[pOf[ws.id]]; if (p) ids = p.m; } else { const r = rooms[rmOf[ws.id]]; if (r && r.pl[ws.id]) { const t = r.pl[ws.id].team; ids = Object.keys(r.pl).filter(i => m.sc == 'room' || r.pl[i].team == t); } } ids.forEach(i => { if (U(i) && (i == a.id || !(U(i).bl || []).includes(a.id))) to(i, { t: 'chat', sc: m.sc, from: { id: a.id, name: a.name }, text: tx, to: m.to }); }); },
  inv(ws, m) { const a = U(ws.id); if (!a.fr.includes(m.id) || !on[m.id] || rmOf[ws.id] || rmOf[m.id] || pOf[m.id]) return send(ws, { t: 'err', e: 'Amigo indisponível' }); let p = party[pOf[ws.id]]; if (!p) { p = party[ws.id] = { id: ws.id, lead: ws.id, mode: TS[m.mode] ? m.mode : 'duo', m: [ws.id] }; pOf[ws.id] = p.id; } if (p.m.length >= TS[p.mode]) return send(ws, { t: 'err', e: 'Equipe cheia' }); to(m.id, { t: 'inv', from: pub(ws.id), party: p.id }); send(ws, { t: 'note', k: 'info', txt: 'Convite enviado' }); pq(p); },
  inv_acc(ws, m) { const p = party[m.party]; if (!p || pOf[ws.id] || rmOf[ws.id] || p.m.length >= TS[p.mode]) return; p.m.push(ws.id); pOf[ws.id] = p.id; pq(p); },
  pmode(ws, m) { const p = party[pOf[ws.id]]; if (!p || p.lead != ws.id) return; if (TS[m.mode]) p.mode = m.mode; pq(p); },
  pleave(ws, m) { leaveP(ws.id); },
  join(ws, m) { if (rmOf[ws.id]) return; leaveP(ws.id); let r = Object.values(rooms).find(x => x.st == 'wait' && x.mode == (m.mode || 'solo') && Object.keys(x.pl).length < MAXP); if (!r) r = rooms[++nid] = { id: String(nid), st: 'wait', mode: m.mode || 'solo', pl: {}, at: 0 }; const team = autoTeam(r, r.mode); r.pl[ws.id] = { id: ws.id, name: U(ws.id).name, team, alive: 1, hp: 100, ar: 50, x: 0, y: 0, z: 0, yaw: 0, k: 0, am: WP[2], rl: 0, lf: 0, fl: 0, dc: 0, items: { ice_wall: 5 } }; rmOf[ws.id] = r.id; },
  leave(ws, m) { leaveRoom(ws.id); leaveP(ws.id); },
  mv(ws, m) { const r = rooms[rmOf[ws.id]], p = r && r.pl[ws.id]; if (!p || r.st != 'play' || !p.alive) return; const now = Date.now(); if (p.lt && now - p.lt < 30) return; const dx = m.x - p.x, dz = m.z - p.z; if (Math.hypot(dx, dz) > 18) { to(ws.id, { t: 'fix', x: p.x, z: p.z }); return; } p.x = m.x; p.y = m.y || 0; p.z = m.z; p.yaw = m.yaw || 0; p.fl = m.f || 0; p.lt = now; },
  sh(ws, m) { const r = rooms[rmOf[ws.id]], p = r && r.pl[ws.id]; if (!p || r.st != 'play' || !p.alive) return; const now = Date.now(); if (now < p.lf + WP[1] * 800 || p.rl || p.am <= 0) return; const o = (m.o || []).map(Number), d = (m.d || []).map(Number); if (o.length != 3 || d.length != 3 || [...o, ...d].some(v => !isFinite(v))) return; if (Math.hypot(o[0] - p.x, o[1] - p.y - 1.5, o[2] - p.z) > 8) return; const l = Math.hypot(...d); if (!l) return; p.lf = now; p.am--; if (p.am <= 0) p.rl = now + 1500; const sp = WP[4], dr = d.map(v => v / l + rnd(-1, 1) * sp), dl = Math.hypot(...dr), dir = dr.map(v => v / dl); let best = null, bt = 1e9; for (const q of Object.values(r.pl)) { if (!q.alive || q.team == p.team) continue; const toQ = [q.x - o[0], (q.y + 1) - o[1], q.z - o[2]]; const t = (toQ[0] * dir[0] + toQ[1] * dir[1] + toQ[2] * dir[2]); if (t < 0 || t > WP[3]) continue; const cx = o[0] + dir[0] * t - q.x, cy = o[1] + dir[1] * t - (q.y + 1), cz = o[2] + dir[2] * t - q.z; if (Math.hypot(cx, cy, cz) < 0.7 && t < bt) { bt = t; best = q; } } const e = o.map((v, i) => v + dir[i] * (best ? bt : 80)); Object.keys(r.pl).forEach(i => to(i, { t: 'tr', a: p.id, e })); if (best) { const hy = e[1] - best.y, hd = Math.hypot(e[0] - best.x, e[2] - best.z); const z = hy > 1.65 ? 0 : (hy < .85 || hd > .3) ? 2 : 1; let dmg = WP[0] * ZM[z] * (z == 0 && best.ar > 0 ? .6 : 1); const shown = dmg, a = Math.min(best.ar, dmg * .5); best.ar -= a; dmg -= a; best.hp -= dmg; Object.keys(r.pl).forEach(i => to(i, { t: 'hit', v: best.id, a: p.id, d: +shown.toFixed(1), z, hp: Math.max(0, best.hp), ar: best.ar, e })); if (best.hp <= 0) die(r, best, p); } },
  rl(ws, m) { const r = rooms[rmOf[ws.id]], p = r && r.pl[ws.id]; if (!p || !p.alive) return; p.rl = Date.now() + 1500; },
  async logout(ws, m) { if (m.all) await DB.revokeAllTokens(ws.id); else if (m.token) await DB.revokeToken(m.token); send(ws, { t: 'logout_ok' }); },
  async sessions(ws, m) { const u = U(ws.id); send(ws, { t: 'sessions', list: (u && u.sessions) || [] }); },
  async redeem(ws, m) { const code = String(m.code || '').trim(); if (!code) return send(ws, { t: 'err', e: 'Código vazio' }); const res = await DB.redeemCode(ws.id, code); if (!res.ok) return send(ws, { t: 'err', e: res.e }); send(ws, { t: 'redeem_ok', msg: res.msg, diamonds: res.diamonds, unlocked: res.unlocked, badge: res.badge }); refresh(ws.id); },
  shop_list(ws, m) { send(ws, { t: 'shop', items: [{id:'skin_gold',name:'Skin Dourada',desc:'Visual dourado brilhante',price:5000,type:'skin'},{id:'skin_shadow',name:'Skin Sombra',desc:'Visual escuro furtivo',price:4500,type:'skin'},{id:'skin_neon',name:'Skin Neon',desc:'Cores neon vibrantes',price:4800,type:'skin'},{id:'skin_camo',name:'Skin Camuflada',desc:'Padrão militar',price:3500,type:'skin'},{id:'hair_spiky',name:'Cabelo Espetado',desc:'Estilo rebelde',price:2000,type:'hair'},{id:'hair_long',name:'Cabelo Longo',desc:'Visual longo',price:1800,type:'hair'},{id:'hair_buzz',name:'Cabelo Raspado',desc:'Corte militar',price:1200,type:'hair'},{id:'hat_crown',name:'Coroa Real',desc:'Coroa dourada',price:8000,type:'hat'},{id:'hat_cap',name:'Boné Street',desc:'Boné casual',price:1500,type:'hat'},{id:'hat_helm',name:'Capacete Tático',desc:'Proteção visual',price:4000,type:'hat'},{id:'beard_short',name:'Barbinha Curta',desc:'Barba estilizada',price:3000,type:'face'},{id:'beard_full',name:'Barba Cheia',desc:'Barba completa',price:3200,type:'face'},{id:'face_scar',name:'Cicatriz',desc:'Marca de batalha',price:2500,type:'face'},{id:'back_cape',name:'Capa Real',desc:'Capa fluida',price:6000,type:'back'},{id:'back_pack',name:'Mochila Tática',desc:'Mochila de combate',price:2800,type:'back'},{id:'back_wings',name:'Asas Neon',desc:'Asas luminosas',price:9000,type:'back'},{id:'ice_wall',name:'Pacote Gelo x5',desc:'Recarga extra de gelo',price:1500,type:'item'},{id:'emote_win',name:'Emote Vitória',desc:'Animação de vitória',price:2200,type:'emote'},{id:'emote_wave',name:'Emote Aceno',desc:'Aceno amigável',price:1000,type:'emote'},{id:'trail_fire',name:'Rastro de Fogo',desc:'Efeito ao correr',price:5500,type:'trail'}] }); },
  async buy(ws, m) { const res = await DB.buyItem(ws.id, String(m.id || '')); if (!res.ok) return send(ws, { t: 'err', e: res.e }); send(ws, { t: 'buy_ok', id: res.id, diamonds: res.diamonds, unlocked: res.unlocked }); refresh(ws.id); },
  async adm_grant(ws, m) {
    const u = U(ws.id);
    if (!u || !u.admin) return send(ws, { t: 'err', e: 'Acesso negado' });
    const target = await DB.getUser(m.id);
    if (!target) return send(ws, { t: 'err', e: 'Jogador não encontrado' });
    const amt = +m.diamonds || 0;
    if (amt) {
      target.diamonds = (target.diamonds || 0) + amt;
      await DB.addReport({ by: ws.id, id: m.id, why: 'ADM grant diamonds ' + amt, at: Date.now() });
      to(m.id, { t: 'adm_notify', txt: 'Você recebeu ' + amt + ' diamantes!' });
    }
    if (m.item === 'badge_verify') {
      target.badge = true;
      await DB.addReport({ by: ws.id, id: m.id, why: 'ADM grant verified', at: Date.now() });
      to(m.id, { t: 'adm_notify', txt: 'Você recebeu o selo de verificado!' });
    } else if (m.item) {
      target.unlocked = target.unlocked || [];
      if (!target.unlocked.includes(m.item)) target.unlocked.push(m.item);
      target.inv = target.inv || [];
      if (!target.inv.includes(m.item)) target.inv.push(m.item);
      await DB.addReport({ by: ws.id, id: m.id, why: 'ADM grant item ' + m.item, at: Date.now() });
      to(m.id, { t: 'adm_notify', txt: 'Você recebeu: ' + m.item });
    }
    if (m.unlockAll) {
      const all = ['skin_gold','skin_shadow','skin_neon','skin_camo','hair_spiky','hair_long','hair_buzz','hat_crown','hat_cap','hat_helm','beard_short','beard_full','face_scar','back_cape','back_pack','back_wings','ice_wall','emote_win','emote_wave','trail_fire'];
      target.unlocked = Array.from(new Set([...(target.unlocked || []), ...all]));
      await DB.addReport({ by: ws.id, id: m.id, why: 'ADM unlockAll', at: Date.now() });
      to(m.id, { t: 'adm_notify', txt: 'ADM desbloqueou todos os itens para você!' });
    }
    await DB.saveUser(target);
    if (on[m.id]) refresh(m.id);
    send(ws, { t: 'adm_ok', msg: 'Ação aplicada' });
    refresh(ws.id);
  },
  async adm_list(ws, m) { const u = U(ws.id); if (!u || !u.admin) return send(ws, { t: 'err', e: 'Acesso negado' }); const list = await DB.listUsers(80); send(ws, { t: 'adm_list', players: list.map(x => ({ id: x.id, name: x.name, diamonds: x.diamonds || 0, badge: !!x.badge, admin: !!x.admin, online: !!on[x.id] })) }); },
  async adm_logs(ws, m) { const u = U(ws.id); if (!u || !u.admin) return send(ws, { t: 'err', e: 'Acesso negado' }); send(ws, { t: 'adm_logs', logs: await DB.getReports(40) }); },
  adm_pzz(ws, m) {
    const u = U(ws.id);
    if (!u || !u.admin) return send(ws, { t: 'err', e: 'Acesso negado' });
    global.__pzz = !!m.on;
    Object.keys(on).forEach(id => to(id, { t: 'pzz_state', on: global.__pzz }));
    send(ws, { t: 'adm_ok', msg: global.__pzz ? 'PZZ ativado' : 'PZZ desativado' });
  },
  use_item(ws, m) {
    const r = rooms[rmOf[ws.id]], p = r && r.pl[ws.id];
    if (!p || r.st != 'play' || !p.alive) return;
    if (String(m.item || '') !== 'ice_wall') return send(ws, { t: 'err', e: 'Item inválido' });
    p.items = p.items || { ice_wall: 5 };
    if (p.items.ice_wall <= 0) return send(ws, { t: 'err', e: 'Sem Parede de Gelo' });
    if (p.iceCd && Date.now() < p.iceCd) return send(ws, { t: 'err', e: 'Aguarde o recarga' });
    p.items.ice_wall--; p.iceCd = Date.now() + 8000;
    const yaw = p.yaw || 0, dist = 3.5;
    const wall = { id: 'w' + Date.now() + ws.id, x: p.x + Math.sin(yaw) * dist, z: p.z + Math.cos(yaw) * dist, yaw, owner: ws.id, hp: 120, exp: Date.now() + 12000 };
    r.walls = r.walls || []; r.walls.push(wall);
    Object.keys(r.pl).forEach(i => to(i, { t: 'wall', wall: { id: wall.id, x: wall.x, z: wall.z, yaw: wall.yaw, exp: wall.exp } }));
    to(ws.id, { t: 'ice_left', n: p.items.ice_wall });
  },

  room_create(ws, m) {
    if (rmOf[ws.id] || Object.values(lobbies).some(L => L.m.includes(ws.id))) return send(ws, { t: 'err', e: 'Já está em uma sala' });
    const name = String(m.name || 'Sala').trim().slice(0, 24) || 'Sala';
    const pass = String(m.pass || '').slice(0, 16);
    const pub = !!m.pub;
    const max = Math.min(MAXP, Math.max(2, +m.max || 10));
    let code; do { code = roomCode(); } while (lobbies[code]);
    const L = lobbies[code] = { code, name, pass, pub, max, lead: ws.id, m: [ws.id], st: 'wait' };
    send(ws, lobbyState(L));
  },
  room_join(ws, m) {
    if (rmOf[ws.id] || Object.values(lobbies).some(L => L.m.includes(ws.id))) return send(ws, { t: 'err', e: 'Já está em uma sala' });
    const code = String(m.code || '').toUpperCase().trim();
    const L = lobbies[code];
    if (!L) return send(ws, { t: 'err', e: 'Sala não encontrada' });
    if (L.st !== 'wait') return send(ws, { t: 'err', e: 'Partida já iniciada' });
    if (L.m.length >= L.max) return send(ws, { t: 'err', e: 'Sala cheia' });
    if (L.pass && L.pass !== String(m.pass || '')) return send(ws, { t: 'err', e: 'Senha incorreta' });
    L.m.push(ws.id);
    broadcastLobby(L);
  },
  room_leave(ws, m) {
    const L = Object.values(lobbies).find(x => x.m.includes(ws.id));
    if (!L) return;
    L.m = L.m.filter(id => id !== ws.id);
    if (!L.m.length) { delete lobbies[L.code]; return; }
    if (L.lead === ws.id) L.lead = L.m[0];
    send(ws, { t: 'lobby_state', code: null });
    broadcastLobby(L);
  },
  room_list(ws, m) {
    const list = Object.values(lobbies).filter(L => L.pub && L.st === 'wait').map(lobbyPub);
    send(ws, { t: 'room_list', list });
  },
  room_start(ws, m) {
    const L = Object.values(lobbies).find(x => x.m.includes(ws.id));
    if (!L || L.lead !== ws.id) return send(ws, { t: 'err', e: 'Só o líder inicia' });
    if (L.m.length < 1) return send(ws, { t: 'err', e: 'Sala vazia' });
    if (L.st !== 'wait') return;
    L.st = 'play';
    // create match room from lobby
    const rid = ++nid;
    const r = rooms[rid] = { id: String(rid), st: 'wait', mode: 'squad', pl: {}, at: 0, lobby: L.code };
    for (const id of L.m) {
      const team = autoTeam(r, r.mode);
      r.pl[id] = {
        id, name: (U(id) && U(id).name) || '?', team, alive: 1, hp: 100, ar: 50,
        x: 0, y: 0, z: 0, yaw: 0, k: 0, am: WP[2], rl: 0, lf: 0, fl: 0, dc: 0,
        items: { ice_wall: 5 }
      };
      rmOf[id] = r.id;
    }
    // force start immediately
    startRoom(r);
    broadcastLobby(L);
  }
};

setInterval(() => {
  const now = Date.now();
  for (const r of Object.values(rooms)) {
    const ids = Object.keys(r.pl);
    if (r.st == 'wait') {
      const n = ids.length;
      if (n >= MINP && !r.at) r.at = now + 15000;
      if (n < MINP) r.at = 0;
      ids.forEach(i => to(i, { t: 'lobby', n, max: MAXP, in: r.at ? Math.max(0, Math.ceil((r.at - now) / 1000)) : -1 }));
      if (n >= MAXP || (r.at && now >= r.at)) startRoom(r);
    } else if (r.st == 'play') {
      const t = (now - r.t0) / 1000, zr = Math.max(20, 300 - Math.max(0, t - 25) * 2.2);
      for (const p of Object.values(r.pl)) {
        if (!p.alive) continue;
        if (p.rl && now >= p.rl) { p.am = WP[2]; p.rl = 0; }
        if (Math.hypot(p.x - r.zx, p.z - r.zz) > zr) { p.hp -= 3 * .05; if (p.hp <= 0) die(r, p, null); }
        if (!on[p.id] && p.dc && now > p.dc + 30000) die(r, p, null);
      }
      if (r.walls) {
        const before = r.walls.length;
        r.walls = r.walls.filter(w => w.exp > now && w.hp > 0);
        if (r.walls.length !== before) ids.forEach(i => to(i, { t: 'walls', list: r.walls.map(w => ({ id: w.id, x: w.x, z: w.z, yaw: w.yaw, exp: w.exp })) }));
      }
      const pl = Object.values(r.pl).map(p => [p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), Math.round(p.hp), Math.round(p.ar), p.fl, p.am]);
      ids.forEach(i => to(i, { t: 'st', s: t, z: [r.zx, r.zz], p: pl }));
    }
  }
}, 50);

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0], f = path.join(PUB, path.normalize(u == '/' ? 'index.html' : u));
  if (!f.startsWith(PUB)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('404'); } r.writeHead(200, { 'Content-Type': (mime[path.extname(f)] || 'text/plain') + '; charset=utf-8' }); r.end(d); });
});
const wss = new WebSocketServer({ server: srv, maxPayload: 4096 });
wss.on('connection', ws => {
  ws.on('message', async d => {
    const n = Date.now() / 1000 | 0; if (ws.sec != n) { ws.sec = n; ws.c = 0; } if (++ws.c > 80) return;
    let m; try { m = JSON.parse(d); } catch (e) { return; }
    if (!m || typeof m.t != 'string' || !H.hasOwnProperty(m.t)) return;
    if (!ws.id && m.t != 'auth' && m.t != 'p') return;
    try { const ret = H[m.t](ws, m); if (ret && typeof ret.then === 'function') await ret; } catch (e) { console.error(e); }
  });
  ws.on('close', () => {
    const id = ws.id; if (!id || on[id] != ws) return; delete on[id];
    const r = rooms[rmOf[id]]; if (r) { if (r.st == 'wait') { delete r.pl[id]; delete rmOf[id]; if (!Object.keys(r.pl).length) delete rooms[r.id]; } else if (r.st == 'play') r.pl[id].dc = Date.now(); }
    leaveP(id); const u = U(id); if (u) (u.fr || []).forEach(f => on[f] && refresh(f));
  });
});

(async () => {
  const mode = await DB.init();
  srv.listen(PORT, () => console.log('Royale Online em :' + PORT + ' região=' + REGION + ' db=' + mode));
})();
