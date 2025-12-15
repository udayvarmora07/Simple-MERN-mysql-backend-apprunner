const express = require('express');
const cors = require('cors');

// Only load dotenv in development (not needed in production with PM2)
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const { initializeDatabase } = require('./config/db');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);

// Health check endpoints
const startTime = Date.now();

// Liveness probe - basic check if server is running    
app.get('/api/health/live', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

// Readiness probe - checks if app is ready to accept traffic
app.get('/api/health/ready', async (req, res) => {
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        checks: {}
    };

    // Check database connection
    try {
        const { pool } = require('./config/db');
        const [rows] = await pool.query('SELECT 1 as result');
        health.checks.database = {
            status: 'UP',
            responseTime: 'OK'
        };
    } catch (error) {
        health.status = 'DOWN';
        health.checks.database = {
            status: 'DOWN',
            error: error.message
        };
    }

    const statusCode = health.status === 'UP' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Comprehensive health check
app.get('/api/health', async (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: {
            name: 'mern-mysql-backend',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version
        },
        uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
        },
        memory: {
            heapUsed: formatBytes(memoryUsage.heapUsed),
            heapTotal: formatBytes(memoryUsage.heapTotal),
            rss: formatBytes(memoryUsage.rss),
            external: formatBytes(memoryUsage.external)
        },
        checks: {}
    };

    // Database health check
    try {
        const { pool } = require('./config/db');
        const startDb = Date.now();
        const [rows] = await pool.query('SELECT 1 as result');
        const dbResponseTime = Date.now() - startDb;

        health.checks.database = {
            status: 'UP',
            responseTime: `${dbResponseTime}ms`
        };
    } catch (error) {
        health.status = 'DOWN';
        health.checks.database = {
            status: 'DOWN',
            error: error.message
        };
    }

    const statusCode = health.status === 'UP' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Helper functions
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV}`);
            console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
