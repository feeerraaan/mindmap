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
  ],
}
