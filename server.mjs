import {createServer} from 'node:http';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {createStore} from './store.mjs';
const root=dirname(fileURLToPath(import.meta.url)),pub=join(root,'public');
const hash=(password,salt)=>scryptSync(password,salt,64).toString('hex');
export function createApp({dataDir=join(root,'data')}={}){
 mkdirSync(dataDir,{recursive:true});mkdirSync(join(pub,'uploads'),{recursive:true});const store=createStore(join(dataDir,'shop.sqlite'));const sessions=new Map(),attempts=new Map();
 const logged=req=>{const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pearl_session='))?.slice(14);const session=sessions.get(token);if(session&&session.expires>Date.now())return token;if(token)sessions.delete(token);return null;};
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const body=async req=>{if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('Use JSON content.'),{status:415});let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>4_300_000)throw Object.assign(new Error('Image or request is too large.'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('Invalid JSON.');}};
 function newSession(res){const token=randomBytes(32).toString('hex');sessions.set(token,{expires:Date.now()+8*60*60*1000});res.setHeader('Set-Cookie',`pearl_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`);}
 const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  const expectedHost=process.env.PUBLIC_ORIGIN?new URL(process.env.PUBLIC_ORIGIN).host:null;
  if(expectedHost?req.headers.host!==expectedHost:! /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host||''))return json(res,403,{error:'Unrecognised host. Use the local preview address.'});
  if(!['GET','HEAD','POST'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
  if(req.method==='POST'){
   const allowed=process.env.PUBLIC_ORIGIN||`http://${req.headers.host}`;
   if(req.headers.origin!==allowed)return json(res,403,{error:'Request origin not allowed. Reload the page and try again.'});
  }
  if(path==='/api/status')return json(res,200,{configured:!!store.setting('admin'),authenticated:!!logged(req)});
  if(path==='/api/catalog'&&req.method==='GET')return json(res,200,store.catalog());
  if(path==='/api/setup'&&req.method==='POST'){
   if(store.setting('admin'))return json(res,409,{error:'An administrator is already configured.'});
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers['x-forwarded-for']||req.headers['cf-connecting-ip'])return json(res,403,{error:'Complete first-run setup directly on the home PC.'});
   const input=await body(req);if(typeof input.password!=='string'||input.password.length<12||input.password.length>128||typeof input.email!=='string'||!/^\S+@\S+\.\S+$/.test(input.email)||input.email.length>120)throw new Error('Use a valid email and a password of 12 to 128 characters.');
   if(store.setting('admin'))return json(res,409,{error:'An administrator is already configured.'});
   const salt=randomBytes(16).toString('hex');store.setSetting('admin',JSON.stringify({email:input.email.toLowerCase().trim(),salt,hash:hash(input.password,salt)}));newSession(res);return json(res,200,{ok:true});
  }
  if(path==='/api/login'&&req.method==='POST'){
   const input=await body(req),ip=req.socket.remoteAddress;let a=attempts.get(ip);if(!a||a.until<Date.now())a={count:0,until:Date.now()+15*60*1000};if(a.count>=10)return json(res,429,{error:'Too many attempts. Try again in 15 minutes.'});a.count++;attempts.set(ip,a);
   const raw=store.setting('admin'),admin=raw&&JSON.parse(raw);const password=typeof input.password==='string'?input.password:'';
   if(!admin||password.length>128||typeof input.email!=='string'||input.email.trim().toLowerCase()!==admin.email||!timingSafeEqual(Buffer.from(hash(password,admin.salt),'hex'),Buffer.from(admin.hash,'hex')))return json(res,401,{error:'Email or password is incorrect.'});
   attempts.delete(ip);newSession(res);return json(res,200,{ok:true});
  }
  if(path==='/api/logout'&&req.method==='POST'){sessions.delete(logged(req));res.setHeader('Set-Cookie','pearl_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
  if(path==='/api/checkout'&&req.method==='POST')return json(res,200,store.checkout(await body(req)));
  if(path.startsWith('/api/admin/')){
   if(!logged(req))return json(res,401,{error:'Please sign in to the studio.'});
   if(path==='/api/admin/products'){if(req.method==='GET')return json(res,200,{products:store.products(),categories:store.categories()});return json(res,200,store.saveProduct(await body(req)));}
   if(path==='/api/admin/categories'){if(req.method==='GET')return json(res,200,store.categories());const b=await body(req);if(b.action==='delete'){store.deleteCategory(b.id);return json(res,200,{ok:true});}return json(res,200,store.saveCategory(b));}
   if(path==='/api/admin/orders'){if(req.method==='GET')return json(res,200,store.orders());const b=await body(req);return json(res,200,store.updateOrder(b.id,b));}
   if(path==='/api/admin/upload'&&req.method==='POST'){
    const b=await body(req);const m=typeof b.data==='string'&&b.data.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/);if(!m)throw new Error('Upload a PNG, JPEG or WebP image.');const bytes=Buffer.from(m[2],'base64');if(bytes.length>3_000_000)throw new Error('Image must be under 3 MB.');
    const valid=m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)throw new Error('The file is not a valid supported image.');
    const name=randomBytes(16).toString('hex')+'.'+(m[1]==='jpeg'?'jpg':m[1]);writeFileSync(join(pub,'uploads',name),bytes);return json(res,200,{image:'/uploads/'+name});
   }
  }
  if(path.startsWith('/api/'))return json(res,404,{error:'Endpoint not found.'});
  if(req.method==='POST')return json(res,405,{error:'Method not allowed.'});
  const route=path==='/'?'/index.html':path==='/admin'||path==='/admin/'?'/admin.html':path;
  const file=resolve(pub,'.'+decodeURIComponent(route));if(!file.startsWith(pub+sep)||!existsSync(file))return json(res,404,{error:'Page not found.'});
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};const mime=types[extname(file)];if(!mime)return json(res,404,{error:'File not available.'});
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
 }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.message.includes('UNIQUE')?'A SKU or name is already in use.':e.message});else res.end();}
 });
 return {server,store};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const {server}=createApp();const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`Pearl Atelier demo: http://${host}:${port}\nStudio admin: http://${host}:${port}/admin\nCreate your admin login on first visit. Demo payments only.`));}
