import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

const OWNER = 'brettd@blendproperty.co.za';
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
const clean = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
async function access() {
  const user = await getChatGPTUser();
  if (!user || !env.DB) return null;
  const email = user.email.toLowerCase();
  if (email === OWNER) return { email, role: 'admin', facility: '' };
  return await env.DB.prepare('SELECT email, role, facility FROM members WHERE email = ? AND active = 1').bind(email).first<{email:string;role:string;facility:string}>();
}
function permitted(user: {email:string;role:string;facility:string}, job: any) {
  return user.role === 'admin' || ((user.role === 'manager' || user.role === 'portfolio') && user.facility === job.facility) || (user.role === 'tenant' && user.email === job.requester) || (['contractor','staff'].includes(user.role) && user.email === job.assignee);
}
export async function GET() {
  const user = await access(); if (!user || !env.DB) return fail('Access not granted', 403);
  const result = await env.DB.prepare('SELECT * FROM jobs ORDER BY updated_at DESC').all();
  const visible = (result.results || []).filter(j => permitted(user, j));
  const users = user.role === 'admin' ? (await env.DB.prepare('SELECT email, name, role, facility, active FROM members ORDER BY name').all()).results : user.role === 'manager' ? (await env.DB.prepare("SELECT email, name, role, facility, active FROM members WHERE facility=? AND role IN ('staff','contractor') AND active=1 ORDER BY name").bind(user.facility).all()).results : [];
  return Response.json({ user, jobs: visible, members: users });
}
export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return fail('Invalid origin', 403);
  const user = await access(); if (!user || !env.DB) return fail('Access not granted', 403);
  const data = await req.json().catch(() => null); if (!data || typeof data !== 'object') return fail('Invalid request');
  const db = env.DB, now = new Date().toISOString(), id = crypto.randomUUID();
  if (data.action === 'create') {
    const title=clean(data.title,120), description=clean(data.description,4000), facility=clean(data.facility,120), location=clean(data.location,200), priority=clean(data.priority,20);
    if (!title || !description || !facility || !location || !['Normal','High','Urgent'].includes(priority)) return fail('Complete all fields');
    if (user.role !== 'admin' && user.facility !== facility) return fail('Facility not permitted',403);
    await db.batch([db.prepare('INSERT INTO jobs (id,title,description,facility,location,priority,status,requester,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,title,description,facility,location,priority,'Awaiting approval',user.email,now,now), db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user.email,'Request submitted','',now)]);
    return Response.json({id});
  }
  if (data.action === 'member') {
    if (user.role !== 'admin') return fail('Only an administrator can manage access',403);
    const email=clean(data.email,254).toLowerCase(),name=clean(data.name,120),role=clean(data.role,30),facility=clean(data.facility,120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !facility || !['tenant','manager','portfolio','staff','contractor'].includes(role)) return fail('Invalid member details');
    await db.prepare('INSERT INTO members (email,name,role,facility,active) VALUES (?,?,?,?,1) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,facility=excluded.facility,active=1').bind(email,name,role,facility).run();
    return Response.json({ok:true});
  }
  const jobId=clean(data.id,40), job=await db.prepare('SELECT * FROM jobs WHERE id=?').bind(jobId).first<any>();
  if (!job || !permitted(user,job)) return fail('Job not found',404);
  const manager = user.role === 'admin' || user.role === 'manager';
  const worker = ['staff','contractor'].includes(user.role) && job.assignee === user.email;
  let status=job.status, action='', detail='', assignee=job.assignee, notes=job.work_notes, hours=job.hours, overtime=job.overtime_minutes;
  if (data.action === 'allocate' && manager && ['Awaiting approval','Returned for clarification'].includes(status)) {
    const candidate=clean(data.assignee,254).toLowerCase();
    const member=await db.prepare("SELECT email FROM members WHERE email=? AND active=1 AND role IN ('staff','contractor') AND facility=?").bind(candidate,job.facility).first();
    if (!member) return fail('Choose an active staff member or contractor for this facility');
    assignee=candidate; status='In progress'; action='Approved and allocated'; detail=candidate;
  } else if (data.action === 'work' && worker && ['In progress','Returned for rework'].includes(status)) {
    hours=Number(data.hours); overtime=Number(data.overtimeMinutes); notes=clean(data.notes,4000);
    if (!Number.isInteger(hours)||hours<0||hours>60000||!Number.isInteger(overtime)||overtime<0||overtime>60000) return fail('Enter valid time in minutes');
    action='Work record updated';
  } else if (data.action === 'submit' && worker && ['In progress','Returned for rework'].includes(status)) {
    const files=await db.prepare('SELECT kind FROM evidence WHERE job_id=?').bind(jobId).all<{kind:string}>();
    const kinds=new Set(files.results.map(x=>x.kind));
    if (!['before','after','contractor_signature'].every(x=>kinds.has(x))) return fail('Before and after photos and contractor signature are required');
    status='Awaiting final approval'; action='Work submitted for review';
  } else if (data.action === 'close' && manager && status === 'Awaiting final approval') {
    const requester=await db.prepare('SELECT role FROM members WHERE email=? AND active=1').bind(job.requester).first<{role:string}>();
    if (requester?.role === 'tenant' && !(await db.prepare("SELECT id FROM evidence WHERE job_id=? AND kind='tenant_signature' LIMIT 1").bind(jobId).first())) return fail('Tenant acknowledgement is required before closure');
    status='Closed'; action='Manager approved and closed';
  } else if (data.action === 'return' && manager && status === 'Awaiting final approval') {
    detail=clean(data.reason,1000); if (!detail) return fail('Enter a reason'); status='Returned for rework'; action='Returned for rework';
  } else return fail('Action not allowed for this role or job status',403);
  await db.batch([db.prepare('UPDATE jobs SET status=?,assignee=?,work_notes=?,hours=?,overtime_minutes=?,updated_at=? WHERE id=?').bind(status,assignee,notes,hours,overtime,now,jobId),db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),jobId,user.email,action,detail,now)]);
  return Response.json({ok:true});
}

