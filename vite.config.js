import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'

const deployPlugin = () => ({
  name: 'deploy-endpoint',
  configureServer(server) {
    server.middlewares.use('/api', (req, res, next) => {
      if (req.url === '/deploy-status' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        exec('git -C /Users/emanuelemancini/.gemini/antigravity/scratch/gestionale-didattico status -s', (error, stdout) => {
          if (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: error.message }));
            return;
          }
          const files = stdout ? stdout.split('\n').filter(line => line.trim().length > 0) : [];
          res.end(JSON.stringify({ success: true, files }));
        });
        return;
      }

      if (req.url === '/deploy' && req.method === 'POST') {
        res.setHeader('Content-Type', 'application/json');
        
        exec('npx vercel --prod', (error, stdout, stderr) => {
          if (error) {
            console.error(`Deploy error: ${error.message}`);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: error.message }));
            return;
          }
          console.log(`Deploy stdout: ${stdout}`);
          res.end(JSON.stringify({ success: true, output: stdout }));
        });
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
