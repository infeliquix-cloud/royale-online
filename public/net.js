// Camada online do jogo. Carregada depois do jogo (usa suas variáveis globais).
(()=>{
const WS=(location.protocol=='https:'?'wss://':'ws://')+location.host,Q=s=>document.querySelector(s);
let ws,ME,tok=localStorage.getItem('tok'),ONL=0,RMt={},rtt=0,pty,logs={},cur=null,tab='fr',res=[],pfd=null,rc=0,cs='team',cnx='conectando...';
const tx=o=>ws&&ws.readyState==1&&ws.send(JSON.stringify(o)),esc=s=>String(s).replace(/[<>&"']/g,c=>'&#'+c.charCodeAt(0)+';');
const mkEl=h=>{const d=document.createElement('div');d.innerHTML=h;const e=d.firstElementChild;document.body.appendChild(e);return e};
const av=(u,s=32)=>`<i style="display:inline-flex;width:${s}px;height:${s}px;border-radius:50%;background:hsl(${u.id*47%360} 60% 45%);align-items:center;justify-content:center;font-style:normal;flex:none">${esc(u.name[0].toUpperCase())}</i>`;
const dc=s=>s=='offline'?'#777':s=='jogando'?'#f59e0b':'#4ade80',lb=s=>s=='offline'?'OFFLINE':s=='jogando'?'EM PARTIDA':'ONLINE';
const ord=a=>a.st=='offline'?2:a.st=='jogando'?1:0;
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:`#menu{overflow:auto;justify-content:flex-start;gap:5px}.mb{padding:8px 16px}#nb{position:fixed;top:8px;right:8px;display:flex;gap:6px;align-items:center;z-index:4;background:#0009;border-radius:20px;padding:4px 10px}#sd{position:fixed;right:8px;top:50px;width:150px;max-height:42vh;overflow:auto;background:#0009;border-radius:10px;padding:6px;z-index:4}.fr{display:flex;gap:6px;align-items:center;padding:5px;border-radius:8px;cursor:pointer}.fr:hover{background:#fff2}.dt{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}#fm,#lg,#ql{position:fixed;inset:0;background:#000b;z-index:8;display:none;align-items:center;justify-content:center}.bx{background:#101a2b;border:2px solid #3a5a86;border-radius:16px;width:min(94vw,460px);max-height:86vh;overflow:auto;padding:12px}#nt{position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:12;display:flex;flex-direction:column;gap:6px}.tt{background:#14233f;border:2px solid #ffd23f;border-radius:12px;padding:8px 12px;animation:sl .3s}@keyframes sl{from{transform:translateY(-30px);opacity:0}}.ib2{background:#2d7ff9;color:#fff;border:0;border-radius:8px;padding:5px 9px;margin:2px;cursor:pointer;font:inherit}.ib2.r{background:#c22}.ib2.g{background:#16a34a}.rw{display:flex;gap:8px;align-items:center;background:#1b2740;border-radius:10px;padding:6px;margin:5px 0;flex-wrap:wrap}#pb{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:4;background:#0009;border-radius:20px;padding:4px 10px;display:none;gap:6px;align-items:center}#cb{position:fixed;left:8px;bottom:250px;width:240px;background:#000b;border-radius:10px;padding:6px;z-index:7;display:none;font-size:12px}#cl,.cl{max-height:120px;overflow:auto}.bx input,#cb input{background:#0b1220;color:#fff;border:2px solid #3a5a86;border-radius:8px;padding:7px;width:100%;margin:3px 0}#bt{position:fixed;left:12px;top:140px;z-index:6;display:none}`}));
const nb=mkEl('<div id=nb></div>'),sd=mkEl('<div id=sd></div>'),fm=mkEl('<div id=fm></div>'),nt=mkEl('<div id=nt></div>'),ql=mkEl('<div id=ql></div>'),lg=mkEl('<div id=lg></div>'),pb=mkEl('<div id=pb></div>'),cb=mkEl('<div id=cb></div>'),bt=mkEl('<button id=bt class="ib2" onclick="NET.cb()">💬</button>');
const toast=(h,ms=7000)=>{const t=document.createElement('div');t.className='tt';t.innerHTML=h;nt.appendChild(t);setTimeout(()=>t.remove(),ms)};
function top(){const q=rtt<60?'ótima':rtt<120?'boa':'ruim',c=rtt<60?'#4ade80':rtt<120?'#facc15':'#f87171';nb.innerHTML=`<span class=dt style="background:${ws&&ws.readyState==1?c:'#f87171'}"></span><small>${ws&&ws.readyState==1?rtt+'ms · '+q:cnx}</small><button class=ib2 onclick="NET.o()">👥${ME&&ME.rin.length?' '+ME.rin.length:''}</button><button class=ib2 onclick="NET.o('ch')">💬</button>`}
function side(){if(!ME)return;sd.innerHTML='<b>Amigos</b>'+[...ME.fr].sort((a,b)=>ord(a)-ord(b)).map(f=>`<div class=fr onclick="NET.pf('${f.id}')">${av(f,26)}<div style="flex:1;overflow:hidden;white-space:nowrap">${esc(f.name)}${f.badge?(' <span style="color:#f97316">✔</span>'):''}<br><small style="color:${dc(f.st)}">${f.st=='online'?'DISPONÍVEL':lb(f.st)}</small></div></div>`).join('')||'<br><small>Nenhum amigo ainda</small>';pb.innerHTML=pty?'👥 Equipe '+pty.m.map(m=>av(m,24)).join('')+`<button class="ib2 r" onclick="tx({t:'pleave'})">Sair</button>`:''}
const msgs=k=>(logs[k]||[]).slice(-30).map(m=>`<div><b>${esc(m.n)}:</b> ${esc(m.t)}</div>`).join('');
const cin=()=>`<input id=ci maxlength=200 placeholder="Mensagem..." onkeydown="event.stopPropagation();if(event.key=='Enter')NET.say()">`;
function rd(){if(!ME)return;let h=`<div class=bx><div style="display:flex;justify-content:space-between"><b>AMIGOS</b><button class="ib2 r" onclick="NET.x()">✕</button></div><div>${[['fr','Amigos'],['rq','Pedidos'+(ME.rin.length?' ('+ME.rin.length+')':'')],['sr','Buscar'],['ch','Chat'],['me','Perfil']].map(t=>`<button class=ib2 style="${tab==t[0]?'background:#ffd23f;color:#222':''}" onclick="NET.tb('${t[0]}')">${t[1]}</button>`).join('')}</div>`;
if(tab=='fr')h+=[...ME.fr].sort((a,b)=>ord(a)-ord(b)).map(f=>`<div class=rw>${av(f)}<div style="flex:1"><b>${esc(f.name)}</b> <small>#${f.id} · Nv ${f.lvl}</small><br><small style="color:${dc(f.st)}">● ${lb(f.st)}</small></div><button class=ib2 ${f.st=='online'?'':'disabled'} onclick="NET.inv('${f.id}')">CONVIDAR</button><button class=ib2 onclick="NET.ch('friend','${f.id}')">Chat</button><button class="ib2 r" onclick="NET.rem('${f.id}')">REMOVER</button></div>`).join('')||'<p>Sem amigos. Use Buscar para adicionar.</p>';
if(tab=='rq'){h+='<b>Recebidos</b>'+(ME.rin.map(f=>`<div class=rw>${av(f)}<div style="flex:1">${esc(f.name)} <small>#${f.id}</small></div><button class="ib2 g" onclick="tx({t:'fr_acc',id:'${f.id}'})">Aceitar</button><button class="ib2 r" onclick="tx({t:'fr_dec',id:'${f.id}'})">Recusar</button></div>`).join('')||'<p>Nenhum</p>');h+='<b>Enviados</b>'+(ME.rout.map(f=>`<div class=rw>${av(f)}<div style="flex:1">${esc(f.name)}</div><button class="ib2 r" onclick="tx({t:'fr_cancel',id:'${f.id}'})">Cancelar</button></div>`).join('')||'<p>Nenhum</p>')}
if(tab=='sr')h+=`<div style="display:flex;gap:4px"><input id=si placeholder="Nome ou ID" onkeydown="event.stopPropagation();if(event.key=='Enter')NET.find()"><button class=ib2 onclick="NET.find()">Buscar</button></div>`+res.map(f=>`<div class=rw>${av(f)}<div style="flex:1">${esc(f.name)} <small>#${f.id} · ${lb(f.st)}</small></div><button class="ib2 g" ${ME.fr.some(x=>x.id==f.id)||ME.rout.some(x=>x.id==f.id)?'disabled':''} onclick="tx({t:'fr_add',id:'${f.id}'})">ADICIONAR AMIGO</button></div>`).join('');
if(tab=='ch'){if(!cur)h+=(pty?`<button class=ib2 onclick="NET.ch('party')">Chat da equipe</button>`:'')+ME.fr.map(f=>`<button class=ib2 onclick="NET.ch('friend','${f.id}')">${esc(f.name)}</button>`).join('')+'<p><small>Escolha uma conversa</small></p>';else h+=`<div class=cl id=cmd>${msgs(cur.sc=='friend'?'f'+cur.to:'party')}</div>${cin()}<button class=ib2 onclick="NET.ch()">← Conversas</button>`}
if(tab=='pf'&&pfd){const f=ME.fr.find(x=>x.id==pfd.id)||pfd,s=pfd.s;h+=`<div style="text-align:center">${av(f,56)}<h3>${esc(f.name)}</h3>ID #${f.id} · Nv ${f.lvl||1+Math.floor((s?s.xp:0)/100)}<br><span style="color:${dc(f.st)}">● ${lb(f.st||'offline')}</span>${s?`<p>Partidas ${s.g} · Abates ${s.k} · Vitórias ${s.w}</p>`:''}</div><div style="text-align:center"><button class="ib2 g" ${f.st=='online'?'':'disabled'} onclick="NET.inv('${f.id}')">CONVIDAR PARA PARTIDA</button><button class=ib2 onclick="NET.ch('friend','${f.id}')">Chat</button><button class="ib2 r" onclick="NET.blk('${f.id}')">Bloquear</button><button class="ib2 r" onclick="NET.rep('${f.id}')">Denunciar</button><button class="ib2 r" onclick="NET.rem('${f.id}')">Remover</button></div>`}
if(tab=='me'){const s=ME.st;h+=`<div style="text-align:center">${av(ME,56)}<h3>${esc(ME.name)}</h3>ID #${ME.id}<br>Nível ${1+Math.floor(s.xp/100)} · XP ${s.xp}<p>Partidas ${s.g} · Abates ${s.k} · Vitórias ${s.w}</p></div><b>Histórico</b>`+(ME.hist.slice().reverse().map(x=>`<div class=rw>${new Date(x.d).toLocaleString()} · ${x.m} · #${x.r} · ${x.k} abates</div>`).join('')||'<p>Sem partidas</p>')+`<label><input type=checkbox style="width:auto" ${ME.priv.noreq?'checked':''} onchange="NET.pr(this.checked)"> Não receber pedidos de amizade</label><br><button class="ib2 r" onclick="NET.out()">Sair da conta</button>`}
fm.innerHTML=h+'</div>'}
const open=t=>{if(!ME)return lgShow();if(t)tab=t;fm.style.display='flex';rd()};
function lgShow(){lg.style.display='flex';lg.innerHTML=`<div class=bx><b>ENTRAR / CRIAR CONTA</b><input id=ln placeholder="Nome (3-16)" maxlength=16><input id=lp type=password placeholder="Senha (4+)" onkeydown="event.stopPropagation();if(event.key=='Enter')NET.login()"><button class="ib2 g" onclick="NET.login()">ENTRAR</button> <small>Nome novo = cria conta</small><div id=le style="color:#f87171"></div></div>`}
function startOnline(m){if(ONL&&ph=='play')return;clear();E=[P];ONL=1;mode_t=0;L=[];RMt={};const mn=m.pl.find(p=>p.id==ME.id)||{};Object.assign(P,{alive:1,hp:100,ar:50,wp:0,am:30,rs:999,gr:0,k:0,dm:0,skc:0,rl:0,cd:0,team:mn.team,x:mn.x,z:mn.z,y:0,vy:0,dt:0});P.g.visible=true;
for(const p of m.pl){if(p.id==ME.id)continue;const e=ent(0x888888,p.team,1);e.dummy=1;e.id=p.id;e.wp=0;e.x=e.tx=p.x;e.z=e.tz=p.z;e.ty=0;if(p.look)applyLook(e.g,p.look);E.push(e);RMt[p.id]=e}
alive=E.length;ZC={x:m.z[0],z:m.z[1]};zr=300;zt=0;mt=0;sc.background.set(0x8ecdf0);sc.fog.color.set(0x9fd3f5);LB.visible=false;['#menu','#shop','#end'].forEach(s=>Q(s).style.display='none');Q('#hud').style.display='block';Q('#tc').style.display='block';ql.style.display='none';fm.style.display='none';ph='play';pl.visible=false;zm.visible=true;bt.style.display='block'}
const H={
authok(m){tok=m.token;localStorage.setItem('tok',tok);lg.style.display='none';cnx='conectado';window.__admin=!!m.admin;tx({t:'look',look:SV.look});top()},
err(m){toast('⚠️ '+esc(m.e));if(!ME){tok=null;localStorage.removeItem('tok');lgShow();const e=Q('#le');if(e)e.textContent=m.e}},
me(m){ME=m;side();top();if(fm.style.display=='flex')rd()},
found(m){res=m.r;rd()},prof(m){pfd=Object.assign(pfd||{},m.u,{s:m.u});rd()},
note(m){if(m.k=='req')toast(`👥 <b>${esc(m.from.name)}</b> quer ser seu amigo <button class="ib2 g" onclick="tx({t:'fr_acc',id:'${m.from.id}'});this.closest('.tt').remove()">Aceitar</button><button class="ib2 r" onclick="tx({t:'fr_dec',id:'${m.from.id}'});this.closest('.tt').remove()">Recusar</button>`,12000);else toast(esc(m.txt))},
inv(m){toast(`📨 <b>${esc(m.from.name)}</b> convidou você para a equipe <button class="ib2 g" onclick="tx({t:'inv_acc',party:'${m.party}'});this.closest('.tt').remove()">Aceitar</button><button class="ib2 r" onclick="this.closest('.tt').remove()">Recusar</button>`,15000)},
party(m){pty=m.p;side()},
chat(m){const k=m.sc=='friend'?'f'+(m.from.id==ME.id?m.to:m.from.id):m.sc;(logs[k]=logs[k]||[]).push({n:m.from.name,t:m.text});if(ONL){const l=Q('#cl');if(l){l.innerHTML=msgs(cs);l.scrollTop=1e5}if(cb.style.display!='block')toast('💬 '+esc(m.from.name)+': '+esc(m.text),3000)}else if(fm.style.display=='flex'&&tab=='ch'&&cur&&(cur.sc=='friend'?'f'+cur.to:'party')==k){rd();const c=Q('#cmd');if(c)c.scrollTop=1e5}else if(m.from.id!=ME.id)toast('💬 '+esc(m.from.name)+': '+esc(m.text),4000)},
p(m){rtt=Date.now()-m.ts;top()},
logout_ok(m){tok=null;localStorage.removeItem('tok');ME=null;window.__admin=0;lgShow();toast('Saiu da conta')},lobby_state(m){window.__lobby=m.code?m:null;if(NET._renderLobby)NET._renderLobby(m)},
room_list(m){window.__rooms=m.list||[];if(NET._renderRooms)NET._renderRooms()},
ice_left(m){window.__ice=m.n;const el=document.getElementById('iceCnt');if(el)el.textContent=m.n;},
wall(m){if(window.ROYALE_FX&&m.wall)ROYALE_FX.addWall(m.wall)},
walls(m){if(window.ROYALE_FX)ROYALE_FX.syncWalls(m.list||[])},
redeem_ok(m){toast('✅ '+esc(m.msg||'Código resgatado!'));if(ME){ME.diamonds=m.diamonds;ME.unlocked=m.unlocked;ME.badge=m.badge}rd();side()},
buy_ok(m){toast('✅ Item comprado!');if(ME){ME.diamonds=m.diamonds;ME.unlocked=m.unlocked;if(window.__shop)window.__shop._drawn=0}rd();const d=document.getElementById('shopDiam');if(d)d.textContent=(ME.diamonds||0)+' 💎';},
shop(m){window.__shop=m.items;rd()},
adm_ok(m){toast('✅ '+esc(m.msg||'OK'))},
adm_list(m){window.__admPlayers=m.players;rd()},
adm_logs(m){window.__admLogs=m.logs;rd()},

lobby(m){ql.style.display='flex';ql.innerHTML=`<div class=bx style="text-align:center"><b>PROCURANDO PARTIDA…</b><p>Jogadores ${m.n}/${m.max}</p><p>${m.in>=0?'Começa em '+m.in+'s':'Aguardando mais jogadores (mín. 2)'}</p><button class="ib2 r" onclick="NET.cancel()">Cancelar</button></div>`},
start:startOnline,
st(m){if(!ONL)return;zt=m.s;ZC={x:m.z[0],z:m.z[1]};let n=0;for(const q of m.p){const[id,x,y,z,yaw,hp,ar,fl]=q;if(id==ME.id){P.hp=hp;P.ar=ar;if(hp>0)n++;continue}const e=RMt[id];if(!e)continue;e.tx=x;e.ty=y;e.tz=z;e.yaw=yaw;e.hp=hp;e.ar=ar;e.mv=fl&1?1:0;if(fl&16)e.cd=.15;if(e.alive&&hp>0)n++}alive=n},
fix(m){P.x=m.x;P.z=m.z},
tr(m){const e=m.a==ME.id?P:RMt[m.a];if(!e)return;if(e!=P)muz(e);line(new T.Vector3(e.x,e.y+1.4,e.z),new T.Vector3(...m.e))},
hit(m){const v=m.v==ME.id?P:RMt[m.v],a=m.a==ME.id?P:RMt[m.a];if(!v)return;v.hp=m.hp;v.ar=m.ar;if(a)fxHit(v,m.d,a,m.z,1);puff(new T.Vector3(...m.e),0xb0202a,4,2.5,.4,.07,9,0)},
kill(m){const v=m.v==ME.id?P:RMt[m.v];if(!v||!v.alive)return;v.alive=0;v.dt=0;if(m.a==ME.id&&v!=P){P.k++;killFx(v)}},
dead(m){P.alive=0;P.dt=0;endG()},
end(m){if(ONL&&ph!='end')endG();ONL=0;bt.style.display='none'}};
window.NETH=H;
function conn(){ws=new WebSocket(WS);ws.onopen=()=>{rc=0;cnx='conectado';tok?tx({t:'auth',token:tok}):lgShow();top()};ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}if(H[m.t])H[m.t](m)};ws.onclose=()=>{cnx='reconectando...';top();setTimeout(conn,Math.min(5000,1000*++rc))}}
// Substituições: online, dano e vida vêm do servidor
const oh=hurt,op=pfire,orl=rel,otm=toMenu,on_=nade,os=skill,osv=svL;
hurt=function(o,d,by,z,pt){if(!ONL)oh(o,d,by,z,pt)};
pfire=function(){if(!ONL)return op();if(P.cd>0||P.rl>0||!P.alive)return;if(P.am<=0){rel();return}const w=WP[0];P.am--;P.cd=w[2];pitch-=w[6];wsnd(0);muz(P);const o=cam.position,d=new T.Vector3();cam.getWorldDirection(d);tx({t:'sh',o:[o.x,o.y,o.z],d:[d.x,d.y,d.z]})};
rel=function(){orl();if(ONL&&P.rl>0)tx({t:'rl'})};
toMenu=function(){if(ONL){tx({t:'leave'});ONL=0}bt.style.display='none';cb.style.display='none';otm()};
nade=function(){if(!ONL)on_()};skill=function(){if(!ONL)os()};
svL=function(i){osv(i);tx({t:'look',look:SV.look})};
bnd('#bx',()=>toMenu());bnd('#bre',()=>rel());bnd('#bg',()=>nade());bnd('#bq',()=>skill());
setInterval(()=>{if(ONL&&ph=='play')tx({t:'mv',x:P.x,y:P.y,z:P.z,yaw,f:(Math.hypot(jx,jy)>.1?1:0)|(run?2:0)|(crh?4:0)|(aim?8:0)|(fire?16:0)})},50);
setInterval(()=>{if(!ONL)return;for(const id in RMt){const e=RMt[id];if(!e.alive)continue;e.x+=(e.tx-e.x)*.3;e.y+=(e.ty-e.y)*.3;e.z+=(e.tz-e.z)*.3;e.cd=Math.max(0,e.cd-.016)}},16);
setInterval(()=>{tx({t:'p',ts:Date.now()});const m=ph=='menu';nb.style.display=m?'flex':'none';sd.style.display=m&&ME?'block':'none';pb.style.display=m&&pty?'flex':'none'},2000);
setInterval(()=>{const m=ph=='menu';nb.style.display=m?'flex':'none';sd.style.display=m&&ME?'block':'none';pb.style.display=m&&pty?'flex':'none'},300);
// botões no menu
const ob=document.createElement('button');ob.className='mb';ob.style.borderColor='#4ade80';ob.textContent='🎮 SALINHAS';ob.onclick=()=>NET.salinhas();Q('#menu').insertBefore(ob,Q('#menu .go'));
const fb=document.createElement('button');fb.className='mb';fb.textContent='👥 AMIGOS';fb.onclick=()=>NET.o();Q('#menu').insertBefore(fb,Q('#menu .go'));
const sb=document.createElement('button');sb.className='mb';sb.textContent='💎 LOJA';sb.onclick=()=>NET.shop();Q('#menu').insertBefore(sb,Q('#menu .go'));
const rb=document.createElement('button');rb.className='mb';rb.textContent='🎫 RESGATAR';rb.onclick=()=>NET.redeem();Q('#menu').insertBefore(rb,Q('#menu .go'));
const xb=document.createElement('button');xb.className='mb';xb.textContent='SAIR';xb.onclick=()=>{if(window.NET&&NET.logout)NET.logout()};Q('#menu').insertBefore(xb,Q('#menu .go'));
const ab=document.createElement('button');ab.className='mb';ab.id='admBtn';ab.textContent='👑 ADM';ab.style.display='none';ab.style.borderColor='#ffd700';ab.onclick=()=>NET.adm();Q('#menu').insertBefore(ab,Q('#menu .go'));
setInterval(()=>{const b=Q('#admBtn');if(b)b.style.display=(window.__admin||(ME&&ME.admin))?'block':'none'},2000);

window.NET={tx,o:open,x:()=>{fm.style.display='none'},tb:t=>{tab=t;cur=null;rd()},q:()=>{if(!ME)return lgShow();tx({t:'join',mode})},cancel:()=>{tx({t:'leave'});ql.style.display='none'},
login:()=>{const keep=!!(Q('#lk')&&Q('#lk').checked);tx({t:'auth',name:Q('#ln').value,pw:Q('#lp').value,keep})},find:()=>{tx({t:'find',q:Q('#si').value})},
inv:id=>tx({t:'inv',id,mode:mode=='solo'?'duo':mode}),rem:id=>{if(confirm('Remover amigo?'))tx({t:'fr_rem',id})},blk:id=>{if(confirm('Bloquear?'))tx({t:'block',id})},rep:id=>{const w=prompt('Motivo da denúncia?');if(w)tx({t:'report',id,why:w})},
pr:v=>tx({t:'priv',noreq:v}),out:()=>{localStorage.removeItem('tok');location.reload()},
pf:id=>{pfd={id};tab='pf';tx({t:'prof',id});open('pf')},ch:(sc,to)=>{cur=sc?{sc,to}:null;tab='ch';rd();const c=Q('#cmd');if(c)c.scrollTop=1e5},
say:()=>{const i=Q('#ci'),v=i.value.trim();if(!v)return;const sc_=ONL?cs:cur.sc;tx({t:'chat',sc:sc_,to:cur&&cur.to,text:v});i.value=''},
cb:()=>{if(cb.style.display=='block'){cb.style.display='none';return}cb.innerHTML=`<button class=ib2 onclick="NET.cs('team')">Equipe</button><button class=ib2 onclick="NET.cs('room')">Sala</button><div id=cl></div>${cin()}`;cb.style.display='block';Q('#cl').innerHTML=msgs(cs)},
cs:s=>{cs=s;Q('#cl').innerHTML=msgs(cs)},
shop:()=>{tab='shop';tx({t:'shop_list'});if(NET._openShop)NET._openShop();},
salinhas:()=>{if(!ME)return lgShow();tab='salinhas';tx({t:'room_list'});if(NET._openSalinhas)NET._openSalinhas();},
roomCreate:()=>{const name=(Q('#rname')&&Q('#rname').value)||'Sala';const pass=(Q('#rpass')&&Q('#rpass').value)||'';const pub=!(Q('#rpriv')&&Q('#rpriv').checked);const max=Math.min(50,Math.max(2,+(Q('#rmax')&&Q('#rmax').value)||10));tx({t:'room_create',name,pass,pub,max});},
roomJoinCode:()=>{const code=((Q('#jcode')&&Q('#jcode').value)||'').toUpperCase().trim();const pass=(Q('#jpass')&&Q('#jpass').value)||'';if(!code)return toast('Digite o código');tx({t:'room_join',code,pass});},
roomJoin:(code)=>tx({t:'room_join',code:String(code||'').toUpperCase()}),
roomLeave:()=>tx({t:'room_leave'}),
roomStart:()=>tx({t:'room_start'}),
roomRefresh:()=>tx({t:'room_list'}),

redeem:()=>{tab='redeem';if(NET._openRedeem)NET._openRedeem();else{const e=Q('#redeemUI');if(e)e.style.display='flex';}},
adm:()=>{if(!(window.__admin||(ME&&ME.admin)))return toast('Acesso negado');tab='adm';tx({t:'adm_list'});open('adm')},
doRedeem:()=>{const i=Q('#rcode');if(!i||!i.value.trim())return;tx({t:'redeem',code:i.value.trim()});i.value=''},
closeRedeem:()=>{tab='menu';const e=Q('#redeemUI');if(e)e.style.display='none';},closeShop:()=>{tab='menu';const a=Q('#shopNew');if(a)a.style.display='none';const b=Q('#shopUI');if(b)b.style.display='none';const c=Q('#shop');if(c)c.style.display='none';},closeAdm:()=>{tab='menu';const e=Q('#admUI');if(e)e.style.display='none';},
logout:()=>{tx({t:'logout',token:tok,all:1});tok=null;localStorage.removeItem('tok');ME=null;lgShow();},
doBuy:(id)=>{if(!id)return;tx({t:'buy',id});},
admGrant:()=>{const id=Q('#aid').value.trim(),d=+Q('#adim').value||0,item=Q('#aitem').value.trim();tx({t:'adm_grant',id,diamonds:d,item:item||undefined,unlockAll:!!Q('#aall').checked})}
};
window.jumpOnline=()=>{if(ONL)tx({t:"jp"})};window.NETX={get on(){return ONL},set on(v){ONL=v},get rm(){return RMt},set rm(v){RMt=v},get pty(){return pty},tx};window.getME=()=>ME;window.tx=tx;top();conn();

// UI extra: loja, resgate, ADM
const shopUI=mkEl('<div id=shopUI style="display:none;position:fixed;inset:0;background:#000c;z-index:20;align-items:center;justify-content:center"><div class=bx style="max-width:420px"><b>💎 LOJA</b><div id=shopList></div><p style="color:#ffd700" id=diamLabel></p><button class=ib2 onclick="NET.closeShop()">Fechar</button></div></div>');
const redeemUI=mkEl('<div id=redeemUI style="display:none;position:fixed;inset:0;background:#000c;z-index:20;align-items:center;justify-content:center"><div class=bx><b>🎫 RESGATAR CÓDIGO</b><input id=rcode placeholder="Digite o código" maxlength=32><button class="ib2 g" onclick="NET.doRedeem()">Resgatar</button><button class=ib2 onclick="NET.closeRedeem()">Fechar</button></div></div>');
const admUI=mkEl('<div id=admUI style="display:none;position:fixed;inset:0;background:#0a0a0f;z-index:25;align-items:center;justify-content:center"><div class=bx style="border-color:#ffd700;max-width:520px;background:#111"><b style="color:#ffd700">👑 PAINEL ADM — Sparky◇dono</b><div id=admPlayers style="max-height:180px;overflow:auto;margin:8px 0"></div><hr style="border-color:#333"><input id=aid placeholder="ID do jogador"><input id=adim type=number placeholder="Diamantes"><input id=aitem placeholder="Item (ex: beard_short)"><label style="display:block;margin:6px 0"><input type=checkbox id=aall> Desbloquear todos os itens</label><button class="ib2 g" onclick="NET.admGrant()">Aplicar</button><button class=ib2 onclick="tx({t:\'adm_logs\'})">Ver logs</button><button class=ib2 onclick="Q(\'#admUI\').style.display=\'none\'">Fechar</button><div id=admLogBox style="font-size:11px;max-height:100px;overflow:auto;margin-top:8px;color:#aaa"></div></div></div>');
const _oldOpen = window.open || (()=>{});
// Override open for new tabs
const origOpen = (typeof open==='function' && open.toString().includes('tab')) ? open : null;
NET._openShop=()=>{const ns=Q('#shop');if(ns)ns.style.display='none';const el=Q('#shopUI');el.style.display='flex';const list=Q('#shopList');const items=window.__shop||[];list.innerHTML=items.map(it=>`<div class=rw><b>${esc(it.name)}</b> · ${it.price} 💎 <button class="ib2 g" onclick="NET.doBuy('${it.id}')">Comprar</button></div>`).join('')||'Carregando...';Q('#diamLabel').textContent='Seus diamantes: '+(ME&&ME.diamonds||0)};
NET._openRedeem=()=>{const e=Q('#redeemUI');if(e){e.style.cssText='display:flex;position:fixed;inset:0;background:#000c;z-index:20;align-items:center;justify-content:center';}};
NET._openAdm=()=>{Q('#admUI').style.display='flex';const pl=window.__admPlayers||[];Q('#admPlayers').innerHTML=pl.map(p=>`<div class=rw>${esc(p.name)} (${p.id}) · ${p.diamonds}💎 ${p.badge?'✓':''} ${p.online?'🟢':'⚫'}</div>`).join('')||'Carregando...'};
// Hook into existing open if possible by watching tab
const _rd = typeof rd==='function'?rd:null;
setInterval(()=>{
  if(window.__admLogs && Q('#admLogBox')){Q('#admLogBox').innerHTML=window.__admLogs.map(l=>`<div>${new Date(l.at).toLocaleString()} — ${esc(l.why||'')}</div>`).join('');window.__admLogs=null}
},500);


// carrega efeitos (parede de gelo, sons, armas)
(function(){const s=document.createElement('script');s.src='royale-fx.js';s.async=false;document.body.appendChild(s);})();
})();



// ===== FFZINH UI v2: Salinhas, Gelo, ADM, LZZ/PZZ =====
(function () {
  function esc(s) {
    return String(s).replace(/[<>&"']/g, function (c) {
      return '&#' + c.charCodeAt(0) + ';';
    });
  }
  function el(id) { return document.getElementById(id); }
  function showOverlay(node) {
    if (!node) return;
    node.style.display = 'flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
  }
  function hideOverlay(node) {
    if (node) node.style.display = 'none';
  }

  // ----- Salinhas -----
  var sal = document.createElement('div');
  sal.id = 'salinhasUI';
  sal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:40;align-items:center;justify-content:center;padding:10px';
  sal.innerHTML =
    '<div class="bx" style="max-width:480px;width:100%;max-height:90vh;overflow:auto">' +
    '<b style="font-size:17px">SALINHAS</b>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0">' +
    '<button type="button" class="ib2" id="szTabC">Criar</button>' +
    '<button type="button" class="ib2" id="szTabJ">Código</button>' +
    '<button type="button" class="ib2" id="szTabP">Públicas</button>' +
    '<button type="button" class="ib2 r" id="szClose">Fechar</button>' +
    '</div><div id="szBody"></div></div>';
  document.body.appendChild(sal);

  function szBody(html) {
    var b = el('szBody');
    if (b) b.innerHTML = html;
  }
  function viewCreate() {
    szBody(
      '<label>Nome da sala</label><input id="rname" maxlength="24" placeholder="Nome" value="Sala FFZINH">' +
      '<label>Senha (deixe vazio se não quiser)</label><input id="rpass" maxlength="16" placeholder="Opcional">' +
      '<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="rpriv"> Sala privada (não aparece na lista)</label>' +
      '<label>Limite de jogadores (2-50)</label><input id="rmax" type="number" min="2" max="50" value="10">' +
      '<button type="button" class="ib2 g" id="szDoCreate" style="width:100%;margin-top:8px">CRIAR SALINHA</button>'
    );
    var btn = el('szDoCreate');
    if (btn) btn.onclick = function () { if (window.NET && NET.roomCreate) NET.roomCreate(); };
  }
  function viewJoin() {
    szBody(
      '<label>Código da sala</label><input id="jcode" maxlength="8" placeholder="Ex: AB3K9" style="text-transform:uppercase">' +
      '<label>Senha (se a sala tiver)</label><input id="jpass" maxlength="16" placeholder="Senha">' +
      '<button type="button" class="ib2 g" id="szDoJoin" style="width:100%;margin-top:8px">ENTRAR</button>'
    );
    var btn = el('szDoJoin');
    if (btn) btn.onclick = function () { if (window.NET && NET.roomJoinCode) NET.roomJoinCode(); };
  }
  function viewPublic() {
    szBody('<button type="button" class="ib2" id="szRefresh">Atualizar lista</button><div id="roomListBox" style="margin-top:8px">Carregando...</div>');
    var r = el('szRefresh');
    if (r) r.onclick = function () { if (window.NET && NET.roomRefresh) NET.roomRefresh(); };
    if (window.NET && NET.roomRefresh) NET.roomRefresh();
  }
  el('szTabC').onclick = viewCreate;
  el('szTabJ').onclick = viewJoin;
  el('szTabP').onclick = viewPublic;
  el('szClose').onclick = function () { hideOverlay(sal); if (typeof tab !== 'undefined') tab = 'menu'; };

  window.NET = window.NET || {};
  NET._openSalinhas = function () {
    showOverlay(sal);
    viewCreate();
  };
  NET._renderRooms = function () {
    var box = el('roomListBox');
    if (!box) return;
    var list = window.__rooms || [];
    if (!list.length) {
      box.innerHTML = '<small>Nenhuma sala pública no momento. Toque em Atualizar.</small>';
      return;
    }
    box.innerHTML = list.map(function (r) {
      return '<div class="rw"><div style="flex:1"><b>' + esc(r.name) + '</b><br><small>' +
        esc(r.code) + ' · ' + r.n + '/' + r.max + (r.hasPass ? ' · com senha' : '') +
        '</small></div><button type="button" class="ib2 g" data-code="' + esc(r.code) + '">Entrar</button></div>';
    }).join('');
    box.querySelectorAll('button[data-code]').forEach(function (b) {
      b.onclick = function () {
        if (window.NET && NET.roomJoin) NET.roomJoin(b.getAttribute('data-code'));
      };
    });
  };
  NET._renderLobby = function (m) {
    if (!m || !m.code) {
      hideOverlay(sal);
      return;
    }
    showOverlay(sal);
    var members = (m.m || []).map(function (p) {
      return '<div class="rw">' + esc(p.name) +
        (p.badge ? ' <span style="color:#f97316">✔</span>' : '') +
        (p.lead ? ' (líder)' : '') + '</div>';
    }).join('');
    var isLead = window.ME && m.lead === ME.id;
    szBody(
      '<b>' + esc(m.name) + '</b><br><small>Código: <b>' + esc(m.code) + '</b></small>' +
      '<div style="margin:10px 0">' + (members || '...') + '</div>' +
      (isLead
        ? '<button type="button" class="ib2 g" id="szStart" style="width:100%">INICIAR PARTIDA</button>'
        : '<small>Aguardando o líder iniciar...</small>') +
      '<button type="button" class="ib2 r" id="szLeave" style="width:100%;margin-top:6px">Sair da sala</button>'
    );
    var st = el('szStart');
    if (st) st.onclick = function () { if (NET.roomStart) NET.roomStart(); };
    var lv = el('szLeave');
    if (lv) lv.onclick = function () { if (NET.roomLeave) NET.roomLeave(); hideOverlay(sal); };
  };

  // ----- Gelo button (repositioned, left side above jump area) -----
  var oldIce = el('bice');
  if (oldIce) oldIce.remove();
  var iceBtn = document.createElement('button');
  iceBtn.id = 'bice';
  iceBtn.type = 'button';
  iceBtn.innerHTML = 'GELO<br><small id="iceCnt">5</small>';
  iceBtn.style.cssText =
    'position:fixed;left:14px;bottom:210px;z-index:8;min-width:64px;height:64px;border-radius:14px;' +
    'border:2px solid #7dd3fc;background:#0c4a6e;color:#e0f2fe;font:700 12px system-ui;' +
    'display:none;pointer-events:auto;line-height:1.15;padding:6px';
  iceBtn.onclick = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof tx === 'function') tx({ t: 'use_item', item: 'ice_wall' });
  };
  document.body.appendChild(iceBtn);
  setInterval(function () {
    var play = typeof ph !== 'undefined' && ph === 'play';
    iceBtn.style.display = play ? 'block' : 'none';
    var hud = el('iceHud');
    if (hud) hud.style.display = 'none'; // use button counter only
  }, 300);

  // ----- ADM panel rewrite -----
  var adm = el('admUI');
  if (adm) adm.remove();
  adm = document.createElement('div');
  adm.id = 'admUI';
  adm.style.cssText = 'display:none;position:fixed;inset:0;background:#0a0a0fee;z-index:45;align-items:center;justify-content:center;padding:10px';
  adm.innerHTML =
    '<div class="bx" style="border-color:#ffd700;max-width:440px;width:100%;max-height:90vh;overflow:auto;background:#111">' +
    '<b style="color:#ffd700">PAINEL ADM</b>' +
    '<hr style="border-color:#333">' +
    '<b>Dar diamantes</b>' +
    '<input id="admNickD" placeholder="Nick do jogador">' +
    '<input id="admQtyD" type="number" placeholder="Quantidade">' +
    '<button type="button" class="ib2 g" id="admSendD" style="width:100%">ENVIAR DIAMANTES</button>' +
    '<hr style="border-color:#333">' +
    '<b>Dar verificado</b>' +
    '<input id="admNickV" placeholder="Nick do jogador">' +
    '<button type="button" class="ib2" id="admSendV" style="width:100%;background:#f97316">CONCEDER ✔</button>' +
    '<hr style="border-color:#333">' +
    '<b>Desbloquear tudo</b>' +
    '<input id="admNickU" placeholder="Nick do jogador">' +
    '<button type="button" class="ib2" id="admSendU" style="width:100%;background:#7c3aed">DESBLOQUEAR TUDO</button>' +
    '<hr style="border-color:#333">' +
    '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="admPzz"> ATIVAR PZZ (assistência visual de mira)</label>' +
    '<button type="button" class="ib2" id="admPzzBtn" style="width:100%;margin-top:6px">SALVAR PZZ</button>' +
    '<hr style="border-color:#333">' +
    '<button type="button" class="ib2" id="admListBtn">Listar jogadores</button>' +
    '<div id="admPlayers" style="max-height:120px;overflow:auto;font-size:12px;margin-top:6px"></div>' +
    '<button type="button" class="ib2 r" id="admClose" style="width:100%;margin-top:10px">Fechar</button>' +
    '</div>';
  document.body.appendChild(adm);

  function resolveNick(nick, cb) {
    // use find then grant by id
    if (!nick) return toast('Informe o nick');
    var handler = function (m) {
      if (m.t !== 'found') return;
      window.removeEventListener('message', handler);
      var list = m.r || [];
      var hit = list.find(function (p) { return p.name && p.name.toLowerCase() === nick.toLowerCase(); }) || list[0];
      if (!hit) return toast('Jogador não encontrado');
      cb(hit.id, hit.name);
    };
    // Hook into H.found temporarily
    var prev = H.found;
    H.found = function (m) {
      if (prev) prev(m);
      var list = m.r || [];
      var hit = list.find(function (p) { return p.name && p.name.toLowerCase() === nick.toLowerCase(); }) || list[0];
      H.found = prev;
      if (!hit) return toast('Jogador não encontrado: ' + nick);
      cb(hit.id, hit.name);
    };
    tx({ t: 'find', q: nick });
  }

  el('admSendD').onclick = function () {
    var nick = (el('admNickD').value || '').trim();
    var qty = +el('admQtyD').value || 0;
    if (!qty) return toast('Quantidade inválida');
    resolveNick(nick, function (id, name) {
      tx({ t: 'adm_grant', id: id, diamonds: qty });
      toast('Diamantes enviados para ' + name);
    });
  };
  el('admSendV').onclick = function () {
    var nick = (el('admNickV').value || '').trim();
    resolveNick(nick, function (id, name) {
      tx({ t: 'adm_grant', id: id, item: 'badge_verify' });
      toast('Verificado concedido a ' + name);
    });
  };
  el('admSendU').onclick = function () {
    var nick = (el('admNickU').value || '').trim();
    if (!confirm('Desbloquear tudo para ' + nick + '?')) return;
    resolveNick(nick, function (id, name) {
      tx({ t: 'adm_grant', id: id, unlockAll: true });
      toast('Tudo desbloqueado para ' + name);
    });
  };
  el('admPzzBtn').onclick = function () {
    var on = !!(el('admPzz') && el('admPzz').checked);
    tx({ t: 'adm_pzz', on: on });
    toast(on ? 'PZZ ativado no servidor' : 'PZZ desativado');
  };
  el('admListBtn').onclick = function () { tx({ t: 'adm_list' }); };
  el('admClose').onclick = function () { hideOverlay(adm); if (typeof tab !== 'undefined') tab = 'menu'; };

  NET._openAdm = function () { showOverlay(adm); };
  // adm_list handler already exists; enhance render
  var prevAdmList = H.adm_list;
  H.adm_list = function (m) {
    if (prevAdmList) prevAdmList(m);
    var box = el('admPlayers');
    if (!box) return;
    box.innerHTML = (m.players || []).map(function (p) {
      return '<div>' + esc(p.name) + ' · ' + (p.diamonds || 0) + '💎' +
        (p.badge ? ' ✔' : '') + (p.online ? ' 🟢' : '') + '</div>';
    }).join('') || 'Nenhum';
  };

  // notify on grant for target
  var prevNote = H.note;
  H.note = function (m) {
    if (prevNote) prevNote(m);
  };
  H.adm_notify = function (m) {
    toast(esc(m.txt || 'Notificação ADM'));
  };
  H.pzz_state = function (m) {
    window.__pzzEnabled = !!m.on;
    var b = el('lzzPzzBtn');
    if (b) b.style.display = window.__pzzEnabled ? 'block' : 'none';
  };

  // ----- LZZ floating button -----
  var lzz = document.createElement('div');
  lzz.id = 'lzzBtn';
  lzz.textContent = 'LZZ';
  lzz.style.cssText =
    'position:fixed;right:16px;top:40%;z-index:35;width:52px;height:52px;border-radius:50%;' +
    'background:#111;border:2px solid #ffd700;color:#ffd700;font:800 13px system-ui;' +
    'display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none';
  document.body.appendChild(lzz);

  var lzzPanel = document.createElement('div');
  lzzPanel.id = 'lzzPanel';
  lzzPanel.style.cssText =
    'display:none;position:fixed;z-index:36;background:#101a2bee;border:2px solid #ffd700;' +
    'border-radius:12px;padding:10px;min-width:140px';
  lzzPanel.innerHTML =
    '<b style="color:#ffd700">LZZ</b>' +
    '<button type="button" class="ib2" id="lzzPzzBtn" style="width:100%;margin-top:8px;display:none">PZZ</button>' +
    '<button type="button" class="ib2 r" id="lzzClose" style="width:100%;margin-top:6px">Fechar</button>';
  document.body.appendChild(lzzPanel);

  var drag = { on: false, x: 0, y: 0, lx: 0, ly: 0 };
  lzz.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    drag.on = true;
    drag.x = t.clientX;
    drag.y = t.clientY;
    drag.lx = lzz.offsetLeft;
    drag.ly = lzz.offsetTop;
  }, { passive: true });
  lzz.addEventListener('touchmove', function (e) {
    if (!drag.on) return;
    var t = e.touches[0];
    var nx = drag.lx + (t.clientX - drag.x);
    var ny = drag.ly + (t.clientY - drag.y);
    lzz.style.left = Math.max(0, Math.min(innerWidth - 52, nx)) + 'px';
    lzz.style.top = Math.max(0, Math.min(innerHeight - 52, ny)) + 'px';
    lzz.style.right = 'auto';
  }, { passive: true });
  lzz.addEventListener('touchend', function (e) {
    var moved = Math.abs((e.changedTouches[0].clientX) - drag.x) + Math.abs((e.changedTouches[0].clientY) - drag.y);
    drag.on = false;
    if (moved < 12) {
      lzzPanel.style.display = 'block';
      lzzPanel.style.left = Math.min(lzz.offsetLeft, innerWidth - 160) + 'px';
      lzzPanel.style.top = Math.min(lzz.offsetTop + 56, innerHeight - 120) + 'px';
      el('lzzPzzBtn').style.display = window.__pzzEnabled ? 'block' : 'none';
    }
  });
  // mouse fallback
  lzz.addEventListener('mousedown', function (e) {
    drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.lx = lzz.offsetLeft; drag.ly = lzz.offsetTop;
  });
  window.addEventListener('mousemove', function (e) {
    if (!drag.on) return;
    lzz.style.left = Math.max(0, Math.min(innerWidth - 52, drag.lx + e.clientX - drag.x)) + 'px';
    lzz.style.top = Math.max(0, Math.min(innerHeight - 52, drag.ly + e.clientY - drag.y)) + 'px';
    lzz.style.right = 'auto';
  });
  window.addEventListener('mouseup', function (e) {
    if (!drag.on) return;
    var moved = Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    drag.on = false;
    if (moved < 12) {
      lzzPanel.style.display = 'block';
      el('lzzPzzBtn').style.display = window.__pzzEnabled ? 'block' : 'none';
    }
  });
  el('lzzClose').onclick = function () { lzzPanel.style.display = 'none'; window.__pzzActive = false; };
  el('lzzPzzBtn').onclick = function () {
    if (!window.__pzzEnabled) return toast('PZZ desativado pelo ADM');
    window.__pzzActive = !window.__pzzActive;
    toast(window.__pzzActive ? 'PZZ ligado (só visual)' : 'PZZ desligado');
  };

  // PZZ visual assist - draw soft indicator toward nearest enemy, NO aim lock / auto fire
  var pzzCanvas = document.createElement('canvas');
  pzzCanvas.id = 'pzzOverlay';
  pzzCanvas.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;display:none';
  document.body.appendChild(pzzCanvas);
  function resizePzz() {
    pzzCanvas.width = innerWidth;
    pzzCanvas.height = innerHeight;
  }
  resizePzz();
  window.addEventListener('resize', resizePzz);
  setInterval(function () {
    var on = window.__pzzEnabled && window.__pzzActive && typeof ph !== 'undefined' && ph === 'play';
    pzzCanvas.style.display = on ? 'block' : 'none';
    if (!on) return;
    var ctx = pzzCanvas.getContext('2d');
    ctx.clearRect(0, 0, pzzCanvas.width, pzzCanvas.height);
    if (typeof RMt === 'undefined' || typeof P === 'undefined' || typeof cam === 'undefined') return;
    var best = null, bestD = 1e9;
    for (var id in RMt) {
      var e = RMt[id];
      if (!e || !e.alive) continue;
      var d = Math.hypot((e.x || 0) - P.x, (e.z || 0) - P.z);
      if (d < bestD && d > 1) { bestD = d; best = e; }
    }
    if (!best || typeof T === 'undefined') return;
    // project approx to screen center direction (simple 2d indicator, not locking aim)
    var dx = best.x - P.x, dz = best.z - P.z;
    var ang = Math.atan2(dx, dz);
    var yaw = typeof yaw !== 'undefined' ? window.yaw || 0 : 0;
    // ring at edge of crosshair area
    var cx = pzzCanvas.width / 2, cy = pzzCanvas.height / 2;
    var dist = Math.min(90, 30 + bestD);
    // Use world yaw if available from global
    var gy = (typeof window.yaw === 'number') ? window.yaw : 0;
    var sx = cx + Math.sin(ang) * 70;
    var sy = cy - Math.cos(ang) * 40;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,80,80,0.55)';
    ctx.lineWidth = 2;
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,200,80,0.35)';
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }, 50);

  // Fullscreen button if missing
  if (!el('btnFS')) {
    var fs = document.createElement('button');
    fs.id = 'btnFS';
    fs.type = 'button';
    fs.textContent = '⛶';
    fs.style.cssText = 'position:fixed;top:8px;left:8px;z-index:30;width:40px;height:40px;border-radius:10px;border:2px solid #3a5a86;background:#101a2b;color:#fff';
    fs.onclick = function () {
      var d = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var req = d.requestFullscreen || d.webkitRequestFullscreen;
        if (req) req.call(d).catch(function () { toast('Tela cheia indisponível'); });
        else toast('Tela cheia não suportada');
      } else {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) ex.call(document);
      }
    };
    document.body.appendChild(fs);
  }

  console.log('[FFZINH UI] salinhas, gelo, ADM, LZZ/PZZ prontos');
})();

// load visual FX
(function () {
  if (!document.querySelector('script[src="royale-fx.js"]')) {
    var s = document.createElement('script');
    s.src = 'royale-fx.js';
    document.body.appendChild(s);
  }
})();
