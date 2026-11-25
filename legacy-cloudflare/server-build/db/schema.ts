import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const members = sqliteTable('members', {
  email: text('email').primaryKey(), name: text('name').notNull(), role: text('role').notNull(), facility: text('facility').notNull().default(''), active: integer('active').notNull().default(1)
});
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), title: text('title').notNull(), description: text('description').notNull(), facility: text('facility').notNull(), location: text('location').notNull(), priority: text('priority').notNull(), status: text('status').notNull(), requester: text('requester').notNull(), assignee: text('assignee').notNull().default(''), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), hours: integer('hours').notNull().default(0), overtimeMinutes: integer('overtime_minutes').notNull().default(0), workNotes: text('work_notes').notNull().default(''), dueDate: text('due_date').notNull().default('')
});
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id), actor: text('actor').notNull(), action: text('action').notNull(), detail: text('detail').notNull().default(''), createdAt: text('created_at').notNull()
});
export const evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id), kind: text('kind').notNull(), objectKey: text('object_key').notNull(), mime: text('mime').notNull(), actor: text('actor').notNull(), createdAt: text('created_at').notNull()
});

