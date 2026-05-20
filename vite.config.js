import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'

const PROJECT_DIR = '/Users/emanuelemancini/.gemini/antigravity/scratch/gestionale-didattico';
const VERCEL_HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_frYfkekayE2qpQd0nM81wvrIEebv/ESBrCpoQ5P';

function run(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: PROJECT_DIR, ...opts }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout.trim());
    });
  });
}

const deployPlugin = () => ({
  name: 'deploy-endpoint',
  configureServer(server) {
    server.middlewares.use('/api', (req, res, next) => {

      if (req.url === '/deploy-status' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        run('git status -s').then(stdout => {
          const files = stdout ? stdout.split('\n').filter(l => l.trim()) : [];
          res.end(JSON.stringify({ success: true, files }));
        }).catch(err => {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
        return;
      }

      if (req.url === '/full-deploy' && req.method === 'POST') {
        res.setHeader('Content-Type', 'application/json');

        const timestamp = new Date().toLocaleString('it-IT', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        const steps = [];

        const log = (msg) => { steps.push(msg); console.log('[deploy]', msg); };

        (async () => {
          try {
            log('📁 Sincronizzazione worktree...');
            await run(`bash ${PROJECT_DIR}/sincronizza.sh`);

            log('📦 Aggiunta file a git...');
            await run('git add -A');

            log('💾 Commit...');
            try {
              await run(`git commit -m "Deploy ${timestamp}"`);
            } catch (e) {
              // Nessuna modifica da committare
              log('ℹ️ Nessuna modifica da committare');
            }

            log('🚀 Push su GitHub...');
            await run('git push');

            log('☁️ Avvio build su Vercel...');
            const { default: https } = await import('https');
            await new Promise((resolve, reject) => {
              const url = new URL(VERCEL_HOOK);
              const reqVercel = https.request({
                hostname: url.hostname, path: url.pathname,
                method: 'POST', headers: { 'Content-Length': 0 }
              }, r => {
                r.on('data', () => {});
                r.on('end', () => r.statusCode < 400 ? resolve() : reject(new Error(`Vercel: ${r.statusCode}`)));
              });
              reqVercel.on('error', reject);
              reqVercel.end();
            });

            log('✅ Deploy avviato! L\'app sarà aggiornata in pochi minuti.');
            res.end(JSON.stringify({ success: true, steps }));
          } catch (err) {
            log('❌ Errore: ' + err.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, steps, error: err.message }));
          }
        })();

        return;
      }

      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), deployPlugin()],
})
