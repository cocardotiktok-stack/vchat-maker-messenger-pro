# vChat Maker Messenger Pro

Aplicación web completa para crear videos de conversaciones ficticias (fake chat) orientados a TikTok, YouTube Shorts e Instagram Reels.

## Características

- Crear y gestionar personajes (nombre, foto de perfil, voz)
- Generar historias con IA (OpenAI) o a partir de tu propia idea
- Editor de mensajes con reordenamiento y regeneración
- Vista previa animada del chat
- Integración con ElevenLabs para voces
- Exportación de video vertical 9:16, audio MP3 e imagen PNG
- Marca de agua configurable
- Interfaz en español, diseño oscuro moderno

## Requisitos

- Node.js 18 o superior
- Cuentas y claves de:
  - [OpenAI](https://platform.openai.com/api-keys) (para historias)
  - [ElevenLabs](https://elevenlabs.io) (para voces)

## Instalación local

```bash
npm install
cp .env.example .env
# Edita .env y añade tus claves
npm start
```

Abre http://localhost:3000

## Despliegue en Render

1. Sube este proyecto a un repositorio de GitHub.
2. En [Render](https://dashboard.render.com) crea un **Web Service**.
3. Conecta el repositorio.
4. Configuración:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. En **Environment** añade:
   - `OPENAI_API_KEY` = tu clave de OpenAI
   - `ELEVENLABS_API_KEY` = tu clave de ElevenLabs
6. Despliega.

### Límites del plan gratuito de Render

- El servicio se suspende tras ~15 minutos de inactividad (el primer acceso puede tardar 30-60 segundos).
- Memoria y CPU limitadas: la exportación de videos muy largos puede fallar.
- Se recomienda exportar desde el navegador (opción principal de la app).

## Estructura del proyecto

```
vchat-maker-messenger-pro/
├── server.js              # Servidor Express
├── package.json
├── .env.example
├── .gitignore
├── routes/
│   ├── ai.js              # Generación de historias (OpenAI)
│   ├── voices.js          # Voces (ElevenLabs)
│   └── video.js           # Utilidades de audio/video
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── uploads/               # Archivos subidos (temporal)
└── temp/                  # Audios generados (temporal)
```

## Seguridad

Las claves de API **nunca** se exponen al navegador. Todas las llamadas a OpenAI y ElevenLabs pasan por el backend.

## Licencia

MIT
