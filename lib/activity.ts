import pool, { ensureDatabaseReady } from '@/lib/db';

export type ActivityInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
};

async function ensureActivityTable() {
  await ensureDatabaseReady();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function recordActivity(activity: ActivityInput) {
  try {
    await ensureActivityTable();
    await pool.query(
      `INSERT INTO activity_logs (action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4)`,
      [activity.action, activity.entityType, activity.entityId || null, activity.description]
    );
  } catch (error) {
    console.warn('Unable to record dashboard activity', error);
  }
}
