/**
 * Rutas de IA - Generación de historias y diálogos con OpenAI
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function checkOpenAI(req, res, next) {
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith('sk-')) {
    return res.status(503).json({
      error: 'OpenAI no está configurada. Añade la variable OPENAI_API_KEY en Render (Environment).',
      code: 'MISSING_API_KEY'
    });
  }
  next();
}

/**
 * Generar historia completa con IA
 * POST /api/ai/generate-story
 */
router.post('/generate-story', checkOpenAI, async (req, res) => {
  try {
    const {
      genero = 'drama',
      tema = '',
      personajes = [],
      tono = 'serio',
      duracion = '1:30',
      final = 'abierto',
      modo = 'ia', // 'ia' o 'propia'
      ideaUsuario = ''
    } = req.body;

    if (!personajes || personajes.length < 2) {
      return res.status(400).json({ error: 'Necesitas al menos 2 personajes para crear una conversación.' });
    }

    const nombres = personajes.map(p => p.nombre || p.name).join(', ');
    const numMensajes = estimarMensajes(duracion);

    let systemPrompt = `Eres un guionista experto en crear conversaciones de chat realistas y emocionantes para videos cortos de TikTok/Reels.
Debes generar un diálogo natural entre los personajes. REGLAS IMPORTANTES:
- Un personaje puede enviar varios mensajes seguidos (1 a 4) antes de que responda otro. NO alternes obligatoriamente.
- Los mensajes deben tener longitudes variadas: algunos cortos, otros más largos.
- Usa lenguaje natural, con pausas emocionales, interrupciones y reacciones realistas.
- Evita respuestas robóticas o repetitivas.
- La conversación debe tener inicio, desarrollo y final coherente.
- Responde ÚNICAMENTE con un JSON válido, sin markdown ni explicaciones.`;

    let userPrompt = '';

    if (modo === 'propia' && ideaUsuario.trim()) {
      userPrompt = `Convierte esta idea del usuario en una conversación de chat completa y natural:

IDEA: ${ideaUsuario}

Personajes disponibles: ${nombres}
Género/tono: ${genero} / ${tono}
Número aproximado de mensajes: ${numMensajes}
Final deseado: ${final}

Devuelve un JSON con esta estructura exacta:
{
  "titulo": "Título corto de la historia",
  "resumen": "Resumen de 1-2 frases",
  "mensajes": [
    { "personaje": "Nombre exacto del personaje", "texto": "Texto del mensaje" },
    ...
  ]
}`;
    } else {
      userPrompt = `Crea una historia completa de chat ficticio con estos parámetros:

Género: ${genero}
Tema: ${tema || 'relación personal'}
Personajes: ${nombres}
Tono: ${tono}
Duración objetivo: ${duracion} (aprox. ${numMensajes} mensajes)
Tipo de final: ${final}

Devuelve un JSON con esta estructura exacta:
{
  "titulo": "Título corto de la historia",
  "resumen": "Resumen de 1-2 frases",
  "mensajes": [
    { "personaje": "Nombre exacto del personaje", "texto": "Texto del mensaje" },
    ...
  ]
}

Asegúrate de que los nombres de "personaje" coincidan exactamente con los proporcionados.`;
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 2500,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const content = response.data.choices[0].message.content;
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      // Intentar extraer JSON si viene con texto extra
      const match = content.match(/\{[\s\S]*\}/);
      if (match) data = JSON.parse(match[0]);
      else throw new Error('Respuesta de IA no válida');
    }

    // Validar y limpiar mensajes
    if (!data.mensajes || !Array.isArray(data.mensajes)) {
      return res.status(500).json({ error: 'La IA no generó mensajes válidos. Intenta de nuevo.' });
    }

    data.mensajes = data.mensajes
      .filter(m => m.texto && m.texto.trim())
      .map(m => ({
        personaje: m.personaje || m.character || personajes[0].nombre,
        texto: String(m.texto).trim().slice(0, 500)
      }));

    res.json({
      success: true,
      titulo: data.titulo || 'Conversación generada',
      resumen: data.resumen || '',
      mensajes: data.mensajes
    });

  } catch (err) {
    console.error('Error OpenAI:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    let msg = 'Error al generar la historia con IA.';
    if (status === 401) msg = 'Clave de OpenAI inválida. Revisa OPENAI_API_KEY en Render.';
    else if (status === 429) msg = 'Límite de uso de OpenAI alcanzado. Espera un momento o revisa tu plan.';
    else if (err.code === 'ECONNABORTED') msg = 'La IA tardó demasiado. Intenta con una duración más corta.';
    res.status(status === 401 || status === 429 ? status : 500).json({ error: msg });
  }
});

/**
 * Regenerar un mensaje individual
 */
router.post('/regenerate-message', checkOpenAI, async (req, res) => {
  try {
    const { contexto, personaje, tono = 'natural' } = req.body;
    if (!personaje) return res.status(400).json({ error: 'Falta el personaje.' });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Genera un solo mensaje de chat realista y natural. Responde solo con el texto del mensaje, sin comillas ni explicaciones.'
          },
          {
            role: 'user',
            content: `Contexto de la conversación:\n${contexto || 'Inicio de conversación'}\n\nGenera el siguiente mensaje de ${personaje} (tono: ${tono}). Máximo 120 caracteres.`
          }
        ],
        temperature: 0.9,
        max_tokens: 150
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const texto = response.data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    res.json({ success: true, texto });
  } catch (err) {
    console.error('Error regenerar:', err.message);
    res.status(500).json({ error: 'No se pudo regenerar el mensaje.' });
  }
});

function estimarMensajes(duracion) {
  // Aproximación: ~4-6 segundos por mensaje con voz
  const map = {
    '1:00': 12,
    '1:12': 14,
    '1:30': 18,
    '1:45': 22,
    '2:00': 26
  };
  return map[duracion] || 18;
}

module.exports = router;
