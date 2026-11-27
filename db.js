/**
 * Camada de persistência Royale Online
 * - Com MONGODB_URI: usa MongoDB Atlas (produção)
 * - Sem URI: usa db.json (desenvolvimento local)
 * Migração automática e segura de db.json → Mongo na primeira conexão.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DBF = process.env.DB || path.join(__dirname, 'db.json');
const URI = process.env.MONGODB_URI || process.env.MONGO_URL || '';

let mode = 'json'; // 'json' | 'mongo'
let colUsers, colTok, colRep, colMeta;
let mem = { u: {}, tok: {}, rep: [], admins: [] };
let dirty = false;
let ready = false;

function defaultUser(id, name, s, h) {
  return {
    id, name, s, h,
    fr: [], rin: [], rout: [], bl: [],
    priv: {},
    st: { xp: 0, g: 0, k: 0, w: 0 },
    hist: [],
    diamonds: 0,
    inv: [],
    unlocked: [],
    redeemed: [],
    badge: false,
    admin: false,
    sessions: []
  };
}

function ensureFields(u) {
  if (!u) return u;
  u.diamonds = u.diamonds || 0;
  u.inv = u.inv || [];
  u.unlocked = u.unlocked || [];
  u.redeemed = u.redeemed || [];
  u.badge = !!u.badge;
  u.admin = !!u.admin;
  u.sessions = u.sessions || [];
  u.fr = u.fr || [];
  u.rin = u.rin || [];
  u.rout = u.rout || [];
  u.bl = u.bl || [];
  u.priv = u.priv || {};
  u.st = u.st || { xp: 0, g: 0, k: 0, w: 0 };
  u.hist = u.hist || [];
  return u;
}

/* ---------- JSON backend ---------- */
function loadJson() {
  try {
    const raw = JSON.parse(fs.readFileSync(DBF, 'utf8'));
    mem.u = raw.u || {};
    mem.tok = raw.tok || {};
    mem.rep = raw.rep || [];
    mem.admins = raw.admins || [];
    Object.values(mem.u).forEach(ensureFields);
  } catch (e) {
    mem = { u: {}, tok: {}, rep: [], admins: [] };
  }
}

function saveJson() {
  dirty = true;
}

function flushJson() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.writeFileSync(DBF, JSON.stringify({
      u: mem.u,
      tok: mem.tok,
      rep: mem.rep,
      admins: mem.admins
    }));
  } catch (e) {
    console.error('[db] falha ao gravar db.json', e.message);
  }
}

/* ---------- Mongo backend ---------- */
async function connectMongo() {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10
  });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'royale');
  colUsers = db.collection('users');
  colTok = db.collection('tokens');
  colRep = db.collection('reports');
  colMeta = db.collection('meta');

  // Índices
  await colUsers.createIndex({ id: 1 }, { unique: true });
  await colUsers.createIndex({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
  await colTok.createIndex({ token: 1 }, { unique: true });
  await colTok.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }); // TTL opcional se exp for Date
  await colTok.createIndex({ uid: 1 });

  // Migração de db.json se ainda não migrado
  const migrated = await colMeta.findOne({ _id: 'migrated_json' });
  if (!migrated && fs.existsSync(DBF)) {
    console.log('[db] Migrando db.json → MongoDB…');
    loadJson();
    const ops = [];
    for (const u of Object.values(mem.u)) {
      ensureFields(u);
      if (u.name === 'Sparky◇dono') {
        u.admin = true;
        u.badge = true;
      }
      ops.push({
        updateOne: {
          filter: { id: u.id },
          update: { $setOnInsert: u },
          upsert: true
        }
      });
    }
    if (ops.length) await colUsers.bulkWrite(ops, { ordered: false });
    for (const [token, val] of Object.entries(mem.tok)) {
      const uid = typeof val === 'object' ? val.id : val;
      const exp = typeof val === 'object' && val.exp ? val.exp : Date.now() + 7 * 864e5;
      try {
        await colTok.updateOne(
          { token },
          { $setOnInsert: { token, uid, exp } },
          { upsert: true }
        );
      } catch (_) {}
    }
    if (mem.rep.length) {
      await colRep.insertMany(mem.rep.map(r => ({ ...r, _id: undefined })), { ordered: false }).catch(() => {});
    }
    await colMeta.updateOne(
      { _id: 'migrated_json' },
      { $set: { at: new Date(), count: Object.keys(mem.u).length } },
      { upsert: true }
    );
    console.log('[db] Migração concluída:', Object.keys(mem.u).length, 'contas');
  }

  // Cache leve em memória dos usuários online / quentes
  mem.u = {};
  mem.tok = {};
  mode = 'mongo';
  console.log('[db] MongoDB conectado');
}

/* ---------- API pública ---------- */
async function init() {
  if (URI) {
    try {
      await connectMongo();
    } catch (e) {
      console.error('[db] MongoDB falhou, usando JSON:', e.message);
      loadJson();
      mode = 'json';
      setInterval(flushJson, 5000);
    }
  } else {
    loadJson();
    mode = 'json';
    setInterval(flushJson, 5000);
    console.log('[db] Modo JSON local (defina MONGODB_URI para Atlas)');
  }
  ready = true;
  return mode;
}

function U(id) {
  return mem.u[id] || null;
}

async function getUser(id) {
  if (mem.u[id]) return mem.u[id];
  if (mode === 'mongo') {
    const u = await colUsers.findOne({ id });
    if (u) {
      delete u._id;
      mem.u[id] = ensureFields(u);
      return mem.u[id];
    }
  }
  return null;
}

async function getUserByName(name) {
  const lower = name.toLowerCase();
  for (const u of Object.values(mem.u)) {
    if (u.name.toLowerCase() === lower) return u;
  }
  if (mode === 'mongo') {
    const u = await colUsers.findOne({ name: { $regex: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    if (u) {
      delete u._id;
      mem.u[u.id] = ensureFields(u);
      return mem.u[u.id];
    }
  }
  return null;
}

async function saveUser(u) {
  ensureFields(u);
  mem.u[u.id] = u;
  if (mode === 'mongo') {
    const copy = { ...u };
    delete copy._id;
    await colUsers.updateOne({ id: u.id }, { $set: copy }, { upsert: true });
  } else {
    saveJson();
  }
}

async function createUser(name, pw) {
  let id;
  do {
    id = String(100000 + Math.floor(Math.random() * 900000));
  } while (await getUser(id));
  const s = crypto.randomBytes(8).toString('hex');
  const h = crypto.scryptSync(pw, s, 32).toString('hex');
  const u = defaultUser(id, name, s, h);
  if (name === 'Sparky◇dono') {
    u.admin = true;
    u.badge = true;
  }
  await saveUser(u);
  return u;
}

/** Tokens */
async function createToken(uid, keep) {
  const token = crypto.randomBytes(24).toString('hex');
  const exp = Date.now() + (keep ? 30 : 7) * 864e5;
  mem.tok[token] = { id: uid, exp };
  if (mode === 'mongo') {
    await colTok.insertOne({ token, uid, exp });
  } else {
    saveJson();
  }
  // registra sessão no usuário
  const u = await getUser(uid);
  if (u) {
    u.sessions = (u.sessions || []).filter(s => s.exp > Date.now()).slice(-9);
    u.sessions.push({ token: token.slice(0, 8), exp, at: Date.now() });
    await saveUser(u);
  }
  return token;
}

async function resolveToken(token) {
  if (!token) return null;
  let tk = mem.tok[token];
  if (!tk && mode === 'mongo') {
    const doc = await colTok.findOne({ token });
    if (doc) {
      tk = { id: doc.uid, exp: doc.exp };
      mem.tok[token] = tk;
    }
  }
  if (!tk) return null;
  if (typeof tk === 'object') {
    if (tk.exp && tk.exp < Date.now()) {
      await revokeToken(token);
      return null;
    }
    return tk.id;
  }
  return tk;
}

async function revokeToken(token) {
  delete mem.tok[token];
  if (mode === 'mongo') {
    await colTok.deleteOne({ token });
  } else {
    saveJson();
  }
}

async function revokeAllTokens(uid) {
  for (const [t, v] of Object.entries(mem.tok)) {
    const id = typeof v === 'object' ? v.id : v;
    if (id === uid) delete mem.tok[t];
  }
  if (mode === 'mongo') {
    await colTok.deleteMany({ uid });
  } else {
    saveJson();
  }
  const u = await getUser(uid);
  if (u) {
    u.sessions = [];
    await saveUser(u);
  }
}

/** Resgate atômico */
async function redeemCode(uid, code) {
  const codes = {
    dimas198xz: { diamonds: 20000, msg: '+20.000 diamantes!' },
    ffzzx77: { unlock: 'beard_short', msg: 'Barbinha curta desbloqueada!' },
    Adm778: { badge: true, msg: 'Selo de verificação permanente!' }
  };
  const reward = codes[code];
  if (!reward) return { ok: false, e: 'Código inválido' };

  if (mode === 'mongo') {
    const filter = { id: uid, redeemed: { $ne: code } };
    const update = { $addToSet: { redeemed: code } };
    if (reward.diamonds) update.$inc = { diamonds: reward.diamonds };
    if (reward.unlock) update.$addToSet.unlocked = reward.unlock;
    if (reward.badge) update.$set = { ...(update.$set || {}), badge: true };
    // unlocked precisa de $addToSet separado se já tiver $addToSet.redeemed
    const res = await colUsers.findOneAndUpdate(filter, update, { returnDocument: 'after' });
    if (!res) {
      // já usado ou usuário inexistente
      const u = await getUser(uid);
      if (!u) return { ok: false, e: 'Conta inválida' };
      if ((u.redeemed || []).includes(code)) return { ok: false, e: 'Este código já foi usado nesta conta' };
      return { ok: false, e: 'Falha no resgate' };
    }
    const u = ensureFields(res);
    delete u._id;
    mem.u[uid] = u;
    // se unlock não entrou no update combinado, corrige
    if (reward.unlock && !(u.unlocked || []).includes(reward.unlock)) {
      u.unlocked.push(reward.unlock);
      await colUsers.updateOne({ id: uid }, { $addToSet: { unlocked: reward.unlock } });
    }
    return { ok: true, msg: reward.msg, diamonds: u.diamonds, unlocked: u.unlocked, badge: u.badge };
  }

  // JSON
  const u = mem.u[uid];
  if (!u) return { ok: false, e: 'Conta inválida' };
  if ((u.redeemed || []).includes(code)) return { ok: false, e: 'Este código já foi usado nesta conta' };
  u.redeemed = u.redeemed || [];
  u.redeemed.push(code);
  if (reward.diamonds) u.diamonds = (u.diamonds || 0) + reward.diamonds;
  if (reward.unlock) {
    u.unlocked = u.unlocked || [];
    if (!u.unlocked.includes(reward.unlock)) u.unlocked.push(reward.unlock);
  }
  if (reward.badge) u.badge = true;
  saveJson();
  return { ok: true, msg: reward.msg, diamonds: u.diamonds, unlocked: u.unlocked, badge: u.badge };
}

/** Compra atômica */
async function buyItem(uid, itemId) {
  const catalog = {
    skin_gold: 5000,
    skin_shadow: 4500,
    skin_neon: 4800,
    skin_camo: 3500,
    hair_spiky: 2000,
    hair_long: 1800,
    hair_buzz: 1200,
    hat_crown: 8000,
    hat_cap: 1500,
    hat_helm: 4000,
    beard_short: 3000,
    beard_full: 3200,
    face_scar: 2500,
    back_cape: 6000,
    back_pack: 2800,
    back_wings: 9000,
    ice_wall: 1500,
    emote_win: 2200,
    emote_wave: 1000,
    trail_fire: 5500
  };
  const price = catalog[itemId];
  if (price == null) return { ok: false, e: 'Item inválido' };

  if (mode === 'mongo') {
    const res = await colUsers.findOneAndUpdate(
      { id: uid, diamonds: { $gte: price }, unlocked: { $ne: itemId } },
      { $inc: { diamonds: -price }, $addToSet: { unlocked: itemId, inv: itemId } },
      { returnDocument: 'after' }
    );
    if (!res) {
      const u = await getUser(uid);
      if (!u) return { ok: false, e: 'Conta inválida' };
      if ((u.unlocked || []).includes(itemId)) return { ok: false, e: 'Você já possui este item' };
      if ((u.diamonds || 0) < price) return { ok: false, e: 'Diamantes insuficientes' };
      return { ok: false, e: 'Falha na compra' };
    }
    const u = ensureFields(res);
    delete u._id;
    mem.u[uid] = u;
    return { ok: true, id: itemId, diamonds: u.diamonds, unlocked: u.unlocked };
  }

  const u = mem.u[uid];
  if (!u) return { ok: false, e: 'Conta inválida' };
  if ((u.unlocked || []).includes(itemId)) return { ok: false, e: 'Você já possui este item' };
  if ((u.diamonds || 0) < price) return { ok: false, e: 'Diamantes insuficientes' };
  u.diamonds -= price;
  u.unlocked = u.unlocked || [];
  u.unlocked.push(itemId);
  u.inv = u.inv || [];
  if (!u.inv.includes(itemId)) u.inv.push(itemId);
  saveJson();
  return { ok: true, id: itemId, diamonds: u.diamonds, unlocked: u.unlocked };
}

async function listUsers(limit = 80) {
  if (mode === 'mongo') {
    const list = await colUsers.find({}).project({ _id: 0, h: 0, s: 0 }).limit(limit).toArray();
    return list.map(ensureFields);
  }
  return Object.values(mem.u).slice(0, limit);
}

async function addReport(r) {
  mem.rep = mem.rep || [];
  mem.rep.push(r);
  if (mode === 'mongo') {
    await colRep.insertOne({ ...r });
  } else {
    saveJson();
  }
}

async function getReports(limit = 40) {
  if (mode === 'mongo') {
    return await colRep.find({}).sort({ at: -1 }).limit(limit).toArray();
  }
  return (mem.rep || []).slice(-limit);
}

function getMode() { return mode; }
function isReady() { return ready; }

module.exports = {
  init, U, getUser, getUserByName, saveUser, createUser,
  createToken, resolveToken, revokeToken, revokeAllTokens,
  redeemCode, buyItem, listUsers, addReport, getReports,
  getMode, isReady, ensureFields, mem
};
