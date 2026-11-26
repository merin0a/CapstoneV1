import 'dotenv/config';
import { openDatabase, migrate } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.APP_ORIGIN) throw new Error('APP_ORIGIN is required in production.');
const db = await openDatabase({ url: process.env.DATABASE_URL, dataDir: process.env.DATA_DIR });
await migrate(db);
if (process.env.SEED_DEMO === 'true' || (!production && process.env.SEED_DEMO !== 'false')) await seed(db, process.env.DEMO_PASSWORD);
const app = createApp(db, { production, origin: process.env.APP_ORIGIN });
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log(`Subdivision Connect: http://${host}:${port}\nDatabase: ${process.env.DATABASE_URL ? 'PostgreSQL server' : 'local PGlite (saved on disk)'}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(async () => { await db.close(); process.exit(0); }));
