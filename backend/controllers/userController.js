const { pool } = require('../config/db');

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        res.json({
            success: true,
            data: rows,
            message: 'Users fetched successfully',
            envs: process.env.DB_HOST
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
};

// Get user by ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message
        });
    }
};

// Create new user
const createUser = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and email are required'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            [name, email]
        );

        const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: newUser[0]
        });
    } catch (error) {
        console.error('Error creating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message
        });
    }
};

// Update user
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and email are required'
            });
        }

        const [result] = await pool.query(
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name, email, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: error.message
        });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: error.message
        });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};
