import { hashPassword } from './passwords.js';
export const DEMO_PASSWORD = 'StudentDemo123!';
export async function seed(db, password = DEMO_PASSWORD) {
  if (password.length < 10) throw new Error('Demo password must have at least 10 characters.');
  await db.transaction(async tx => {
    if ((await tx.query('SELECT id FROM users LIMIT 1')).rows.length) return;
    const household = (await tx.query("INSERT INTO households(block,lot) VALUES('3','12') RETURNING id")).rows[0].id;
    const hash = await hashPassword(password);
    for (const [name,email,role] of [
      ['Maria Santos','maria.santos@carmela.ph','resident'],
      ['HOA Admin','admin@carmela.ph','admin'],
      ['Tony Valdez','guard.tony@carmela.ph','guard']
    ]) await tx.query('INSERT INTO users(name,email,password_hash,role,household_id) VALUES($1,$2,$3,$4,$5)',[name,email,hash,role,role==='resident'?household:null]);
    await tx.query("INSERT INTO announcements(user_id,title,body,pinned) SELECT id,'Welcome to Subdivision Connect','You can now submit reports and register visitors. These are sample accounts for trying the app on localhost.',true FROM users WHERE role='admin'");
  });
}
