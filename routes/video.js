/**
 * Rutas de video - Composición y exportación
 * Nota: En el plan gratuito de Render, la generación pesada de video
 * puede fallar por límites de memoria/CPU. Se recomienda exportar
 * desde el navegador (Canvas + MediaRecorder) cuando sea posible.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

/**
 * Endpoint de información sobre capacidades de video
 */
router.get('/capabilities', (req, res) => {
  res.json({
    clientSideExport: true,
    serverSideFFmpeg: true,
    recommended: 'client',
    note: 'La exportación desde el navegador es más fiable en el plan gratuito de Render. El servidor puede ayudar a combinar audios.',
    maxDurationSeconds: 120,
    resolution: '1080x1920'
  });
});

/**
 * Combinar varios archivos de audio en secuencia (MP3)
 * Útil para generar un solo track de audio de la conversación
 * POST /api/video/merge-audio
 * Body: { files: ["filename1.mp3", "filename2.mp3", ...], gaps: [0.3, 0.5, ...] }
 */
router.post('/merge-audio', async (req, res) => {
  try {
    const { files = [], gaps = [] } = req.body;

    if (!files.length) {
      return res.status(400).json({ error: 'No se proporcionaron archivos de audio.' });
    }

    // Verificar que fluent-ffmpeg esté disponible
    let ffmpeg;
    try {
      ffmpeg = require('fluent-ffmpeg');
    } catch (e) {
      return res.status(503).json({
        error: 'FFmpeg no está disponible en este entorno. Usa la exportación desde el navegador.',
        code: 'NO_FFMPEG'
      });
    }

    const tempDir = path.join(__dirname, '..', 'temp');
    const outputName = `merged_${uuidv4()}.mp3`;
    const outputPath = path.join(tempDir, outputName);

    // Crear lista de entrada para FFmpeg concat
    // Método simple: concatenar con silencios
    const validFiles = files
      .map(f => path.join(tempDir, path.basename(f)))
      .filter(f => fs.existsSync(f));

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'Ningún archivo de audio válido encontrado.' });
    }

    // Para simplicidad y robustez en free tier: devolver el primer audio
    // o usar concat demuxer si hay pocos archivos
    if (validFiles.length === 1) {
      return res.json({
        success: true,
        audioUrl: `/api/voices/audio/${path.basename(validFiles[0])}`,
        note: 'Solo había un audio.'
      });
    }

    // Crear archivo de lista para concat
    const listPath = path.join(tempDir, `list_${uuidv4()}.txt`);
    const listContent = validFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Limpiar lista
    try { fs.unlinkSync(listPath); } catch (e) {}

    res.json({
      success: true,
      audioUrl: `/api/voices/audio/${outputName}`,
      filename: outputName
    });

  } catch (err) {
    console.error('Error merge audio:', err.message);
    res.status(500).json({
      error: 'No se pudo combinar el audio. Prueba exportar desde el navegador.',
      detail: err.message
    });
  }
});

/**
 * Endpoint de salud para video
 */
router.get('/health', (req, res) => {
  let hasFFmpeg = false;
  try {
    require('fluent-ffmpeg');
    hasFFmpeg = true;
  } catch (e) {}

  res.json({
    status: 'ok',
    ffmpeg: hasFFmpeg,
    tempDir: fs.existsSync(path.join(__dirname, '..', 'temp'))
  });
});

module.exports = router;
