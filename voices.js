/**
 * Rutas de voces - Integración con ElevenLabs
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

function checkElevenLabs(req, res, next) {
  if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY.length < 10) {
    return res.status(503).json({
      error: 'ElevenLabs no está configurada. Añade la variable ELEVENLABS_API_KEY en Render (Environment).',
      code: 'MISSING_API_KEY'
    });
  }
  next();
}

/**
 * Listar voces disponibles del usuario
 * GET /api/voices/list
 */
router.get('/list', checkElevenLabs, async (req, res) => {
  try {
    const response = await axios.get(`${ELEVENLABS_BASE}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      },
      timeout: 20000
    });

    const voices = (response.data.voices || []).map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'cloned',
      description: v.description || '',
      labels: v.labels || {},
      preview_url: v.preview_url || null
    }));

    res.json({
      success: true,
      voices,
      count: voices.length
    });
  } catch (err) {
    console.error('Error listar voces:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    let msg = 'Error al obtener las voces de ElevenLabs.';
    if (status === 401) msg = 'Clave de ElevenLabs inválida. Revisa ELEVENLABS_API_KEY.';
    else if (status === 429) msg = 'Límite de uso de ElevenLabs alcanzado.';
    res.status(status === 401 || status === 429 ? status : 500).json({ error: msg });
  }
});

/**
 * Generar audio de un mensaje
 * POST /api/voices/generate
 * Body: { text, voice_id, stability?, similarity_boost?, style?, speed? }
 */
router.post('/generate', checkElevenLabs, async (req, res) => {
  try {
    const {
      text,
      voice_id,
      stability = 0.5,
      similarity_boost = 0.75,
      style = 0.0,
      speed = 1.0
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'El texto del mensaje está vacío.' });
    }
    if (!voice_id) {
      return res.status(400).json({ error: 'Debes seleccionar una voz (voice_id).' });
    }

    const cleanText = String(text).trim().slice(0, 500);

    // Modelo multilingual v2 es bueno para español
    const modelId = 'eleven_multilingual_v2';

    const response = await axios.post(
      `${ELEVENLABS_BASE}/text-to-speech/${voice_id}`,
      {
        text: cleanText,
        model_id: modelId,
        voice_settings: {
          stability: Math.min(1, Math.max(0, Number(stability))),
          similarity_boost: Math.min(1, Math.max(0, Number(similarity_boost))),
          style: Math.min(1, Math.max(0, Number(style))),
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 45000
      }
    );

    // Guardar temporalmente y devolver URL
    const filename = `voice_${uuidv4()}.mp3`;
    const filePath = path.join(__dirname, '..', 'temp', filename);
    fs.writeFileSync(filePath, Buffer.from(response.data));

    res.json({
      success: true,
      audioUrl: `/api/voices/audio/${filename}`,
      filename,
      size: response.data.byteLength
    });

  } catch (err) {
    console.error('Error generar voz:', err.response?.data ? Buffer.from(err.response.data).toString() : err.message);
    const status = err.response?.status || 500;
    let msg = 'Error al generar el audio con ElevenLabs.';
    if (status === 401) msg = 'Clave de ElevenLabs inválida.';
    else if (status === 429) msg = 'Sin créditos o límite de ElevenLabs alcanzado. Revisa tu plan.';
    else if (status === 400) msg = 'Parámetros de voz inválidos o voz no encontrada.';
    res.status(status >= 400 && status < 500 ? status : 500).json({ error: msg });
  }
});

/**
 * Servir archivo de audio temporal
 */
router.get('/audio/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, '..', 'temp', filename);

  if (!fs.existsSync(filePath) || !filename.endsWith('.mp3')) {
    return res.status(404).json({ error: 'Audio no encontrado.' });
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

/**
 * Generar varios audios en secuencia (para una conversación)
 * POST /api/voices/generate-batch
 */
router.post('/generate-batch', checkElevenLabs, async (req, res) => {
  try {
    const { mensajes, voiceMap } = req.body;
    // mensajes: [{ id, texto, personaje }]
    // voiceMap: { "NombrePersonaje": "voice_id" }

    if (!mensajes || !Array.isArray(mensajes) || mensajes.length === 0) {
      return res.status(400).json({ error: 'No hay mensajes para generar audio.' });
    }
    if (!voiceMap || typeof voiceMap !== 'object') {
      return res.status(400).json({ error: 'Falta el mapa de voces por personaje.' });
    }

    const results = [];
    for (const msg of mensajes.slice(0, 40)) {
      const voiceId = voiceMap[msg.personaje];
      if (!voiceId || !msg.texto) {
        results.push({ id: msg.id, success: false, error: 'Sin voz o texto' });
        continue;
      }

      try {
        const response = await axios.post(
          `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
          {
            text: String(msg.texto).trim().slice(0, 500),
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            }
          },
          {
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer',
            timeout: 40000
          }
        );

        const filename = `voice_${uuidv4()}.mp3`;
        const filePath = path.join(__dirname, '..', 'temp', filename);
        fs.writeFileSync(filePath, Buffer.from(response.data));

        results.push({
          id: msg.id,
          success: true,
          audioUrl: `/api/voices/audio/${filename}`,
          filename
        });
      } catch (e) {
        results.push({ id: msg.id, success: false, error: 'Error generando audio' });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Error batch voces:', err.message);
    res.status(500).json({ error: 'Error al generar los audios.' });
  }
});

module.exports = router;
