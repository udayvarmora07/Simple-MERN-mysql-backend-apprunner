# MERN Stack with MySQL

A full-stack application using React (frontend), Node.js/Express (backend), MySQL (database), and PM2 (process manager).

## Project Structure

```
Simple-MERN-mysql/
├── backend/
│   ├── config/db.js           # MySQL connection
│   ├── controllers/userController.js
│   ├── routes/userRoutes.js
│   ├── server.js              # Express server
│   ├── .env                   # Environment variables
│   └── pm2.config.json        # PM2 configuration
├── frontend/
│   ├── src/
│   │   ├── components/UserList.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   └── vite.config.js
└── README.md
```

## Prerequisites

- Node.js (v16 or higher)
- MySQL Server
- PM2 (optional, for production)

## Setup

### 1. Database Setup

Make sure MySQL is running and update the `.env` file in the backend folder with your credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mern_mysql_db
```

### 2. Backend Setup

```bash
cd backend
npm install
npm start
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

## Using PM2

To run the backend with PM2:

```bash
cd backend

# Start with PM2
npm run pm2:start

# View logs
pm2 logs mern-mysql-backend

# Stop
npm run pm2:stop

# Restart
npm run pm2:restart
```

## API Endpoints

| Method | Endpoint        | Description      |
|--------|-----------------|------------------|
| GET    | /api/users      | Get all users    |
| GET    | /api/users/:id  | Get user by ID   |
| POST   | /api/users      | Create new user  |
| PUT    | /api/users/:id  | Update user      |
| DELETE | /api/users/:id  | Delete user      |
| GET    | /api/health     | Health check     |

## Environment Variables

### Backend (.env)

| Variable     | Description              | Default              |
|--------------|--------------------------|----------------------|
| PORT         | Server port              | 5000                 |
| NODE_ENV     | Environment              | development          |
| DB_HOST      | MySQL host               | localhost            |
| DB_PORT      | MySQL port               | 3306                 |
| DB_USER      | MySQL username           | root                 |
| DB_PASSWORD  | MySQL password           | password             |
| DB_NAME      | Database name            | mern_mysql_db        |
| FRONTEND_URL | Frontend URL (for CORS)  | http://localhost:5173|

## Tech Stack

- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **Database**: MySQL
- **Process Manager**: PM2
