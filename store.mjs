import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
const fail=m=>{throw new Error(m);};
const str=(v,label,max=200)=>typeof v==='string'&&v.trim().length&&v.length<=max?v.trim():fail(`Please enter a valid ${label}.`);
const integer=(v,label,max=100000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:fail(`Invalid ${label}.`);
export const shipping={peninsular:1000,sabah:1800,sarawak:1800};
export function createStore(path){
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS variants(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),label TEXT NOT NULL,sku TEXT NOT NULL UNIQUE,price INTEGER NOT NULL,stock INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
 const categories=()=>db.prepare('SELECT * FROM categories ORDER BY name').all();
 const getProduct=id=>{const row=db.prepare('SELECT body FROM products WHERE id=?').get(id);if(!row)return null;const p={...JSON.parse(row.body),variants:db.prepare('SELECT id,label,sku,price,stock FROM variants WHERE product_id=? AND active=1 ORDER BY rowid').all(id)};return {...p,editToken:createHash('sha256').update(JSON.stringify(p)).digest('hex')};};
 const products=()=>db.prepare('SELECT id FROM products ORDER BY rowid').all().map(x=>getProduct(x.id));
 function saveProduct(input){return tx(()=>{
   const id=input.id||randomUUID();const existingProduct=input.id&&getProduct(id);if(input.id&&!existingProduct)fail('Product not found.');
   if(existingProduct&&input.editToken!==existingProduct.editToken)fail('This product or its stock has changed. Close this editor and refresh the page before editing again.');
   const name=str(input.name,'product name',100),categoryId=str(input.categoryId,'category');
   if(!categories().some(c=>c.id===categoryId))fail('Category not found.');
   if(!['active','draft','archived'].includes(input.status))fail('Invalid product status.');
   if(!Array.isArray(input.variants)||!input.variants.length||input.variants.length>30)fail('Add between 1 and 30 variants.');
   const image=input.image||'/assets/necklace.svg';if(!/^\/(assets|uploads)\/[a-zA-Z0-9_-]+\.(svg|png|jpg|webp)$/.test(image))fail('Invalid image.');
   const body={id,name,categoryId,status:input.status,image,description:str(input.description,'description',3000),details:typeof input.details==='string'?input.details.slice(0,2000):'',featured:!!input.featured,tag:typeof input.tag==='string'?input.tag.slice(0,30):'',updatedAt:new Date().toISOString()};
   const variants=input.variants.map(v=>{if(v.id){const existing=db.prepare('SELECT product_id FROM variants WHERE id=?').get(v.id);if(!existing||existing.product_id!==id)fail('Invalid variant.');}return {id:v.id||randomUUID(),label:str(v.label,'variant name',70),sku:str(v.sku,'SKU',70),price:integer(v.price,'price'),stock:integer(v.stock,'stock',100000)};});
   if(new Set(variants.map(v=>v.id)).size!==variants.length)fail('Duplicate variant.');
   db.prepare('INSERT INTO products(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(id,JSON.stringify(body));
   db.prepare('UPDATE variants SET active=0 WHERE product_id=?').run(id);
   for(const v of variants)db.prepare('INSERT INTO variants(id,product_id,label,sku,price,stock,active) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET label=excluded.label,sku=excluded.sku,price=excluded.price,stock=excluded.stock,active=1').run(v.id,id,v.label,v.sku,v.price,v.stock);
   return getProduct(id);
 });}
 function saveCategory(input){const name=str(input.name,'category name',60);const id=input.id||randomUUID();if(input.id&&!categories().some(c=>c.id===id))fail('Category not found.');if(categories().some(c=>c.id!==id&&c.name.toLowerCase()===name.toLowerCase()))fail('Category already exists.');db.prepare('INSERT INTO categories VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id,name);return {id,name};}
 const orders=()=>db.prepare('SELECT body FROM orders ORDER BY rowid DESC').all().map(x=>JSON.parse(x.body));
 function checkout(input){
  const requestId=str(input.requestId,'request identifier',80);const customer={};for(const key of ['name','email','phone','address','city','postcode','region'])customer[key]=str(input.customer?.[key],key,key==='address'?500:120);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))fail('Invalid email.');if(!/^\d{5}$/.test(customer.postcode))fail('Enter a five-digit postcode.');
  if(!Object.hasOwn(shipping,customer.region))fail('Unsupported delivery region.');
  if(!['demo-card','demo-fpx','demo-tng'].includes(input.method))fail('Unsupported payment method.');
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Your bag is empty or too large.');
  const quantities=new Map();for(const item of input.items){const qty=integer(item.quantity,'quantity',100);if(!qty)fail('Quantity must be positive.');const id=str(item.variantId,'variant');quantities.set(id,(quantities.get(id)||0)+qty);}
  const fingerprint=createHash('sha256').update(JSON.stringify({customer,method:input.method,items:[...quantities].sort()})).digest('hex');
  return tx(()=>{const prior=db.prepare('SELECT * FROM orders WHERE request_id=?').get(requestId);if(prior){if(prior.fingerprint!==fingerprint)fail('This checkout identifier was already used.');return JSON.parse(prior.body);}
   const items=[];for(const [id,quantity] of quantities){const v=db.prepare('SELECT * FROM variants WHERE id=? AND active=1').get(id);const p=v&&getProduct(v.product_id);if(!p||p.status!=='active')fail('An item is no longer available. Please refresh your bag.');if(v.stock<quantity)fail(`Not enough stock for ${p.name} (${v.label}).`);items.push({variantId:id,productId:p.id,name:p.name,label:v.label,sku:v.sku,image:p.image,price:v.price,quantity});}
   const subtotal=items.reduce((n,i)=>n+i.price*i.quantity,0),delivery=shipping[customer.region];
   const order={id:`PA-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0,4).toUpperCase()}`,customer,items,subtotal,shipping:delivery,total:subtotal+delivery,method:input.method,paymentStatus:'demo-approved',status:'processing',createdAt:new Date().toISOString(),courier:'',tracking:''};
   for(const i of items)db.prepare('UPDATE variants SET stock=stock-? WHERE id=?').run(i.quantity,i.variantId);
   db.prepare('INSERT INTO orders VALUES(?,?,?,?)').run(order.id,requestId,fingerprint,JSON.stringify(order));return order;
  });
 }
 function updateOrder(id,input){return tx(()=>{const row=db.prepare('SELECT body FROM orders WHERE id=?').get(id);if(!row)fail('Order not found.');const o=JSON.parse(row.body);if(!['processing','shipped','cancelled'].includes(input.status))fail('Invalid order status.');if(o.status==='cancelled'&&input.status!=='cancelled')fail('A cancelled order cannot be reopened.');if(o.status==='shipped'&&input.status!=='shipped')fail('A shipped order cannot be cancelled here.');if(input.status==='cancelled'&&o.status!=='cancelled'){for(const i of o.items)db.prepare('UPDATE variants SET stock=stock+? WHERE id=?').run(i.quantity,i.variantId);}if(input.status==='shipped'){o.courier=str(input.courier,'courier',100);o.tracking=str(input.tracking,'tracking number',120);}o.status=input.status;o.updatedAt=new Date().toISOString();db.prepare('UPDATE orders SET body=? WHERE id=?').run(JSON.stringify(o),id);return o;});}
 const setting=key=>db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
 const setSetting=(key,value)=>db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);
 if(!setting('seeded')){
  for(const [id,name] of [['necklaces','Necklaces'],['earrings','Earrings'],['bracelets','Bracelets'],['rings','Rings']])saveCategory({name,...{}}),db.prepare('UPDATE categories SET id=? WHERE name=?').run(id,name);
  const seed=[['The Everyday Strand','necklaces','necklace',42000,'Signature',12],['A Little Orbit','earrings','earrings',18000,'Everyday',8],['The Quiet Circle','bracelets','bracelet',26000,'Signature',6],['The Solstice Pendant','necklaces','pendant',32000,'New perspective',5],['The Open Loop','rings','ring',21000,'Everyday',10],['The Afterglow Drops','earrings','drops',28000,'Evening edit',4],['The Double Strand','bracelets','double',36000,'Signature',3],['The Sculpted Pearl','necklaces','baroque',48000,'One of a kind',0]];
  seed.forEach(([name,categoryId,art,price,tag,stock],index)=>saveProduct({name,categoryId,status:'active',featured:index<4,image:`/assets/${art}.svg`,tag,description:'An imagined piece for the Pearl Atelier demo. A considered balance of simple form and soft light, styled to show how your own collection could be presented.',details:'Illustration only. Sample name, price and options. Pearl type, materials, dimensions and care instructions must be supplied by the business before a real listing is published.',variants:[{label:categoryId==='rings'?'Size 6':categoryId==='earrings'?'Pair':'Standard',sku:`DEMO-${index+1}-A`,price,stock},...(categoryId==='rings'?[{label:'Size 7',sku:`DEMO-${index+1}-B`,price,stock:4}]:[])]}));
  setSetting('seeded','1');
 }
 return {catalog:()=>({products:products().filter(p=>p.status==='active'),categories:categories(),shipping}),products,getProduct,categories,saveProduct,saveCategory,deleteCategory(id){if(products().some(p=>p.categoryId===id))fail('Move products out of this category first.');db.prepare('DELETE FROM categories WHERE id=?').run(id);},checkout,orders,updateOrder,setting,setSetting,close:()=>db.close()};
}
