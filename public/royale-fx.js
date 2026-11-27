/**
 * Royale Online — efeitos visuais e sonoros (Parede de Gelo, armas, sons)
 * Carregado após o jogo principal. Usa variáveis globais: T, sc, P, ph, ONL, tx
 */
(() => {
  'use strict';

  // ---- Parede de Gelo (malhas 3D + colisão) ----
  const walls = {}; // id -> { mesh, exp, x, z, yaw }
  const WALL_W = 3.2, WALL_H = 2.4, WALL_D = 0.35;

  function iceMat() {
    const m = new T.MeshPhongMaterial({
      color: 0xa8e8ff,
      transparent: true,
      opacity: 0.55,
      shininess: 120,
      specular: 0xffffff,
      emissive: 0x1a3a55,
      emissiveIntensity: 0.15,
      side: T.DoubleSide,
      depthWrite: false
    });
    return m;
  }

  function mkIceWall(data) {
    const g = new T.Group();
    g.userData.wallId = data.id;

    // bloco principal
    const geo = new T.BoxGeometry(WALL_W, WALL_H, WALL_D);
    const mesh = new T.Mesh(geo, iceMat());
    mesh.position.y = WALL_H / 2;
    mesh.castShadow = false;
    g.add(mesh);

    // bordas brilhantes
    const edge = new T.Mesh(
      new T.BoxGeometry(WALL_W + 0.05, 0.08, WALL_D + 0.05),
      new T.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.85 })
    );
    edge.position.y = WALL_H;
    g.add(edge);

    // base
    const base = new T.Mesh(
      new T.BoxGeometry(WALL_W + 0.1, 0.12, WALL_D + 0.1),
      new T.MeshBasicMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.7 })
    );
    base.position.y = 0.06;
    g.add(base);

    // cristais laterais
    for (let i = 0; i < 4; i++) {
      const c = new T.Mesh(
        new T.ConeGeometry(0.12, 0.45, 5),
        new T.MeshPhongMaterial({ color: 0xc5f0ff, transparent: true, opacity: 0.7, shininess: 100 })
      );
      c.position.set((i % 2 ? 1 : -1) * (WALL_W / 2 - 0.2), 0.5 + (i > 1 ? 1.2 : 0), 0);
      g.add(c);
    }

    g.position.set(data.x, 0, data.z);
    g.rotation.y = data.yaw || 0;
    if (typeof sc !== 'undefined') sc.add(g);
    return g;
  }

  function addWall(data) {
    if (!data || !data.id) return;
    removeWall(data.id);
    const mesh = mkIceWall(data);
    walls[data.id] = { mesh, exp: data.exp || (Date.now() + 12000), x: data.x, z: data.z, yaw: data.yaw || 0 };
    // som de formação
    if (typeof snd === 'function') {
      try { snd(600, 0.15, 0.06, 'sine'); setTimeout(() => snd(400, 0.2, 0.05, 'triangle'), 80); } catch (e) {}
    }
  }

  function removeWall(id) {
    const w = walls[id];
    if (!w) return;
    if (w.mesh && w.mesh.parent) w.mesh.parent.remove(w.mesh);
    if (w.mesh) {
      w.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    }
    delete walls[id];
  }

  function syncWalls(list) {
    const ids = new Set((list || []).map(w => w.id));
    Object.keys(walls).forEach(id => { if (!ids.has(id)) removeWall(id); });
    (list || []).forEach(w => {
      if (!walls[w.id]) addWall(w);
      else {
        walls[w.id].exp = w.exp;
        walls[w.id].mesh.position.set(w.x, 0, w.z);
        walls[w.id].mesh.rotation.y = w.yaw || 0;
      }
    });
  }

  // Colisão AABB simplificada: impede atravessar a parede
  function wallBlock(nx, nz, px, pz) {
    for (const id in walls) {
      const w = walls[id];
      if (Date.now() > w.exp) { removeWall(id); continue; }
      // local space do jogador em relação à parede
      const cos = Math.cos(-w.yaw), sin = Math.sin(-w.yaw);
      const dx = nx - w.x, dz = nz - w.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const hw = WALL_W / 2 + 0.35, hd = WALL_D / 2 + 0.35;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
        // empurra para fora no eixo mais raso
        if (Math.abs(lx) / hw > Math.abs(lz) / hd) {
          const sx = Math.sign(lx) || 1;
          const outLx = sx * hw;
          return {
            x: w.x + outLx * cos + 0 * sin,
            z: w.z + outLx * (-sin) + 0 * cos
          };
        } else {
          const sz = Math.sign(lz) || 1;
          const outLz = sz * hd;
          return {
            x: w.x + 0 * cos + outLz * sin,
            z: w.z + 0 * (-sin) + outLz * cos
          };
        }
      }
    }
    return null;
  }

  // Expira paredes localmente
  setInterval(() => {
    const now = Date.now();
    Object.keys(walls).forEach(id => {
      if (walls[id].exp < now) removeWall(id);
    });
  }, 500);

  // Hook de movimento: se existir P global
  let _mvHooked = false;
  function hookMove() {
    if (_mvHooked || typeof P === 'undefined') return;
    _mvHooked = true;
    // intercepta atualização de posição do player local
    setInterval(() => {
      if (typeof ph !== 'undefined' && ph !== 'play') return;
      if (typeof P === 'undefined' || !P.alive) return;
      const blocked = wallBlock(P.x, P.z, P.x, P.z);
      if (blocked) {
        P.x = blocked.x;
        P.z = blocked.z;
        if (P.g) P.g.position.set(P.x, P.y || 0, P.z);
      }
    }, 16);
  }
  setInterval(hookMove, 1000);
  hookMove();

  // Botão de uso da Parede de Gelo
  function ensureIceBtn() {
    if (document.getElementById('bice')) return;
    const btn = document.createElement('button');
    btn.id = 'bice';
    btn.textContent = '🧊 GELO';
    btn.style.cssText = 'position:fixed;right:12px;bottom:200px;z-index:7;padding:10px 14px;border-radius:12px;border:2px solid #7dd3fc;background:#0c4a6e;color:#e0f2fe;font:700 13px system-ui;display:none;pointer-events:auto';
    btn.onclick = () => {
      if (typeof tx === 'function' && window.NETX && window.NETX.on) {
        tx({ t: 'use_item', item: 'ice_wall' });
      } else if (typeof tx === 'function') {
        tx({ t: 'use_item', item: 'ice_wall' });
      }
      try { snd(500, 0.1, 0.05, 'sine'); } catch (e) {}
    };
    document.body.appendChild(btn);
    setInterval(() => {
      const show = typeof ph !== 'undefined' && ph === 'play';
      btn.style.display = show ? 'block' : 'none';
    }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureIceBtn);
  else ensureIceBtn();

  // API global para net.js
  window.ROYALE_FX = {
    addWall,
    removeWall,
    syncWalls,
    wallBlock,
    walls
  };

  // ---- Sons por categoria de arma ----
  // Índices WP: 0 rifle, 1 smg, 2 sniper, 3 shotgun, 4 pistol
  const GUN_SND = [
    () => { snd(140, 0.09, 0.12, 'sawtooth'); setTimeout(() => snd(70, 0.12, 0.08, 'square'), 40); },
    () => { snd(380, 0.035, 0.09, 'square'); setTimeout(() => snd(420, 0.03, 0.06, 'square'), 25); },
    () => { snd(55, 0.28, 0.14, 'sawtooth'); setTimeout(() => snd(40, 0.35, 0.06, 'triangle'), 60); },
    () => { snd(90, 0.2, 0.13, 'sawtooth'); setTimeout(() => snd(50, 0.15, 0.08, 'square'), 50); },
    () => { snd(260, 0.06, 0.09, 'triangle'); setTimeout(() => snd(200, 0.05, 0.05, 'square'), 30); }
  ];

  // Sobrescreve wsnd se existir, preservando outros índices
  const _wsnd = typeof wsnd === 'function' ? wsnd : null;
  window.wsnd = function (i, k = 1) {
    // i==0 era tiro genérico — agora diferencia por P.wp
    if (i === 0 && typeof P !== 'undefined' && P.wp != null && GUN_SND[P.wp]) {
      try { GUN_SND[P.wp](); } catch (e) {}
      return;
    }
    if (_wsnd) return _wsnd(i, k);
    // fallback
    const s = [[220, .1, 'sawtooth'], [300, .06, 'square'], [90, .3, 'sawtooth'], [130, .18, 'sawtooth'], [400, .08, 'triangle']][i] || [220, .1, 'square'];
    if (typeof snd === 'function') snd(s[0], s[1], .1 * k, s[2]);
  };

  // ---- Diferenciação visual de armas (cores por tipo) ----
  const GUN_COLORS = [
    0x4b5563, // rifle cinza aço
    0x1e3a5f, // smg azul escuro
    0x3f3f46, // sniper preto fosco
    0x5c4033, // shotgun marrom
    0x6b7280  // pistol cinza claro
  ];
  const GUN_ACCENT = [
    0x22c55e, // rifle verde
    0x38bdf8, // smg ciano
    0xf59e0b, // sniper dourado
    0xef4444, // shotgun vermelho
    0xa78bfa  // pistol roxo
  ];

  function tintGun(entity, wpIdx) {
    if (!entity || !entity.g) return;
    const col = GUN_COLORS[wpIdx % GUN_COLORS.length];
    const acc = GUN_ACCENT[wpIdx % GUN_ACCENT.length];
    entity.g.traverse(o => {
      if (!o.isMesh || !o.material) return;
      // não altera pele/roupa (cores claras de personagem)
      const c = o.material.color;
      if (!c) return;
      const hex = c.getHex();
      // meshes escuros de arma (~0x333333 original)
      if (hex < 0x555555 || hex === 0x333333 || hex === 0x111114) {
        o.material = o.material.clone();
        o.material.color.setHex(col);
      }
    });
  }

  // Aplica quando arma muda
  let lastWp = -1;
  setInterval(() => {
    if (typeof P === 'undefined' || !P.g) return;
    if (P.wp !== lastWp) {
      lastWp = P.wp;
      if (P.wp >= 0) tintGun(P, P.wp);
    }
  }, 300);

  // Badge visual laranja para verificado (nome no HUD/chat é tratado no net.js)
  window.ROYALE_BADGE = ' <span style="color:#f97316;font-weight:900">✔</span>';

  console.log('[royale-fx] Parede de Gelo, sons e texturas de arma carregados');
})();
