module.exports = {
    apps: [
        {
            name: 'mern-mysql-backend',
            script: 'server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                PORT: process.env.PORT || 5000,
                DB_HOST: process.env.DB_HOST,
                DB_PORT: process.env.DB_PORT || 3306,
                DB_USER: process.env.DB_USER,
                DB_PASSWORD: process.env.DB_PASSWORD,
                DB_NAME: process.env.DB_NAME,
                FRONTEND_URL: process.env.FRONTEND_URL,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 5000,
                DB_HOST: process.env.DB_HOST,
                DB_PORT: process.env.DB_PORT || 3306,
                DB_USER: process.env.DB_USER,
                DB_PASSWORD: process.env.DB_PASSWORD,
                DB_NAME: process.env.DB_NAME,
                FRONTEND_URL: process.env.FRONTEND_URL,
            },
        },
    ],
};
