import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileRoutes } from './routes/fileRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', fileRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`- Upload endpoint: http://localhost:${PORT}/api/upload`);
  console.log(`- Download endpoint: http://localhost:${PORT}/api/download/:id`);
});

export default app;
