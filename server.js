// Servidor Royale Online: contas, amigos, convites, chat, salas e partida autoritativa.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,REGION=process.env.REGION||'local',MINP=+process.env.MINP||2,MAXP=50;
const DBF=process.env.DB||path.join(__dirname,'db.json'),PUB=path.join(__dirname,'public');
let db={u:{},tok:{},rep:[]};try{db=JSON.parse(fs.readFileSync(DBF))}catch(e){}
let dirty=0;const save=()=>{dirty=1};setInterval(()=>{if(dirty){dirty=0;fs.writeFile(DBF,JSON.stringify(db),()=>{})}},5000);
// Tabelas de dano (fonte da verdade): [dano,cadência s,carregador,alcance,dispersão]
const WP=[22,.11,30,130,.02],ZM=[2.4,1,.75],TS={solo:1,duo:2,squad:4};
const on={},rmOf={},party={},pOf={},rooms={};let nid=0;
const send=(w,o)=>{if(w&&w.readyState==1)w.send(JSON.stringify(o))},to=(id,o)=>send(on[id],o),rm=(a,x)=>{const i=a.indexOf(x);if(i>=0)a.splice(i,1)},rnd=(a,b)=>a+Math.random()*(b-a),U=id=>db.u[id];
const pub=id=>{const u=U(id);return u&&{id,name:u.name,lvl:1+Math.floor(u.st.xp/100),on:!!on[id],st:!on[id]?'offline':rmOf[id]?'jogando':'online'}};
const me=id=>{const u=U(id);return{t:'me',id,name:u.name,st:u.st,hist:u.hist.slice(-10),fr:u.fr.map(pub),rin:u.rin.map(pub),rout:u.rout.map(pub),bl:u.bl,priv:u.priv}};
const refresh=id=>to(id,me(id)),refF=id=>{refresh(id);U(id).fr.forEach(f=>on[f]&&refresh(f))};
const pv=p=>({id:p.id,lead:p.lead,mode:p.mode,m:p.m.map(pub)}),pq=p=>p.m.forEach(i=>to(i,{t:'party',p:pv(p)}));
function leaveP(id){const p=party[pOf[id]];if(!p)return;rm(p.m,id);delete pOf[id];to(id,{t:'party',p:null});if(!p.m.length)delete party[p.id];else{if(p.lead==id)p.lead=p.m[0];pq(p)}}
function autoTeam(r,mode){const c={};Object.values(r.pl).forEach(q=>{if(String(q.team)[0]=='a')c[q.team]=(c[q.team]||0)+1});for(const t in c)if(c[t]<TS[mode])return t;return'a'+(++nid)}
const alive=r=>Object.values(r.pl).filter(p=>p.alive);
function startMsg(r,id){return{t:'start',room:r.id,mode:r.mode,z:[r.zx,r.zz],pl:Object.values(r.pl).map(p=>({id:p.id,name:p.name,team:p.team,x:p.x,z:p.z,look:on[p.id]&&on[p.id].look}))}}
function startRoom(r){r.st='play';r.t0=Date.now();r.zx=rnd(-60,60);r.zz=rnd(-60,60);const base={};for(const p of Object.values(r.pl)){const b=base[p.team]||(base[p.team]=[rnd(-250,250),rnd(-250,250)]);p.x=b[0]+rnd(-5,5);p.z=b[1]+rnd(-5,5);p.lt=Date.now()}Object.keys(r.pl).forEach(i=>to(i,startMsg(r,i)))}
function resume(id){const r=rooms[rmOf[id]];if(r&&r.st=='play'){r.pl[id].dc=0;to(id,startMsg(r,id))}}
function die(r,q,k){if(!q.alive)return;q.alive=0;q.hp=0;if(k)k.k++;const ts=new Set(alive(r).filter(p=>p.team!=q.team).map(p=>p.team));q.rank=ts.size+1;Object.keys(r.pl).forEach(i=>to(i,{t:'kill',v:q.id,a:k&&k.id}));to(q.id,{t:'dead',rank:q.rank});const t2=new Set(alive(r).map(p=>p.team));if(t2.size<=1)endRoom(r,[...t2][0])}
function endRoom(r,win){if(r.st!='play')return;r.st='end';for(const p of Object.values(r.pl)){const u=U(p.id),w=p.team==win;u.st.g++;u.st.k+=p.k;u.st.w+=w?1:0;u.st.xp+=20+p.k*10+(w?30:0);u.hist.push({d:Date.now(),k:p.k,r:w?1:p.rank||2,m:r.mode});to(p.id,{t:'end',win:w,rank:w?1:p.rank||2,k:p.k})}save();setTimeout(()=>{Object.keys(r.pl).forEach(i=>{delete rmOf[i];refF(i)});delete rooms[r.id]},4000)}
function leaveRoom(id){const r=rooms[rmOf[id]];if(!r)return;if(r.st=='wait'){delete r.pl[id];delete rmOf[id];if(!Object.keys(r.pl).length)delete rooms[r.id]}else if(r.st=='play')die(r,r.pl[id],null)}
const H={
auth(ws,m){let id;if(m.token&&db.tok[m.token])id=db.tok[m.token];else{const n=String(m.name||'').trim().slice(0,16),pw=String(m.pw||'');if(n.length<3||pw.length<4)return send(ws,{t:'err',e:'Nome (3+) e senha (4+ caracteres)'});let e=Object.values(db.u).find(x=>x.name.toLowerCase()==n.toLowerCase());if(!e){do{id=String(100000+Math.floor(Math.random()*900000))}while(db.u[id]);const s=crypto.randomBytes(8).toString('hex');e=db.u[id]={id,name:n,s,h:crypto.scryptSync(pw,s,32).toString('hex'),fr:[],rin:[],rout:[],bl:[],priv:{},st:{xp:0,g:0,k:0,w:0},hist:[]}}else{if(crypto.scryptSync(pw,e.s,32).toString('hex')!=e.h)return send(ws,{t:'err',e:'Senha incorreta'});id=e.id}m.token=crypto.randomBytes(16).toString('hex');db.tok[m.token]=id}
if(on[id]&&on[id]!=ws){const o=on[id];o.id=null;ws.look=o.look;o.close()}ws.id=id;on[id]=ws;save();send(ws,{t:'authok',token:m.token,id,region:REGION});refF(id);resume(id)},
look(ws,m){if(m.look&&typeof m.look=='object')ws.look={skin:String(m.look.skin),hair:String(m.look.hair),hat:String(m.look.hat||''),face:(m.look.face||[]).slice(0,4).map(String),back:String(m.look.back)}},
p(ws,m){send(ws,{t:'p',ts:m.ts,n:Object.keys(on).length})},
find(ws,m){const q=String(m.q||'').toLowerCase().trim();if(!q)return;send(ws,{t:'found',r:Object.values(db.u).filter(x=>x.id!=ws.id&&(x.id==q||x.name.toLowerCase().includes(q))&&!x.bl.includes(ws.id)).slice(0,8).map(x=>pub(x.id))})},
prof(ws,m){const u=U(m.id);if(u&&!u.bl.includes(ws.id))send(ws,{t:'prof',u:{id:u.id,name:u.name,xp:u.st.xp,g:u.st.g,k:u.st.k,w:u.st.w}})},
fr_add(ws,m){const a=U(ws.id),b=U(m.id);if(!b||b.id==a.id||a.fr.includes(b.id)||b.bl.includes(a.id)||a.rout.includes(b.id))return;if(b.priv.noreq)return send(ws,{t:'err',e:'Este jogador não aceita pedidos'});if(a.rin.includes(b.id))return H.fr_acc(ws,m);a.rout.push(b.id);b.rin.push(a.id);to(b.id,{t:'note',k:'req',from:pub(a.id)});refresh(a.id);refresh(b.id);save()},
fr_acc(ws,m){const a=U(ws.id),b=U(m.id);if(!b||!a.rin.includes(b.id))return;rm(a.rin,b.id);rm(b.rout,a.id);a.fr.push(b.id);b.fr.push(a.id);refresh(a.id);refresh(b.id);save()},
fr_dec(ws,m){const a=U(ws.id),b=U(m.id);if(!b)return;rm(a.rin,b.id);rm(b.rout,a.id);refresh(a.id);refresh(b.id);save()},
fr_cancel(ws,m){const a=U(ws.id),b=U(m.id);if(!b)return;rm(a.rout,b.id);rm(b.rin,a.id);refresh(a.id);refresh(b.id);save()},
fr_rem(ws,m){const a=U(ws.id),b=U(m.id);if(!b)return;rm(a.fr,b.id);rm(b.fr,a.id);refresh(a.id);refresh(b.id);save()},
block(ws,m){const a=U(ws.id);if(!U(m.id)||a.bl.includes(m.id))return;a.bl.push(m.id);H.fr_rem(ws,m);H.fr_dec(ws,m);H.fr_cancel(ws,m);save()},
report(ws,m){db.rep.push({by:ws.id,id:m.id,why:String(m.why||'').slice(0,200),at:Date.now()});save();send(ws,{t:'note',k:'info',txt:'Denúncia enviada'})},
priv(ws,m){U(ws.id).priv.noreq=!!m.noreq;save()},
chat(ws,m){const a=U(ws.id),tx=String(m.text||'').slice(0,200);if(!tx)return;let ids=[];if(m.sc=='friend'){if(a.fr.includes(m.to))ids=[m.to,a.id]}else if(m.sc=='party'){const p=party[pOf[ws.id]];if(p)ids=p.m}else{const r=rooms[rmOf[ws.id]];if(r&&r.pl[ws.id]){const t=r.pl[ws.id].team;ids=Object.keys(r.pl).filter(i=>m.sc=='room'||r.pl[i].team==t)}}
ids.forEach(i=>{if(U(i)&&(i==a.id||!U(i).bl.includes(a.id)))to(i,{t:'chat',sc:m.sc,from:{id:a.id,name:a.name},text:tx,to:m.to})})},
inv(ws,m){const a=U(ws.id);if(!a.fr.includes(m.id)||!on[m.id]||rmOf[ws.id]||rmOf[m.id]||pOf[m.id])return send(ws,{t:'err',e:'Amigo indisponível'});let p=party[pOf[ws.id]];if(!p){p=party[ws.id]={id:ws.id,lead:ws.id,mode:TS[m.mode]?m.mode:'duo',m:[ws.id]};pOf[ws.id]=p.id}if(p.m.length>=TS[p.mode])return send(ws,{t:'err',e:'Equipe cheia'});to(m.id,{t:'inv',from:pub(ws.id),party:p.id});send(ws,{t:'note',k:'info',txt:'Convite enviado'});pq(p)},
inv_acc(ws,m){const p=party[m.party];if(!p||pOf[ws.id]||rmOf[ws.id]||p.m.length>=TS[p.mode])return send(ws,{t:'err',e:'Convite expirou'});p.m.push(ws.id);pOf[ws.id]=p.id;pq(p)},
pleave(ws){leaveP(ws.id)},
pmode(ws,m){const p=party[pOf[ws.id]];if(p&&p.lead==ws.id&&TS[m.mode]&&p.m.length<=TS[m.mode]){p.mode=m.mode;pq(p)}},
join(ws,m){if(rmOf[ws.id])return;const mode=TS[m.mode]?m.mode:'solo',p=party[pOf[ws.id]];if(p&&p.lead!=ws.id)return send(ws,{t:'err',e:'Só o líder inicia a busca'});const ids=p?p.m.slice():[ws.id];if(ids.some(i=>!on[i]||rmOf[i]))return send(ws,{t:'err',e:'Membro indisponível'});if(ids.length>TS[mode])return send(ws,{t:'err',e:'Equipe maior que o modo'});
let r=Object.values(rooms).find(x=>x.st=='wait'&&x.mode==mode&&Object.keys(x.pl).length+ids.length<=MAXP);if(!r){const id='R'+(++nid);r=rooms[id]={id,mode,st:'wait',pl:{},at:0}}
ids.forEach(i=>{r.pl[i]={id:i,name:U(i).name,team:p?p.id:autoTeam(r,mode),x:0,y:0,z:0,yaw:0,hp:100,ar:50,am:30,alive:1,k:0,lf:0,rl:0,lt:Date.now(),fl:0,dc:0};rmOf[i]=r.id});refF(ws.id)},
leave(ws){const p=party[pOf[ws.id]],ids=p&&p.lead==ws.id?p.m:[ws.id];ids.forEach(leaveRoom);ids.forEach(refF)},
mv(ws,m){const r=rooms[rmOf[ws.id]],p=r&&r.pl[ws.id];if(!p||r.st!='play'||!p.alive)return;const now=Date.now(),dt=Math.min(1,(now-p.lt)/1000);p.lt=now;const x=+m.x,z=+m.z;if(!isFinite(x)||!isFinite(z))return;
if(Math.hypot(x-p.x,z-p.z)>11*dt+.8)return send(ws,{t:'fix',x:p.x,z:p.z});p.x=Math.max(-295,Math.min(295,x));p.z=Math.max(-295,Math.min(295,z));p.y=Math.max(0,Math.min(3,+m.y||0));p.yaw=+m.yaw||0;p.fl=m.f&31},
rl(ws){const r=rooms[rmOf[ws.id]],p=r&&r.pl[ws.id];if(p&&p.alive&&!p.rl&&p.am<WP[2])p.rl=Date.now()+1500},
sh(ws,m){const r=rooms[rmOf[ws.id]],p=r&&r.pl[ws.id];if(!p||r.st!='play'||!p.alive)return;const now=Date.now();if(now<p.lf+WP[1]*800||p.rl||p.am<=0)return;
const o=(m.o||[]).map(Number),d=(m.d||[]).map(Number);if(o.length!=3||d.length!=3||[...o,...d].some(v=>!isFinite(v)))return;if(Math.hypot(o[0]-p.x,o[1]-p.y-1.5,o[2]-p.z)>8)return;const l=Math.hypot(...d);if(!l)return;
p.lf=now;p.am--;if(p.am<=0)p.rl=now+1500;const sp=WP[4],dr=d.map(v=>v/l+rnd(-1,1)*sp),dl=Math.hypot(...dr),dir=dr.map(v=>v/dl);let best=null,bt=1e9;
for(const q of Object.values(r.pl)){if(!q.alive||q.team==p.team)continue;const tx=q.x-o[0],ty=q.y+1.1-o[1],tz=q.z-o[2],t=tx*dir[0]+ty*dir[1]+tz*dir[2];if(t>0&&t<WP[3]&&t<bt){const d2=tx*tx+ty*ty+tz*tz-t*t;if(d2<.45){bt=t;best=q}}}
const e=o.map((v,i)=>v+dir[i]*(best?bt:80));Object.keys(r.pl).forEach(i=>to(i,{t:'tr',a:p.id,e}));
if(best){const hy=e[1]-best.y,hd=Math.hypot(e[0]-best.x,e[2]-best.z),z=hy>1.65?0:(hy<.85||hd>.3)?2:1;let dmg=WP[0]*ZM[z]*(z==0&&best.ar>0?.6:1);const shown=dmg,a=Math.min(best.ar,dmg*.5);best.ar-=a;dmg-=a;best.hp-=dmg;Object.keys(r.pl).forEach(i=>to(i,{t:'hit',v:best.id,a:p.id,d:+shown.toFixed(1),z,hp:Math.max(0,best.hp),ar:best.ar,e}));if(best.hp<=0)die(r,best,p)}}};
setInterval(()=>{const now=Date.now();for(const r of Object.values(rooms)){const ids=Object.keys(r.pl);if(r.st=='wait'){const n=ids.length;if(n>=MINP&&!r.at)r.at=now+15000;if(n<MINP)r.at=0;ids.forEach(i=>to(i,{t:'lobby',n,max:MAXP,in:r.at?Math.max(0,Math.ceil((r.at-now)/1000)):-1}));if(n>=MAXP||(r.at&&now>=r.at))startRoom(r)}
else if(r.st=='play'){const t=(now-r.t0)/1000,zr=Math.max(20,300-Math.max(0,t-25)*2.2);for(const p of Object.values(r.pl)){if(!p.alive)continue;if(p.rl&&now>=p.rl){p.am=WP[2];p.rl=0}if(Math.hypot(p.x-r.zx,p.z-r.zz)>zr){p.hp-=3*.05;if(p.hp<=0)die(r,p,null)}if(!on[p.id]&&p.dc&&now>p.dc+30000)die(r,p,null)}
if(r.st=='play'){const pl=Object.values(r.pl).map(p=>[p.id,+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2),+p.yaw.toFixed(2),Math.round(p.hp),Math.round(p.ar),p.fl,p.am]);ids.forEach(i=>to(i,{t:'st',s:t,z:[r.zx,r.zz],p:pl}))}}}},50);
const mime={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0],f=path.join(PUB,path.normalize(u=='/'?'index.html':u));if(!f.startsWith(PUB)){r.writeHead(403);return r.end()}fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('404')}r.writeHead(200,{'Content-Type':(mime[path.extname(f)]||'text/plain')+'; charset=utf-8'});r.end(d)})});
const wss=new WebSocketServer({server:srv,maxPayload:4096});
wss.on('connection',ws=>{ws.on('message',d=>{const n=Date.now()/1000|0;if(ws.sec!=n){ws.sec=n;ws.c=0}if(++ws.c>80)return;let m;try{m=JSON.parse(d)}catch(e){return}if(!m||typeof m.t!='string'||!H.hasOwnProperty(m.t))return;if(!ws.id&&m.t!='auth'&&m.t!='p')return;try{H[m.t](ws,m)}catch(e){console.error(e)}});
ws.on('close',()=>{const id=ws.id;if(!id||on[id]!=ws)return;delete on[id];const r=rooms[rmOf[id]];if(r){if(r.st=='wait'){delete r.pl[id];delete rmOf[id];if(!Object.keys(r.pl).length)delete rooms[r.id]}else if(r.st=='play')r.pl[id].dc=Date.now()}leaveP(id);U(id).fr.forEach(f=>on[f]&&refresh(f))})});
srv.listen(PORT,()=>console.log('Royale Online em :'+PORT+' região='+REGION));
