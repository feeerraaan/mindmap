module.exports = {
  apps: [
    {
      name: 'mindmap-prod',
      cwd: '/root/mindmap/apps/web',
      script: './node_modules/.bin/next',
      args: 'start -p 3100',
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
      },
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
    },
    {
      // Private storage for document originals. The Vercel-hosted web app
      // reaches it through nginx at https://storage.azpy.es.
      name: 'mindmap-storage',
      cwd: '/root/mindmap',
      script: './scripts/storage-server.mjs',
      node_args: '--env-file=/root/mindmap/.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
    },
  ],
}
