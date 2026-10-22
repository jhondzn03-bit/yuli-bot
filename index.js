import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadContentFromMessage
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import sharp from 'sharp'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { config } from './config.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const prefix = config.prefix

const menu = () => `
╭━━━〔 🌺 YULI BOT 🌺 〕━━━╮
│  ✿ Floral Edition • WhatsApp
╰━━━━━━━━━━━━━━━━━━━━━━╯

🌸 𝐆𝐑𝐔𝐏𝐎𝐒
│ ${prefix}tagall
│ ${prefix}hidetag
│ ${prefix}kick @usuario
│ ${prefix}promote @usuario
│ ${prefix}demote @usuario
│ ${prefix}open
│ ${prefix}close
│ ${prefix}admins

🌷 𝐉𝐔𝐄𝐆𝐎𝐒
│ ${prefix}dado
│ ${prefix}moneda
│ ${prefix}ppt piedra/papel/tijera

💗 𝐇𝐄𝐑𝐑𝐀𝐌𝐈𝐄𝐍𝐓𝐀𝐒
│ ${prefix}sticker (responde a una imagen)
│ ${prefix}ping
│ ${prefix}runtime
│ ${prefix}descargas

👑 𝐎𝐖𝐍𝐄𝐑
│ ${prefix}owner
│ ${prefix}estado

╰━━━〔 🌺 YULI BOT 🌺 〕━━━╯
`

function getText(message = {}) {
  const m = message.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  )
}

function getMentioned(message = {}) {
  const m = message.message || {}
  return m.extendedTextMessage?.contextInfo?.mentionedJid || []
}

function getQuoted(message = {}) {
  const m = message.message || {}
  return m.extendedTextMessage?.contextInfo?.quotedMessage || null
}

function getImage(message = {}) {
  const m = message.message || {}
  if (m.imageMessage) return m.imageMessage
  const quoted = getQuoted(message)
  return quoted?.imageMessage || null
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function isAdmin(sock, jid, sender) {
  const metadata = await sock.groupMetadata(jid)
  const participant = metadata.participants.find(p => p.id === sender)
  const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
  const bot = metadata.participants.find(p => p.id === botId)

  return {
    admin: Boolean(participant?.admin),
    botAdmin: Boolean(bot?.admin),
    metadata
  }
}

function senderNumber(jid = '') {
  return jid.split('@')[0].split(':')[0]
}

function isOwner(sender) {
  return config.owners.includes(senderNumber(sender))
}

async function connectToWhatsApp() {
  const { state, saveCreds } =
    await useMultiFileAuthState('./session')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update

    if (connection === 'connecting') {
      console.log('🌸 Conectando Yuli Bot...')
    }

    if (connection === 'open') {
      console.log('🌺 Yuli Bot está conectado a WhatsApp.')
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      console.log('💗 Conexión cerrada. Código:', code || 'desconocido')

      if (code !== DisconnectReason.loggedOut) {
        await sleep(3000)
        connectToWhatsApp().catch(console.error)
      } else {
        console.log('Sesión cerrada. Borra la sesión solo si deseas vincular de nuevo.')
      }
    }
  })

  if (!sock.authState.creds.registered) {
    const rl = readline.createInterface({ input, output })
    try {
      const number = (await rl.question(
        '🌺 Escribe tu número con código de país, solo dígitos: '
      )).trim()

      if (!/^\d{8,15}$/.test(number)) {
        throw new Error('Número no válido. Incluye el código de país.')
      }

      const code = await sock.requestPairingCode(number)
      console.log('\n╭━━━〔 🌸 YULI BOT 〕━━━╮')
      console.log('│ Tu código de vinculación:')
      console.log(`│       ${code}`)
      console.log('╰━━━━━━━━━━━━━━━━━━━━╯')
      console.log('En WhatsApp: Dispositivos vinculados → Vincular con número.')
      console.log('No compartas este código con nadie.\n')
    } catch (error) {
      console.error('No se pudo generar el código:', error.message)
    } finally {
      rl.close()
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const m of messages) {
      try {
        if (!m.message || m.key.fromMe) continue

        const jid = m.key.remoteJid
        if (!jid || jid === 'status@broadcast') continue

        const sender = m.key.participant || jid
        const text = getText(m).trim()
        if (!text.startsWith(prefix)) continue

        const args = text.slice(prefix.length).trim().split(/\s+/)
        const command = (args.shift() || '').toLowerCase()
        const argText = args.join(' ')
        const reply = body => sock.sendMessage(jid, { text: body }, { quoted: m })
        const group = jid.endsWith('@g.us')

        if (command === 'menu' || command === 'help') {
          await reply(menu())
          continue
        }

        if (command === 'ping') {
          await reply('🌺 Yuli Bot está activo.')
          continue
        }

        if (command === 'runtime') {
          const sec = Math.floor(process.uptime())
          const h = Math.floor(sec / 3600)
          const min = Math.floor((sec % 3600) / 60)
          await reply(`🌸 Tiempo activo: ${h} h ${min} min ${sec % 60} s`)
          continue
        }

        if (command === 'owner') {
          const owners = config.owners.length
            ? config.owners.map(n => `@${n}`).join('\n')
            : 'Configura tu número en config.js'
          await sock.sendMessage(jid, {
            text: `👑 Propietario de Yuli Bot\n${owners}`,
            mentions: config.owners.map(n => `${n}@s.whatsapp.net`)
          }, { quoted: m })
          continue
        }

        if (command === 'estado') {
          await reply(`🌺 ${config.name}\nPrefijo: ${prefix}\nEstado: en ejecución`)
          continue
        }

        if (command === 'descargas') {
          await reply(
            '📥 Módulo de descargas de Yuli Bot\n' +
            'Todavía falta configurar un proveedor compatible. ' +
            'No hay descargas activas en esta versión.'
          )
          continue
        }

        if (command === 'dado') {
          await reply(`🎲 Salió: ${1 + Math.floor(Math.random() * 6)}`)
          continue
        }

        if (command === 'moneda') {
          await reply(`🪙 ${Math.random() < 0.5 ? 'Cara' : 'Cruz'}`)
          continue
        }

        if (command === 'ppt') {
          const choices = ['piedra', 'papel', 'tijera']
          const player = argText.toLowerCase()
          if (!choices.includes(player)) {
            await reply(`Usa: ${prefix}ppt piedra, ${prefix}ppt papel o ${prefix}ppt tijera`)
            continue
          }

          const bot = choices[Math.floor(Math.random() * choices.length)]
          const result = player === bot ? 'Empate' :
            ((player === 'piedra' && bot === 'tijera') ||
             (player === 'papel' && bot === 'piedra') ||
             (player === 'tijera' && bot === 'papel'))
              ? '¡Ganaste!' : 'Ganó Yuli Bot'

          await reply(`🌸 Tú: ${player}\n🌺 Yuli: ${bot}\n💗 ${result}`)
          continue
        }

        if (command === 'sticker') {
          const image = getImage(m)
          if (!image) {
            await reply('🌷 Responde a una imagen con .sticker para convertirla.')
            continue
          }

          const stream = await downloadContentFromMessage(image, 'image')
          const buffer = await streamToBuffer(stream)
          const webp = await sharp(buffer)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .webp()
            .toBuffer()

          await sock.sendMessage(jid, { sticker: webp }, { quoted: m })
          continue
        }

        if (['tagall', 'hidetag', 'kick', 'promote', 'demote',
             'open', 'close', 'admins'].includes(command)) {
          if (!group) {
            await reply('🌸 Este comando solo funciona en grupos.')
            continue
          }

          const { admin, botAdmin, metadata } =
            await isAdmin(sock, jid, sender)

          if (command === 'admins') {
            const list = metadata.participants
              .filter(p => p.admin)
              .map(p => `• @${senderNumber(p.id)}`)
              .join('\n')

            await sock.sendMessage(jid, {
              text: `🌺 Administradores:\n${list || 'No encontrados'}`,
              mentions: metadata.participants.filter(p => p.admin).map(p => p.id)
            }, { quoted: m })
            continue
          }

          if (!admin && !isOwner(sender)) {
            await reply('🛡️ Solo los administradores pueden usar este comando.')
            continue
          }

          if (['kick', 'promote', 'demote', 'open', 'close'].includes(command)
              && !botAdmin) {
            await reply('🌷 Necesito ser administrador para hacer eso.')
            continue
          }

          if (command === 'tagall' || command === 'hidetag') {
            const participants = metadata.participants.map(p => p.id)
            const mentions = participants
            const heading = command === 'tagall'
              ? `🌺 Atención, grupo:\n${argText || 'Aviso general'}`
              : (argText || '🌸 Aviso del grupo')

            await sock.sendMessage(jid, {
              text: heading,
              mentions
            }, { quoted: m })
            continue
          }

          if (['kick', 'promote', 'demote'].includes(command)) {
            const mentioned = getMentioned(m)
            const digits = argText.replace(/\D/g, '')
            const targets = mentioned.length ? mentioned :
              (digits ? [`${digits}@s.whatsapp.net`] : [])

            if (!targets.length) {
              await reply(`Menciona al usuario. Ejemplo: ${prefix}${command} @usuario`)
              continue
            }

            const action = command === 'kick' ? 'remove' :
              command === 'promote' ? 'promote' : 'demote'

            await sock.groupParticipantsUpdate(jid, targets, action)
            await reply('🌺 Acción de grupo ejecutada.')
            continue
          }

          if (command === 'open' || command === 'close') {
            await sock.groupSettingUpdate(
              jid,
              command === 'open' ? 'not_announcement' : 'announcement'
            )
            await reply(command === 'open'
              ? '🌸 Grupo abierto para enviar mensajes.'
              : '🌺 Grupo cerrado: solo administradores pueden escribir.')
          }
        }
      } catch (error) {
        console.error('Error procesando comando:', error)
        try {
          await sock.sendMessage(m.key.remoteJid, {
            text: '🌷 Ocurrió un error al ejecutar el comando.'
          }, { quoted: m })
        } catch {}
      }
    }
  })
}

connectToWhatsApp().catch(error => {
  console.error('Error iniciando Yuli Bot:', error)
})
