import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
const fail=(message:string,status=400)=>Response.json({error:message},{status});
async function context(id:string) {
  const u=await getChatGPTUser(); if(!u||!env.DB||!env.BUCKET)return null;
  const email=u.email.toLowerCase();
  const member=email==='brettd@blendproperty.co.za'?{role:'admin',facility:''}:await env.DB.prepare('SELECT role,facility FROM members WHERE email=? AND active=1').bind(email).first<any>();
  const job=await env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first<any>();
  if(!member||!job)return null;
  const allowed=member.role==='admin'||(['manager','portfolio'].includes(member.role)&&member.facility===job.facility)||(member.role==='tenant'&&job.requester===email)||(['staff','contractor'].includes(member.role)&&job.assignee===email);
  return allowed?{email,member,job}:null;
}
export async function GET(req:Request){
  const url=new URL(req.url),id=url.searchParams.get('job')||'',file=url.searchParams.get('file'); const ctx=await context(id);
  if(!ctx||!env.DB||!env.BUCKET)return fail('Not found',404);
  if(file){const record=await env.DB.prepare('SELECT * FROM evidence WHERE id=? AND job_id=?').bind(file,id).first<any>();if(!record)return fail('Not found',404);const object=await env.BUCKET.get(record.object_key);if(!object)return fail('Not found',404);return new Response(object.body,{headers:{'Content-Type':record.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  const [files,history]=await Promise.all([env.DB.prepare('SELECT id,kind,actor,created_at FROM evidence WHERE job_id=? ORDER BY created_at').bind(id).all(),env.DB.prepare('SELECT actor,action,detail,created_at FROM events WHERE job_id=? ORDER BY created_at DESC').bind(id).all()]);
  return Response.json({files:files.results,history:history.results});
}
export async function POST(req:Request){
  if(req.headers.get('origin')!==new URL(req.url).origin)return fail('Invalid origin',403);
  const form=await req.formData(), id=String(form.get('job')||''),kind=String(form.get('kind')||''),file=form.get('file');const ctx=await context(id);
  if(!ctx||!env.DB||!env.BUCKET)return fail('Not found',404);
  const worker=['contractor','staff'].includes(ctx.member.role)&&ctx.job.assignee===ctx.email&&['In progress','Returned for rework'].includes(ctx.job.status);
  const tenant=ctx.member.role==='tenant'&&ctx.job.requester===ctx.email&&ctx.job.status==='Awaiting final approval';
  if(!(worker&&['before','after','contractor_signature'].includes(kind))&&!(tenant&&kind==='tenant_signature'))return fail('Action not allowed',403);
  if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>5*1024*1024)return fail('Upload a JPEG, PNG or WebP image up to 5 MB');
  const fileId=crypto.randomUUID(),key=`jobs/${id}/${fileId}`,now=new Date().toISOString();
  await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
  try {await env.DB.batch([env.DB.prepare('INSERT INTO evidence VALUES (?,?,?,?,?,?,?)').bind(fileId,id,kind,key,file.type,ctx.email,now),env.DB.prepare('INSERT INTO events VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,ctx.email,'Evidence added',kind,now)]);}catch(e){await env.BUCKET.delete(key);throw e;}
  return Response.json({ok:true});
}

