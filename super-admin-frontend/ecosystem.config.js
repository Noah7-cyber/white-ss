module.exports = {
  apps: [
    {
      name: "web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/home/ubuntu/whitepenguin",
      max_restarts: 5,
      min_uptime: "10s",
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};



