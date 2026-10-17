/**
 * vChat Maker Messenger Pro - Servidor principal
 * Backend Node.js + Express
 * Listo para desplegar en Render
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const aiRoutes = require('./routes/ai');
const voicesRoutes = require('./routes/voices');
const videoRoutes = require('./routes/video');

const app = express();
const PORT = process.env.PORT || 3000;

// Crear carpetas necesarias
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
[uploadsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Servir archivos subidos temporalmente
app.use('/uploads', express.static(uploadsDir));

// Configuración de Multer para subidas
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) || allowed.test(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Usa imágenes (jpg, png, webp) o videos (mp4, webm).'));
    }
  }
});

// Rutas de API
app.use('/api/ai', aiRoutes);
app.use('/api/voices', voicesRoutes);
app.use('/api/video', videoRoutes);

// Subida de imágenes de perfil y fondos
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Error en subida:', err);
    res.status(500).json({ error: 'Error al subir el archivo.' });
  }
});

// Estado del servidor y configuración de APIs
app.get('/api/status', (req, res) => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.length > 10;

  res.json({
    status: 'ok',
    app: 'vChat Maker Messenger Pro',
    version: '1.0.0',
    apis: {
      openai: hasOpenAI ? 'configurada' : 'no configurada',
      elevenlabs: hasElevenLabs ? 'configurada' : 'no configurada'
    },
    message: hasOpenAI && hasElevenLabs
      ? 'Todas las APIs están listas.'
      : 'Configura las variables de entorno OPENAI_API_KEY y ELEVENLABS_API_KEY en Render para usar IA y voces.'
  });
});

// Limpieza periódica de archivos temporales (cada 30 min)
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hora
  [uploadsDir, tempDir].forEach(dir => {
    try {
      fs.readdirSync(dir).forEach(file => {
        if (file === '.gitkeep') return;
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (e) { /* ignore */ }
  });
}, 30 * 60 * 1000);

// Ruta principal - servir la app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 15 MB.' });
    }
  }
  res.status(500).json({ error: err.message || 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`🚀 vChat Maker Messenger Pro corriendo en puerto ${PORT}`);
  console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
  console.log(`   ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? '✅' : '❌'}`);
});
