import { readFile, writeFile, mkdir } from 'node:fs/promises'

const CONFIG = './welcome.json'
const MEDIA_DIR = './welcome-media'

async function loadSettings() {
  try {
    const data = JSON.parse(await readFile(CONFIG, 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
}

async function saveSettings(data) {
  await writeFile(CONFIG, JSON.stringify(data, null, 2) + '\n')
}

function groupKey(jid) {
  return Buffer.from(jid).toString('base64url')
}

function getQuoted(message = {}) {
  const m = message.message || {}
  return m.extendedTextMessage?.contextInfo?.quotedMessage ||
    m.imageMessage?.contextInfo?.quotedMessage ||
    m.audioMessage?.contextInfo?.quotedMessage ||
    null
}

function findMedia(m, kind) {
  const direct = m.message || {}
  const quoted = getQuoted(m) || {}
  const type = kind === 'image' ? 'imageMessage' : 'audioMessage'
  return direct[type] || quoted[type] || null
}

function expandText(template, user, group) {
  return String(template || '')
    .replace(/@user|\{user\}/gi, '@' + user.split('@')[0].split(':')[0])
    .replace(/\{group\}|@group/gi, group || 'este grupo')
}

export async function handleWelcomeCommand(ctx) {
  const {
    command, args, argText, m, jid, sender, sock, reply, group,
    isOwner, isAdmin, downloadContentFromMessage, streamToBuffer
  } = ctx

  const isWelcome = command === 'welcome'
  const isBye = command === 'bye'
  const isSetWelcome = command === 'setwelcome'
  const isSetBye = command === 'setbye'

  if (!isWelcome && !isBye && !isSetWelcome && !isSetBye) return false

  if (!group) {
    await reply('🌸 Este comando se configura dentro de un grupo.')
    return true
  }

  if (!await isOwner(sock, sender, jid) &&
      !await isAdmin(sock, jid, sender)) {
    await reply('🛡️ Solo los administradores del grupo o propietarios del bot pueden usarlo.')
    return true
  }

  const data = await loadSettings()
  const cfg = data[jid] || {
    welcomeEnabled: false,
    byeEnabled: false,
    welcomeMessage: '🌸 ¡Bienvenido/a @user a @group!',
    byeMessage: '🌷 ¡Hasta pronto, @user!',
    welcomeImage: '',
    welcomeAudio: '',
    welcomeAudioMime: '',
    byeImage: '',
    byeAudio: '',
    byeAudioMime: ''
  }

  if (isWelcome || isBye) {
    const enabled = args[0] === '1'
    if (!['1', '0'].includes(args[0] || '')) {
      await reply('Uso:\n.welcome 1\n.welcome 0\n.bye 1\n.bye 0')
      return true
    }

    if (isWelcome) cfg.welcomeEnabled = enabled
    else cfg.byeEnabled = enabled

    data[jid] = cfg
    await saveSettings(data)
    await reply(
      (isWelcome ? '🌸 Bienvenidas' : '🌷 Despedidas') +
      (enabled ? ' ACTIVADAS.' : ' DESACTIVADAS.')
    )
    return true
  }

  const rawMode = (args[0] || '').toLowerCase()
  const mode = ['mensaje', 'imagen', 'audio'].includes(rawMode)
    ? rawMode
    : (argText.trim() ? 'mensaje' : '')
  const isW = isSetWelcome
  const label = isW ? 'welcome' : 'bye'

  if (mode === 'mensaje') {
    const message = rawMode === 'mensaje'
      ? argText.slice(argText.indexOf(' ') + 1).trim()
      : argText.trim()
    if (!message) {
      await reply(
        `Escribe el mensaje después de "${prefixHint(label)} mensaje".\n` +
        'Puedes usar @user y @group.\n' +
        `Ejemplo: ${prefixHint(label)} mensaje ¡Hola @user!`
      )
      return true
    }

    cfg[isW ? 'welcomeMessage' : 'byeMessage'] = message
    data[jid] = cfg
    await saveSettings(data)
    await reply('✅ Mensaje guardado correctamente.')
    return true
  }

  if (mode === 'imagen' || mode === 'audio') {
    const kind = mode === 'imagen' ? 'image' : 'audio'
    const media = findMedia(m, kind)

    if (!media) {
      await reply(
        `📎 Responde a una ${kind === 'image' ? 'imagen' : 'nota de audio o audio'} con:\n` +
        `.${label} ${mode}`
      )
      return true
    }

    const stream = await downloadContentFromMessage(media, kind)
    const buffer = await streamToBuffer(stream)
    if (!buffer?.length) {
      await reply('❌ No pude descargar ese archivo. Inténtalo otra vez.')
      return true
    }

    await mkdir(MEDIA_DIR, { recursive: true })
    const file = `${MEDIA_DIR}/${groupKey(jid)}-${label}.${kind}`
    await writeFile(file, buffer)

    if (kind === 'image') {
      cfg[isW ? 'welcomeImage' : 'byeImage'] = file
    } else {
      cfg[isW ? 'welcomeAudio' : 'byeAudio'] = file
      cfg[isW ? 'welcomeAudioMime' : 'byeAudioMime'] =
        media.mimetype || 'audio/ogg; codecs=opus'
    }

    data[jid] = cfg
    await saveSettings(data)
    await reply(`✅ ${mode === 'imagen' ? 'Imagen' : 'Audio'} guardado para ${isW ? 'bienvenidas' : 'despedidas'}.`)
    return true
  }

  await reply(
    `🌸 Configuración de ${isW ? 'bienvenidas' : 'despedidas'}\n\n` +
    `.${label} mensaje Tu mensaje con @user y @group\n` +
    `.${label} imagen (respondiendo a una imagen)\n` +
    `.${label} audio (respondiendo a un audio)`
  )
  return true
}

function prefixHint(label) {
  return '.' + label
}

export function installWelcomeEvents(sock, deps) {
  const { readFile } = deps

  sock.ev.on('group-participants.update', async update => {
    try {
      const { id, participants = [], action } = update
      if (!id?.endsWith('@g.us')) return
      if (action !== 'add' && action !== 'remove') return

      const data = await loadSettings()
      const cfg = data[id]
      if (!cfg) return

      const entering = action === 'add'
      if (entering ? !cfg.welcomeEnabled : !cfg.byeEnabled) return

      let groupName = 'este grupo'
      try {
        const metadata = await sock.groupMetadata(id)
        groupName = metadata.subject || groupName
      } catch {}

      for (const p of participants) {
        const user = typeof p === 'string'
          ? p
          : p?.id || p?.jid || p?.lid || ''

        if (!user) continue

        const type = entering ? 'welcome' : 'bye'
        const imagePath = cfg[type + 'Image']
        const audioPath = cfg[type + 'Audio']
        const template = cfg[type + 'Message'] ||
          (entering ? '🌸 ¡Bienvenido/a @user!' : '🌷 ¡Hasta pronto, @user!')
        const text = expandText(template, user, groupName)
        const mentions = [user]

        if (imagePath) {
          try {
            const image = await readFile(imagePath)
            await sock.sendMessage(id, { image, caption: text, mentions })
          } catch {
            await sock.sendMessage(id, { text, mentions })
          }
        } else {
          await sock.sendMessage(id, { text, mentions })
        }

        if (audioPath) {
          try {
            const audio = await readFile(audioPath)
            const mime = cfg[type + 'AudioMime'] || 'audio/ogg; codecs=opus'
            await sock.sendMessage(id, { audio, mimetype: mime })
          } catch (e) {
            console.error('No se pudo enviar audio de bienvenida/despedida:', e.message)
          }
        }
      }
    } catch (e) {
      console.error('Error en bienvenidas/despedidas:', e.message)
    }
  })
}
