module.exports = {
  apps: [
    {
      name: 'wjadlink',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        CLOUDFLARE_API_TOKEN: 'skip',
        WRANGLER_SEND_METRICS: 'false'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 3,
      min_uptime: '5s'
    }
  ]
}
