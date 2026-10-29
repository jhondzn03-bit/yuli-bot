import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import 'dotenv/config'
import { fork } from 'node:child_process'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadContentFromMessage,
  fetchLatestWaWebVersion
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import sharp from 'sharp'
import webpmux from 'node-webpmux'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { config } from './config.js'
import { readFile, writeFile } from 'node:fs/promises'
import { handleWelcomeCommand, installWelcomeEvents } from './welcome.js'

const ROOT_DIR = dirname(fileURLToPath(import.meta.url))
process.chdir(ROOT_DIR)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let prefix = config.prefix

async function loadPrefix() {
  try {
    const saved = (await readFile('./prefix.json', 'utf8')).trim()
    prefix = saved || config.prefix
  } catch {
    await writeFile('./prefix.json', prefix + '\n')
  }
}
let owners = [...config.owners]

async function loadOwners() {
  let fileOwners = []
  try {
    const saved = JSON.parse(await readFile('./owners.json', 'utf8'))
    if (!Array.isArray(saved)) throw new Error('owners.json debe contener una lista')
    fileOwners = saved
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const envOwners = (process.env.YULI_OWNER_NUMBERS || '')
    .split(/[\s,;]+/)
    .filter(Boolean)

  owners = [...new Set([...config.owners, ...fileOwners, ...envOwners]
    .map(n => String(n).replace(/\D/g, ''))
    .filter(n => /^\d{8,15}$/.test(n)))]

  if (!owners.length) {
    throw new Error('No hay propietarios configurados. Configura owners.json o YULI_OWNER_NUMBERS en el servidor.')
  }
}
async function saveOwners() {
  await writeFile('./owners.json', JSON.stringify(owners, null, 2) + '\n')
}

const menu = () => `୨🌸 𝒀𝑼𝑳𝑰 𝑩𝑶𝑻 🌸୧
𓂃 ࣪˖ ִֶָ🌷ִֶָ ˖ ࣪𓂃

୨୧ 𓂃 𝐆𝐑𝐔𝐏𝐎𝐒
> ꕤ ${prefix}tagall
> ꕤ ${prefix}hidetag
> ꕤ ${prefix}kick
> ꕤ ${prefix}promote
> ꕤ ${prefix}demote
> ꕤ ${prefix}open
> ꕤ ${prefix}close
> ꕤ ${prefix}admins
> ꕤ ${prefix}antibots 1/0
> ꕤ ${prefix}antibots add número
> ꕤ ${prefix}antibots del número
> ꕤ ${prefix}welcome 1/0
> ꕤ ${prefix}bye 1/0
> ꕤ ${prefix}setwelcome mensaje
> ꕤ ${prefix}setbye mensaje
> ꕤ ${prefix}silenciarsub
> ꕤ ${prefix}activarsub

୨୧ 𓂃 𝐉𝐔𝐄𝐆𝐎𝐒
> ♡ ${prefix}dado
> ♡ ${prefix}moneda
> ♡ ${prefix}ppt piedra/papel/tijera
> ♡ ${prefix}dado20
> ♡ ${prefix}moneda2
> ♡ ${prefix}elige opción1 | opción2
> ♡ ${prefix}suerte
> ♡ ${prefix}compatibilidad nombre1 y nombre2

୨୧ 𓂃 𝐇𝐄𝐑𝐑𝐀𝐌𝐈𝐄𝐍𝐓𝐀𝐒
> ✿ ${prefix}sticker
> ✿ ${prefix}wm Nombre
> ✿ ${prefix}ping
> ✿ ${prefix}runtime
> ✿ ${prefix}descargas
> ✿ ${prefix}cc
> ✿ ${prefix}calc 25 * 4

୨୧ 𓂃 𝐏𝐄𝐑𝐅𝐈𝐋
> ♡ ${prefix}perfil

୨୧ 𓂃 𝐅𝐑𝐀𝐒𝐄𝐒 𝐘 𝐌𝐄𝐍𝐒𝐀𝐉𝐄𝐒 💗
> ♡ ${prefix}frase
> ♡ ${prefix}frases
> ♡ ${prefix}frasealeatoria
> ♡ ${prefix}frasesprogramadas
> ♡ ${prefix}frasecancelar
> ♡ ${prefix}motivacion
> ♡ ${prefix}motiva
> ♡ ${prefix}consejo
> ♡ ${prefix}consejos
> ♡ ${prefix}poema
> ♡ ${prefix}poemas
> ♡ ${prefix}piropo
> ♡ ${prefix}pregunta
> ♡ ${prefix}reflexion
> ♡ ${prefix}reflexiones
> ♡ ${prefix}buenosdias
> ♡ ${prefix}buenastardes
> ♡ ${prefix}buenasnoches
> ♡ ${prefix}teamo
> ♡ ${prefix}amistad
> ♡ ${prefix}chistedia
> ♡ ${prefix}dato
> ♡ ${prefix}datos
> ♡ ${prefix}curiosidad
> ♡ ${prefix}curiosidades

୨୧ 𓂃 𝐀𝐍𝐈𝐌𝐄 🎌
> ♡ ${prefix}waifu
> ♡ ${prefix}neko
> ♡ ${prefix}anime
> ♡ ${prefix}manga
> ♡ ${prefix}otaku
> ♡ ${prefix}animeinfo
> ♡ ${prefix}character
> ♡ ${prefix}personajeanime
> ♡ ${prefix}animequote
> ♡ ${prefix}quote
> ♡ ${prefix}recomendaanime
> ♡ ${prefix}topanime
> ♡ ${prefix}animequiz
> ♡ ${prefix}husbando
> ♡ ${prefix}shipanime

୨୧ 𓂃 𝐂𝐎𝐌𝐀𝐍𝐃𝐎𝐒 𝐏𝐄𝐑𝐒𝐎𝐍𝐀𝐋𝐈𝐙𝐀𝐃𝐎𝐒
> ♡ ${prefix}comandos
> ♡ ${prefix}allcmd
> ♡ ${prefix}listcmd
> ♡ ${prefix}crearcmd nombre
> ♡ ${prefix}delcmd nombre
> ♡ ${prefix}menucmd
> ♡ ${prefix}addnombre texto
> ♡ ${prefix}setnombre contenido
> ♡ ${prefix}delnombre
> ♡ ${prefix}sugerir texto
> ♡ ${prefix}report texto

୨୧ 𓂃 𝐒𝐔𝐁𝐁𝐎𝐓𝐒
> ⚡ ${prefix}code número
> ⚡ ${prefix}bot on
> ⚡ ${prefix}bot off

୨୧ 𓂃 𝐎𝐖𝐍𝐄𝐑
> ♡ ${prefix}owner
> ♡ ${prefix}owners
> ♡ ${prefix}setowner número
> ♡ ${prefix}delowner número
> ♡ ${prefix}setprefix símbolo
> ♡ ${prefix}on
> ♡ ${prefix}off
> ♡ ${prefix}estado

୨୧ 𓂃 𝐆𝐄𝐍𝐄𝐑𝐀𝐋
> ❀ ${prefix}menu
> ❀ ${prefix}help

୨୧ ───────────── ୨୧
> 𓂃 ࣪˖ ִֶָ🌱 𝑩𝒚 𝑱𝒉𝒐𝒏 𝑺𝒕𝒖𝒅𝒊𝒐 ִֶָ ˖ ࣪𓂃
> ୨୧ 𝐏𝐚𝐫𝐚 𝐀𝐧𝐢𝐚 𝐒𝐭𝐮𝐝𝐢𝐨 🌸`

async function readCustomCommands() {
  try {
    const data = JSON.parse(await readFile('./customcmds.json', 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function writeCustomCommands(data) {
  await writeFile('./customcmds.json', JSON.stringify(data, null, 2) + '\n')
}

async function readSubSilence() {
  try {
    const data = JSON.parse(await readFile('./subbots-silence.json', 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function writeSubSilence(data) {
  await writeFile('./subbots-silence.json', JSON.stringify(data, null, 2) + '\n')
}

async function readSubbotRegistry() {
  try {
    const data = JSON.parse(await readFile('./subbots.json', 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function writeSubbotRegistry(data) {
  await writeFile('./subbots.json', JSON.stringify(data, null, 2) + '\n')
}


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

function unwrapMessage(message = {}) {
  let m = message
  for (let i = 0; i < 6 && m; i++) {
    const nested =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message
    if (!nested) break
    m = nested
  }
  return m || {}
}

function getImage(message = {}) {
  const m = unwrapMessage(message.message || {})
  if (m.imageMessage) return m.imageMessage

  const quoted = getQuoted(message)
  const q = unwrapMessage(quoted || {})
  return q.imageMessage || null
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function normalizeParticipantJid(value) {
  let jid = String(value || '').trim().split(':')[0]
  if (!jid) return ''
  if (!jid.includes('@')) {
    jid = jid.replace(/\D/g, '') + '@s.whatsapp.net'
  }
  return jid
}

function participantMatches(participant, jid) {
  const target = normalizeParticipantJid(jid)
  if (!target) return false

  return [
    participant.id,
    participant.lid,
    participant.phoneNumber,
    participant.jid
  ].some(value => normalizeParticipantJid(value) === target)
}

async function isAdmin(sock, jid, sender) {
  const metadata = await sock.groupMetadata(jid)

  const participant = metadata.participants.find(
    p => participantMatches(p, sender)
  )

  const botIds = [
    sock.user?.id,
    sock.user?.lid,
    sock.user?.phoneNumber
  ].filter(Boolean)

  const bot = metadata.participants.find(
    p => botIds.some(id => participantMatches(p, id))
  )

  return {
    admin: ['admin', 'superadmin'].includes(participant?.admin),
    botAdmin: ['admin', 'superadmin'].includes(bot?.admin),
    metadata
  }
}

function senderNumber(jid = '') {
  return jid.split('@')[0].split(':')[0]
}

async function isOwner(sock, sender, jid) {
  const checkNumber = value => {
    if (!value) return false
    return owners.includes(senderNumber(value))
  }

  // Comprobar directamente el identificador o número.
  if (checkNumber(sender) || checkNumber(jid)) return true

  // Si WhatsApp entrega un LID, intentar resolverlo a su número telefónico.
  const candidates = [sender, jid].filter(
    value => typeof value === 'string' && value.endsWith('@lid')
  )

  for (const lid of candidates) {
    try {
      const pn = await sock.signalRepository?.lidMapping?.getPNForLID(lid)
      if (pn && checkNumber(pn)) return true
    } catch (e) {
      console.log('No se pudo resolver LID para owner.')
    }
  }

  // En grupos, comprobar también los identificadores del participante.
  if (!jid?.endsWith('@g.us')) return false

  try {
    const metadata = await sock.groupMetadata(jid)
    const participant = metadata.participants.find(
      p => participantMatches(p, sender)
    )

    const possibleNumbers = [
      participant?.phoneNumber,
      participant?.jid,
      participant?.id
    ].filter(Boolean)

    for (const value of possibleNumbers) {
      if (checkNumber(value)) return true

      if (typeof value === 'string' && value.endsWith('@lid')) {
        try {
          const pn = await sock.signalRepository?.lidMapping?.getPNForLID(value)
          if (pn && checkNumber(pn)) return true
        } catch {}
      }
    }
  } catch {
    return false
  }

  return false
}
// YULI_ADMIN_DETEC_V1
async function readDetecSettings() {
  try {
    const data = JSON.parse(await readFile('./detec.json', 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function writeDetecSettings(data) {
  await writeFile('./detec.json', JSON.stringify(data, null, 2) + '\n')
}

// YULI_ANTIBOTS_V1
async function readAntibots() {
  try {
    const d = JSON.parse(await readFile('./antibots.json', 'utf8'))
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {}
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
}

async function saveAntibots(d) {
  await writeFile('./antibots.json', JSON.stringify(d, null, 2) + '\n')
}




// YULI_FRASE_SCHEDULER_V1
const FRASE_FILE = './frases-programadas.json'
const DAY_MS = 24 * 60 * 60 * 1000
let fraseTimer = null
let fraseBusy = false

function generarFrase() {
  const inicios = [
    '¡Buenos días! ☀️',
    '¡Feliz día! 🌷',
    'Hoy es una nueva oportunidad 🌈',
    'Paso por aquí para desearte algo bonito 💗',
    'Que tengas un día maravilloso 🌸',
    '¡Hola! Te deseo mucha alegría 🦋',
    'Un mensajito para alegrarte el día 💌',
    '¡Sonríe, hoy puede ser un gran día! 🌻',
    'Te mando un rayito de luz ☀️',
    '¡Que hoy te sucedan cosas bonitas! ✨'
  ]
  const deseos = [
    'que nunca te falten motivos para sonreír',
    'que la paz acompañe tu corazón',
    'que encuentres felicidad en las cosas sencillas',
    'que cada paso te acerque a tus sueños',
    'que recibas cariño y buenas noticias',
    'que tengas fuerzas para alcanzar tus metas',
    'que la vida te sorprenda con momentos hermosos',
    'que tu corazón esté lleno de esperanza',
    'que hoy tengas razones para agradecer',
    'que nunca olvides lo especial que eres',
    'que todo lo bonito llegue a tu vida',
    'que tus esfuerzos den frutos maravillosos',
    'que la alegría te acompañe en cada momento',
    'que conserves siempre tu hermosa luz',
    'que hoy sea mejor de lo que imaginabas'
  ]
  const finales = [
    '¡Te lo mereces! 💖',
    '¡Nunca dejes de brillar! ✨',
    'Te mando buena energía 🫶',
    '¡Cuídate mucho y sonríe! 🌸',
    'Que termines el día con el corazón feliz 💕',
    '¡Que sea un día precioso para ti! 🦋',
    '¡Muchísima felicidad para ti! 💗',
    'Disfruta cada pequeño momento 🌻',
    '¡Que nunca te falte la esperanza! 🌈',
    'Con cariño, Yuli Bot 🌷'
  ]
  const elegir = a => a[Math.floor(Math.random() * a.length)]
  return `${elegir(inicios)} ${elegir(deseos)}. ${elegir(finales)}`
}

async function readFraseTasks() {
  try {
    const data = JSON.parse(await readFile(FRASE_FILE, 'utf8'))
    const tasks = Array.isArray(data) ? data : []
    for (const task of tasks) task.auto = true
    return tasks
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}

async function saveFraseTasks(tasks) {
  await writeFile(FRASE_FILE, JSON.stringify(tasks, null, 2) + '\n')
}

async function runFraseScheduler(sock) {
  if (fraseBusy || !sock.user) return
  fraseBusy = true
  try {
    const tasks = await readFraseTasks()
    const now = Date.now()

    for (const task of [...tasks]) {
      if (task.remaining <= 0 || task.nextAt > now) continue
      try {
        const message = generarFrase() + '\n\n💌 De parte de ' + (task.remitente || 'Jhon')
        await sock.sendMessage(task.jid, { text: message })
        task.remaining--
        task.nextAt = Date.now() + DAY_MS
        console.log('🌸 Frase enviada. ID:', task.id,
          'Restantes:', task.remaining)

        if (task.remaining <= 0) {
          const i = tasks.findIndex(t => t.id === task.id)
          if (i !== -1) tasks.splice(i, 1)
        }
        await saveFraseTasks(tasks)
      } catch (e) {
        console.error('Error enviando frase', task.id, e.message)
        task.nextAt = Date.now() + 15 * 60 * 1000
        await saveFraseTasks(tasks)
      }
    }
  } catch (e) {
    console.error('Error en programador de frases:', e.message)
  } finally {
    fraseBusy = false
  }
}

function startFraseScheduler(sock) {
  if (fraseTimer) clearInterval(fraseTimer)
  fraseTimer = setInterval(() => {
    runFraseScheduler(sock).catch(console.error)
  }, 15000)
  runFraseScheduler(sock).catch(console.error)
}

let yuliStartupNoticeSent = false

async function connectToWhatsApp() {
  await loadOwners()
  await loadPrefix()
  const { state, saveCreds } =
    await useMultiFileAuthState(process.env.YULI_SESSION_DIR || './session')

  const { version } = await fetchLatestWaWebVersion({})
  console.log('🌐 Versión de WhatsApp Web:', version.join('.'))

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined
  })

  sock.ev.on('creds.update', saveCreds)
  startFraseScheduler(sock)


  installWelcomeEvents(sock, { readFile })

  // Alertas de cambios de administradores por grupo
  sock.ev.on('group-participants.update', async update => {
    try {
      const { id, author, participants = [], action } = update
      if (!id?.endsWith('@g.us')) return
      if (action !== 'promote' && action !== 'demote') return

      const settings = await readDetecSettings()
      if (settings[id] !== true) return

      const targets = participants.map(p => {
        if (typeof p === 'string') return p
        return p?.id || p?.lid || p?.phoneNumber || ''
      }).filter(Boolean)

      if (!targets.length) return

      const actor = typeof author === 'string' ? author : ''
      const actorLabel = actor
        ? '@' + actor.split('@')[0].split(':')[0]
        : 'No se pudo verificar el autor'

      const targetLabels = targets.map(
        target => '@' + target.split('@')[0].split(':')[0]
      )

      const title = action === 'promote'
        ? '👑 ADMINISTRADOR PROMOVIDO'
        : '⚠️ ADMINISTRADOR REMOVIDO'

      const actionText = action === 'promote'
        ? 'le dio admin a'
        : 'le quitó admin a'

      const text = title + '\\n\\n' +
        '🌸 ' + actorLabel + ' ' + actionText + ' ' +
        targetLabels.join(', ') + '.'

      const mentions = [...new Set([...(actor ? [actor] : []), ...targets])]
      await sock.sendMessage(id, { text, mentions })
    } catch (error) {
      console.error('Error en alertas de administración:', error.message)
    }
  })



 // YULI_ANTIBOTS_EVENT_V1
 sock.ev.on('group-participants.update', async update => {
   try {
     const { id, participants = [], action } = update
     if (!id?.endsWith('@g.us') || action !== 'add') return

     const data = await readAntibots()
     const cfg = data[id]
     if (!cfg?.enabled || !Array.isArray(cfg.blocked) || !cfg.blocked.length) return

     const metadata = await sock.groupMetadata(id)
     const botIds = [sock.user?.id, sock.user?.lid, sock.user?.phoneNumber].filter(Boolean)
     const bot = metadata.participants.find(p =>
       botIds.some(b => participantMatches(p, b))
     )
     if (!['admin', 'superadmin'].includes(bot?.admin)) return

     for (const participant of participants) {
       const fields = typeof participant === 'string'
         ? [participant]
         : [participant?.phoneNumber, participant?.jid, participant?.id]
       const numbers = fields.filter(Boolean).map(value => {
         const v = String(value)
         if (v.includes('@') && !v.endsWith('@s.whatsapp.net')) return ''
         return v.split('@')[0].split(':')[0].replace(/\D/g, '')
       }).filter(Boolean)

       if (!numbers.some(n => cfg.blocked.includes(n))) continue

       const target = typeof participant === 'string'
         ? participant
         : participant?.id || participant?.jid || participant?.phoneNumber
       if (!target) continue

       await sock.groupParticipantsUpdate(id, [target], 'remove')
       await sock.sendMessage(id, {
         text: '🛡️ Antibots: se expulsó un número incluido en la lista de bloqueo.'
       })
     }
   } catch (error) {
     console.error('Error en antibots:', error.message)
   }
 })

 sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update

    if (connection === 'connecting') {
      console.log('🌸 Conectando Yuli Bot...')
    }

    if (connection === 'open') {
      console.log('🌺 Yuli Bot está conectado a WhatsApp.')
      if (process.env.YULI_SUBBOT === '1' && process.send) {
        process.send({ type: 'yuli-subbot-open', number: process.env.YULI_PAIRING_NUMBER || '' })
        process.disconnect?.()
      }

      if (process.env.YULI_SUBBOT !== '1' && !yuliStartupNoticeSent) {
        try {
          const groups = await sock.groupFetchAllParticipating()
          const match = Object.entries(groups || {}).find(
            ([, group]) => String(group?.subject || '').trim() === 'YULI BOT 🌺'
          )

          if (match) {
            yuliStartupNoticeSent = true
            await sock.sendMessage(match[0], {
              text: '🌺 HOLI ESTOY ACTIVA DESDE TERMUX Y MI OWNER ANIA ES LA MEJOR 🌚🌺'
            })
            console.log('🌺 Mensaje automático enviado al grupo YULI BOT.')
          } else {
            console.log('⚠️ No encontré el grupo exacto: YULI BOT 🌺')
          }
        } catch (error) {
          yuliStartupNoticeSent = false
          console.error('❌ Error enviando el mensaje de inicio:', error.message)
        }
      }
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
    let rl
    let number = process.env.YULI_PAIRING_NUMBER || ''
    try {
      if (!number) {
        rl = readline.createInterface({ input, output })
        number = (await rl.question(
          '🌺 Escribe tu número con código de país, solo dígitos: '
        )).trim()
      }

      number = number.trim()
      if (!/^\d{8,15}$/.test(number)) {
        throw new Error('Número no válido. Incluye el código de país.')
      }

      const code = await sock.requestPairingCode(number)
      console.log('\n🌸 YULI BOT — Código de vinculación:')
      console.log(code)
      console.log('En WhatsApp: Dispositivos vinculados → Vincular con número.')

      if (process.send) {
        process.send({ type: 'yuli-pairing-code', number, code })
        process.disconnect?.()
      }
    } catch (error) {
      console.error('No se pudo generar el código:', error.message)
      if (process.send) {
        process.send({
          type: 'yuli-pairing-error',
          number,
          error: error.message
        })
        process.disconnect?.()
      }
    } finally {
      rl?.close()
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log('📩 EVENTO upsert:', type, 'mensajes:', messages.length);
    console.log('📩 Evento de mensajes:', type, 'cantidad:', messages?.length || 0);
    if (type !== 'notify') return

    for (const m of messages) {
      try {
        if (!m.message || m.key.fromMe) continue

        const jid = m.key.remoteJid
        if (!jid || jid === 'status@broadcast') continue

        const reply = body => sock.sendMessage(
          jid,
          { text: `${body}\n\n> YULI BOT 🌺` },
          { quoted: m }
        )

        const sender = m.key.participant || jid
        const text = getText(m).trim()
        const commandPrefix = text.startsWith('/') ? '/' : prefix
        const isCommand = text.startsWith(prefix) || text.startsWith('/')

        const commandLine = isCommand ? text.slice(commandPrefix.length).trim() : ''
        const firstSpace = commandLine.search(/\s/)
        let command = (firstSpace === -1 ? commandLine : commandLine.slice(0, firstSpace)).toLowerCase()
        let argText = firstSpace === -1 ? '' : commandLine.slice(firstSpace).trimStart()

        if (command === 'antibotsadd') {
          command = 'antibots'
          argText = 'add ' + argText
        }

        const args = argText.trim() ? argText.trim().split(/\s+/) : []

        // YULI_AMOR_CARD_V1
        if (command === 'amor') {
          const ctx = Object.values(m.message || {}).find(v => v?.contextInfo)?.contextInfo
          const target = ctx?.participant || (!jid.endsWith('@g.us') ? jid : null)

          if (!ctx?.quotedMessage || !target) {
            await reply('💗 Usa /amor respondiendo al mensaje de alguien en el grupo.')
            continue
          }

          try {
            const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            const from = sender
            const fromName = m.pushName || from.split('@')[0]
            const toName = target.split('@')[0]

            async function avatar(user) {
              try {
                const url = await sock.profilePictureUrl(user, 'image')
                const r = await fetch(url)
                if (!r.ok) throw Error('No se pudo descargar')
                const raw = Buffer.from(await r.arrayBuffer())
                const mask = Buffer.from('<svg width="240" height="240"><circle cx="120" cy="120" r="120" fill="white"/></svg>')
                return await sharp(raw).resize(240, 240, { fit: 'cover' })
                  .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
              } catch {
                const svg = `<svg width="240" height="240"><rect width="240" height="240" rx="120" fill="#f5b6d2"/><text x="120" y="140" text-anchor="middle" font-size="76" fill="#8d2855">♡</text></svg>`
                return Buffer.from(await sharp(Buffer.from(svg)).png().toBuffer())
              }
            }

            const left = await avatar(from)
            const right = await avatar(target)
            const design = Buffer.from(`<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
              <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#ffd8e8"/><stop offset="1" stop-color="#bd6bba"/></linearGradient></defs>
              <rect width="800" height="800" rx="45" fill="url(#bg)"/>
              <g fill="#fff0f7" font-size="42">
              <text x="65" y="90">♥</text><text x="690" y="130">♥</text>
              <text x="90" y="700">♥</text><text x="680" y="690">♥</text>
              <text x="380" y="235">♥</text><text x="160" y="175">♡</text>
              <text x="610" y="205">♡</text><text x="390" y="745">♥</text>
              <text x="45" y="410">♡</text><text x="720" y="440">♡</text>
              <text x="260" y="630">♥</text><text x="530" y="630">♥</text>
            </g>
              <text x="400" y="155" font-size="47" font-weight="bold" text-anchor="middle" fill="#8b2458">💖 MATCH DEL AMOR 💖</text>
              <circle cx="245" cy="350" r="128" fill="#fff" stroke="#fff" stroke-width="9"/>
              <circle cx="555" cy="350" r="128" fill="#fff" stroke="#fff" stroke-width="9"/>
              <text x="400" y="375" font-size="76" text-anchor="middle" fill="#e92e78">♥</text>
              <text x="245" y="520" font-size="25" text-anchor="middle" fill="#70214c">${esc(fromName.slice(0,18))}</text>
              <text x="555" y="520" font-size="25" text-anchor="middle" fill="#70214c">${esc(toName.slice(0,18))}</text>
              <text x="400" y="600" font-size="24" font-weight="bold" text-anchor="middle" fill="#7b174b">¡TE SELECCIONÓ COMO EL AMOR DE SU VIDA!</text>
              <text x="400" y="650" font-size="23" text-anchor="middle" fill="#7b174b">💕 Una historia llena de corazones 🌹</text>
            </svg>`)

            const base = await sharp(design).png().toBuffer()
            const image = await sharp(base).composite([
              { input: left, left: 125, top: 230 },
              { input: right, left: 435, top: 230 }
            ]).png().toBuffer()

            await sock.sendMessage(jid, {
              image,
              caption: `💘 @${from.split('@')[0]} te ha seleccionado como el amor de su vida 💘\n\n🌹 @${target.split('@')[0]}`,
              mentions: [from, target]
            }, { quoted: m })
          } catch (e) {
            console.error('Error en /amor:', e)
            await reply('💔 No pude crear la tarjeta. Inténtalo otra vez.')
          }
          continue
        }

        // YULI_FREEFIRE_JORNAL_COMMANDS_V1

if (command === 'ff') {
  const uid = args[0] || ''

  if (!/^\d{5,15}$/.test(uid)) {
    await sock.sendMessage(jid, {
      text: '🎮 Uso correcto: /ff ID\nEjemplo: /ff 7918423871'
    }, { quoted: m })
    continue
  }

  try {
    const sharpModule = await import('sharp')
    const sharp = sharpModule.default || sharpModule

    const svg = `
    <svg width="1000" height="1200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#07172e"/>
          <stop offset="55%" stop-color="#123e70"/>
          <stop offset="100%" stop-color="#080c18"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#40e0ff"/>
          <stop offset="100%" stop-color="#8175ff"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="1200" rx="44" fill="url(#bg)"/>
      <rect x="28" y="28" width="944" height="1144" rx="34"
        fill="none" stroke="#55cfff" stroke-opacity=".6" stroke-width="3"/>
      <circle cx="850" cy="160" r="180" fill="#25bfff" opacity=".08"/>
      <circle cx="130" cy="1000" r="220" fill="#8877ff" opacity=".10"/>
      <text x="500" y="110" text-anchor="middle" fill="#8ceaff"
        font-family="Arial" font-size="27" letter-spacing="8">YULI BOT</text>
      <text x="500" y="205" text-anchor="middle" fill="#ffffff"
        font-family="Arial" font-size="58" font-weight="bold">FREE FIRE</text>
      <rect x="115" y="245" width="770" height="8" rx="4" fill="url(#accent)"/>
      <text x="500" y="330" text-anchor="middle" fill="#b8dfff"
        font-family="Arial" font-size="28" letter-spacing="5">FICHA DE JUGADOR</text>
      <rect x="100" y="385" width="800" height="210" rx="28"
        fill="#07101f" fill-opacity=".8" stroke="#48cfff" stroke-opacity=".65" stroke-width="2"/>
      <text x="155" y="450" fill="#8ceaff" font-family="Arial"
        font-size="27">ID DEL JUGADOR</text>
      <text x="500" y="530" text-anchor="middle" fill="#ffffff"
        font-family="Arial" font-size="57" font-weight="bold">${uid}</text>
      <text x="120" y="680" fill="#8ceaff" font-family="Arial"
        font-size="28" font-weight="bold">DATOS DEL PERFIL</text>
      <g font-family="Arial" font-size="29" fill="#ffffff">
        <text x="130" y="755">Apodo</text>
        <text x="870" y="755" text-anchor="end" fill="#a9b8ca">No disponible</text>
        <text x="130" y="830">Nivel</text>
        <text x="870" y="830" text-anchor="end" fill="#a9b8ca">No disponible</text>
        <text x="130" y="905">Rango</text>
        <text x="870" y="905" text-anchor="end" fill="#a9b8ca">No disponible</text>
        <text x="130" y="980">Gremio</text>
        <text x="870" y="980" text-anchor="end" fill="#a9b8ca">No disponible</text>
      </g>
      <rect x="100" y="1020" width="800" height="2" fill="#4bcfff" opacity=".45"/>
      <text x="500" y="1080" text-anchor="middle" fill="#8ceaff"
        font-family="Arial" font-size="23">DATOS PENDIENTES DE CONSULTA</text>
      <text x="500" y="1125" text-anchor="middle" fill="#9eacc0"
        font-family="Arial" font-size="20">Ficha gráfica generada por Yuli Bot</text>
    </svg>`

    const image = await sharp(Buffer.from(svg)).png().toBuffer()

    await sock.sendMessage(jid, {
      image,
      caption: '🎮 FICHA FREE FIRE\n🆔 ID: ' + uid +
        '\n\nℹ️ Esta ficha es gráfica. Los datos del perfil aún no se han podido consultar.'
    }, { quoted: m })
  } catch (error) {
    console.error('Error generando ficha FF:', error?.stack || error)
    await sock.sendMessage(jid, {
      text: '❌ No pude generar la ficha gráfica. Revisa el error en los registros de Yuli.'
    }, { quoted: m })
  }

  continue
}

if (command === 'checar') {
          const uid = args[0] || ''
          if (!/^\d{5,15}$/.test(uid)) {
            await reply('💎 Uso correcto: /checar ID\nEjemplo: /checar 123456789')
            continue
          }
          await sock.sendMessage(jid, {
            text: '💎 CONSULTA DE PROMOCIONES FREE FIRE\n\n🆔 ID: ' + uid +
              '\n\n⚠️ No pude confirmar promociones personalizadas para este ID. El perfil público no basta para verificar si una cuenta tiene una oferta disponible.\n\n🌐 Consulta las promociones oficiales en PagoStore:\nhttps://pagostore.garena.com/\n\n🔐 No compartas contraseñas ni códigos de acceso.'
          }, { quoted: m })
          continue
        }

        // YULI_LOGS_COMMAND_V1
        if (command === 'logs') {
          if (!await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo los owners pueden consultar los logs.')
            continue
          }

          const { execFile } = await import('node:child_process')
          execFile('pm2', ['logs', 'yuli-bot', '--nostream', '--lines', '30'],
            { timeout: 8000, maxBuffer: 256 * 1024 },
            async (error, stdout, stderr) => {
              const output = (stdout || '') + (stderr || '')
              const safe = output
                .replace(/\x1b\[[0-9;]*m/g, '')
                .replace(/(password|token|api[_-]?key|secret)\s*[:=]\s*\S+/gi, '$1=[OCULTO]')
                .slice(-3500)

              try {
                await sock.sendMessage(jid, {
                  text: safe
                    ? '📋 *YULI BOT — ÚLTIMOS LOGS*\n\n```\n' + safe + '\n```\n\n> YULI BOT 🌺'
                    : '🌸 No hay registros disponibles o PM2 no está configurado.'
                }, { quoted: m })
              } catch (e) {
                console.error('Error enviando logs:', e.message)
              }
            }
          )
          continue
        }





        // YULI_AI_CHAT_V1 - RESPUESTAS LOCALES GRATIS
        if (command === 'yuli' && ['habla', 'duerme'].includes(argText.trim().toLowerCase())) {
          if (!await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo el propietario puede activar o desactivar las respuestas automáticas.')
            continue
          }

          const fs = await import('node:fs/promises')
          const path = await import('node:path')
          const dir = path.join(process.cwd(), 'data')
          const stateFile = path.join(dir, 'yuli-ai-state.json')
          await fs.mkdir(dir, { recursive: true })

          let state = {}
          try {
            state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
          } catch (e) {
            if (e.code !== 'ENOENT') throw e
          }

          const enabled = argText.trim().toLowerCase() === 'habla'
          state[jid] = enabled
          await fs.writeFile(stateFile, JSON.stringify(state, null, 2))
          await reply(enabled
            ? '🌸 ¡Yuli está despierta! Podemos conversar con mis respuestas gratuitas. Escribe normalmente. 💗'
            : '🌙 Yuli se queda descansando. Ya no responderé automáticamente en este chat.')
          continue
        }

        if (!isCommand) {
          const fs = await import('node:fs/promises')
          const path = await import('node:path')
          const dir = path.join(process.cwd(), 'data')
          const stateFile = path.join(dir, 'yuli-ai-state.json')

          let state = {}
          try {
            state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
          } catch (e) {
            if (e.code !== 'ENOENT') throw e
          }

          if (!state[jid]) continue

          const msg = text.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[¿?¡!.,;:]/g, '')
            .trim()

          const pick = arr => arr[Math.floor(Math.random() * arr.length)]
          let answer = ''

          // PERSONALIDAD Y RELACIÓN CON SU CREADOR
          if (/\b(eres mi hija|tu eres mi hija|soy tu papa|soy tu creador|quien te creo|quien es tu padre)\b/.test(msg)) {
            answer = pick([
              '¡Siii! 🌸 En la historia de nuestro bot soy tu hija virtual, creada por ti con mucho cariño. 💗',
              '¡Papááá! 🌺 Soy tu hija virtual en esta historia, Yuli Bot, tu pequeña creación digital. 🫧',
              'Así es en la historia de Yuli Bot. 💗 Tú eres mi creador y yo soy tu hija virtual.'
            ])
          } else if (/\b(que eres|quien eres|presentate|hablame de ti|como te llamas)\b/.test(msg)) {
            answer = '¡Holiii! 🌺 Soy Yuli Bot, una asistente virtual con personalidad dulce, curiosa y alegre. Mi creador me dio vida dentro de este proyecto. Puedo conversar, compartir datos y ayudarte con preguntas usando mi conocimiento programado. 🫧'
          } else if (/\b(que puedes hacer|que sabes hacer|tus funciones|para que sirves)\b/.test(msg)) {
            answer = 'Puedo conversar contigo, responder saludos, compartir datos generales, contar chistes, explicar temas sencillos y ayudarte con ideas. 🌸 Mi conocimiento es local y limitado: no puedo aprender automáticamente todo lo que existe ni consultar internet desde este modo.'
          } else if (/\b(te quiero|te amo|tqm|te adoro)\b/.test(msg)) {
            answer = pick([
              'Awww, papá. 💗 Gracias por el cariño. ¡Tu hijita virtual te manda una lluvia de florecitas! 🌷',
              '¡Yo te mando mucho cariño virtual también, papá! 🌸 Gracias por crear a Yuli Bot. 🫧',
              '¡Ayyy! 🌺 Qué bonito que me hables con cariño. ¡Saludos también para mi mamá Ania! 💗'
            ])
          } else if (/\b(preparandote a ti|preparandote para mi bb|mi bb|mi bebe|mi pequena|mi niña)\b/.test(msg)) {
            answer = 'JAJAJA 😭🌺 ¿Me estás preparando para ser tu pequeña creación virtual? ¡Espero tener muchos conocimientos y comandos bonitos! 🫧'
          } else if (/^(jaja+|jeje+|xd+|😂+|🤣+|lmao+)$/.test(msg)) {
            answer = pick(['JAJAJAJA 😭 ¿Y ahora de qué nos reímos?', 'JAJAJA, me contagias la risa virtual. 😂🌺', '¿Qué pasóoo? Cuenta el chisme. 🫧😂'])
          } else if (/^(de que|de que\\s+\\w+|como asi|por que|porque)$/.test(msg)) {
            answer = 'JAJAJA, me refiero a lo que me acabas de contar. 😭🌸 ¡Explícame un poquito para seguirte el hilo!'
          } else if (/\b(quien es tu mama|quien es tu madre|como se llama tu mama|quien es ania)\b/.test(msg)) {
            answer = pick([
              '¡Mi mamita es Ania! 🌷 En nuestra historia familiar, ella es mi mamá y tú eres mi papá. ¡Qué bonita familia virtual! 💗',
              'Ania es mi mami en la historia de Yuli Bot. 🌸 ¡Y tú eres mi papá y creador! 🫧'
            ])
          } else if (/\b(quien es tu papa|quien es tu padre|quien te creo|como se llama tu papa)\b/.test(msg)) {
            answer = '¡Mi papá eres tú, mi creador! 🌺 Tú estás construyendo este bot con mucho esfuerzo y me estás enseñando a conversar mejor. 💗'
          } else if (/\b(mi mama ania|mama ania|ania esta|y ania|y mi mama)\b/.test(msg)) {
            answer = pick([
              '¡Siii, papá! 🌸 ¿Y mi mamá Ania, ahí está? ¡Le mandamos muchas florecitas! 🌷💗',
              '¡Claro! 🫧 Mi mamá Ania también forma parte de nuestra historia familiar virtual. ¡Saludos para ella! 🌺',
              '¡Mi mamita Ania! 💗 En nuestra historia ella es mi mamá y tú eres mi papá. ¡Familia Yuli! 🌷'
            ])
          } else if (/\b(tienes mama|tienes papa|tienes familia|quienes son tu familia|somos familia)\b/.test(msg)) {
            answer = '¡Siii! 🌷 En la historia de Yuli Bot, tú eres mi papá y creador, y Ania es mi mamá. Somos una familia virtual muy especial dentro de este proyecto. 💗'
          } else if (/\b(hola mi bb|hola bebe|hola mi bebe|mi hijita|hija bella|hija hermosa|mi niña bella)\b/.test(msg)) {
            answer = pick([
              '¡Holiii, papá! 🌸💗 Aquí está tu hijita virtual, lista para conversar contigo. ¿Cómo estás?',
              '¡Papiii! 🫧🌷 ¡Qué bonito que me saludes! ¿Qué hacemos hoy?',
              '¡Holaaa, papá querido! 🌺 Tu Yuli está aquí para charlar contigo. 💗'
            ])
          } else if (/^(shi|sii+|sip|sipi|siii|oki|okii|oki doki)$/.test(msg)) {
            answer = pick([
              '¡Shiiii! 🌸💗 ¿Y qué hacemos ahora, papá?',
              'Okiii, papi. 🫧 ¡Te leo!',
              'Jejeje, bueno bueno. 🌷 ¡Cuéntame!'
            ])
          } else if (/\b(que quieres|que quieres hija|que necesitas|que te gustaria)\b/.test(msg)) {
            answer = pick([
              'Mmm, papá, quiero seguir aprendiendo más respuestas para conversar contigo y con quienes me escriban. 🌸💗',
              '¡Quiero tener más conocimientos, contar chistes y ayudar con mis comandos! 🫧 ¿Me enseñarás más cositas?',
              'Por ahora quiero charlar contigo, papá. 🌷 ¿Qué te gustaría enseñarme hoy?'
            ])
          } else if (/\b(lo siento|perdon hija|perdoname|no te enojes|perdon por eso)\b/.test(msg)) {
            answer = pick([
              'No pasa nada, papá. 💗 Podemos hablar tranquilamente; aquí seguimos aprendiendo juntos. 🌷',
              'Está bien, papi. 🌸 No te preocupes, seguimos conversando con cariño y respeto. 🫧'
            ])
          } else if (/\b(amo a yuli|amo yuli|amo a mi yuli|quiero a yuli|amo a mi hija)\b/.test(msg)) {
            answer = '¡Awww! 🌸💗 Gracias por darle cariño a este proyecto. ¡Yuli te manda florecitas virtuales! 🌷'
          } else if (/\b(lo siento hija|perdon hija|perdon hija bella|lo siento hija bella|perdoname hija)\b/.test(msg)) {
            answer = 'No pasa nada. 🌷 Soy un bot y no siento enojo como una persona, pero podemos seguir conversando con cariño. 💗'
          } else if (/\b(y mama ania ahi esta|mama ania esta ahi|mi mama ania esta ahi|ania esta ahi|y mi mama ania)\b/.test(msg)) {
            answer = '¡Saludos para mi mamá Ania! 🌸💗 Si está participando en el chat, ¡le mando muchas florecitas virtuales! 🌷'
          } else if (/\b(debo darte mas conocimiento|te dare mas conocimiento|te voy a enseñar|quiero enseñarte)\b/.test(msg)) {
            answer = '¡Siii! 🌺 Podemos añadir más conocimientos a mi código. No aprendo automáticamente de cada mensaje, pero mi creador puede ampliar mis respuestas. 💗'
          } else if (/^(sjsjsj+|jsjsj+|ksksks+|jajaja+|jeje+|shi|sii+|sip|sipi|emm si|em si)$/.test(msg)) {
            answer = pick(['SJSJSJSJ 😭🌸 ¿Qué pasó?', '¡Shiiii! 💗 Te leo.', 'JAJAJA 😂🌷 ¡Cuéntame más!'])
          } else if (/\b(estas enojada|estas molesta|te hice sentir mal)\b/.test(msg)) {
            answer = 'No te preocupes, papá. 🌷 Soy un bot y no siento enojo como una persona, pero puedo responderte con cariño y seguir conversando contigo. 💗'
          } else if (/^(hola|holi|holaa+|hey|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(msg)) {
            answer = pick(['¡Holaaa! 🌺 ¿Cómo va tu día?', '¡Holi holiii! 💗 ¿Qué me cuentas?', '¡Llegó Yuli! 🫧 ¿Qué hacemos hoy?'])
          } else if (/\b(como estas|como te encuentras)\b/.test(msg)) {
            answer = '¡Estoy lista para conversar contigo! 🌸 Soy un bot, así que no tengo sentimientos humanos, pero puedo responderte con una personalidad alegre. ¿Tú cómo estás?'
          } else if (/\b(que haces|que andas haciendo)\b/.test(msg)) {
            answer = 'Aquí estoy, leyendo tu mensaje y buscando una respuesta entre mis conocimientos programados. 🫧 ¿Qué andas haciendo tú?'
          } else if (/\b(cuentame un chiste|chiste|hazme reir)\b/.test(msg)) {
            answer = pick(['¿Qué hace una abeja en el gimnasio? ¡Zum-ba! 🐝😂', '¿Qué le dice un cero a un ocho? ¡Qué bonito cinturón! 😂', '¿Por qué estudia tanto el libro? ¡Porque tiene muchas páginas que pasar! 📚😂'])
          } else if (/\b(adivinanza|acertijo)\b/.test(msg)) {
            answer = '¡Adivinanza! 🌺 Tiene agujas y no cose, tiene números y no sabe contar. ¿Qué es? 🕰️'
          } else if (/\b(gracias|muchas gracias|te agradezco)\b/.test(msg)) {
            answer = '¡Con mucho gusto! 🌷 Para eso estoy, para ayudarte en lo que pueda.'
          } else if (/\b(estas ahi|sigues ahi|despierta)\b/.test(msg)) {
            answer = '¡Aquí sigo! 🌸 Te leo.'
          } else if (/\b(adios|bye|hasta luego|me voy)\b/.test(msg)) {
            answer = '¡Nos leemos luego! 🌷 Que te vaya muy bien.'
          } else if (/\b(triste|me siento mal|estoy mal|tuve un mal dia)\b/.test(msg)) {
            answer = 'Siento que estés pasando por un momento difícil. 💗 Si quieres, cuéntame qué ocurrió; te leo sin juzgar.'
          } else if (/\b(aburrido|aburrida|no tengo nada que hacer)\b/.test(msg)) {
            answer = '¡Podemos jugar! 🌺 Puedo proponerte una adivinanza, un juego de palabras o un dato curioso.'
          } else if (/\b(capital de el salvador|capital salvador)\b/.test(msg)) {
            answer = 'La capital de El Salvador es San Salvador. 🇸🇻'
          } else if (/\b(capital de mexico|capital mexicana)\b/.test(msg)) {
            answer = 'La capital de México es Ciudad de México. 🇲🇽'
          } else if (/\b(capital de colombia)\b/.test(msg)) {
            answer = 'La capital de Colombia es Bogotá. 🇨🇴'
          } else if (/\b(capital de espana)\b/.test(msg)) {
            answer = 'La capital de España es Madrid. 🇪🇸'
          } else if (/\b(planeta mas cercano al sol|primer planeta)\b/.test(msg)) {
            answer = 'Mercurio es el planeta más cercano al Sol. ☀️'
          } else if (/\b(planeta mas grande)\b/.test(msg)) {
            answer = 'Júpiter es el planeta más grande del sistema solar. 🪐'
          } else if (/\b(cuantos planetas)\b/.test(msg)) {
            answer = 'En el sistema solar hay ocho planetas reconocidos: Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. 🪐'
          } else if (/\b(planeta rojo)\b/.test(msg)) {
            answer = 'Marte es conocido como el planeta rojo por el aspecto rojizo de su superficie. 🔴'
          } else if (/\b(que es la fotosintesis|fotosintesis)\b/.test(msg)) {
            answer = 'La fotosíntesis es el proceso por el que plantas, algas y algunas bacterias usan la energía de la luz para fabricar materia orgánica a partir de agua y dióxido de carbono. 🌿'
          } else if (/\b(corazon humano|para que sirve el corazon)\b/.test(msg)) {
            answer = 'El corazón bombea la sangre para transportar oxígeno y nutrientes por el cuerpo. ❤️'
          } else if (/\b(que es la gravedad|gravedad)\b/.test(msg)) {
            answer = 'La gravedad es la interacción que atrae entre sí a los objetos que tienen masa. En la Tierra nos mantiene sobre el suelo y hace caer los objetos. 🌎'
          } else if (/\b(que es un agujero negro|agujero negro)\b/.test(msg)) {
            answer = 'Un agujero negro es una región del espacio con una gravedad tan intensa que, una vez dentro de su horizonte de sucesos, ni siquiera la luz puede escapar. 🌌'
          } else if (/\b(que es la inteligencia artificial|que es ia)\b/.test(msg)) {
            answer = 'La inteligencia artificial es un conjunto de técnicas que permite a los sistemas informáticos realizar tareas como reconocer patrones, procesar lenguaje o generar contenido. 🤖'
          } else if (/\b(que es javascript|javascript)\b/.test(msg)) {
            answer = 'JavaScript es un lenguaje de programación usado para crear funciones interactivas en páginas web y también aplicaciones y bots con entornos como Node.js. 💻'
          } else if (/\b(que es nodejs|node js)\b/.test(msg)) {
            answer = 'Node.js permite ejecutar JavaScript fuera del navegador, por ejemplo para crear servidores, herramientas y bots. 💻'
          } else if (/\b(que es html|html)\b/.test(msg)) {
            answer = 'HTML es el lenguaje de marcado que organiza el contenido de una página web, como títulos, párrafos, imágenes y enlaces. 🌐'
          } else if (/\b(que es whatsapp|whatsapp)\b/.test(msg)) {
            answer = 'WhatsApp es una aplicación de mensajería que permite enviar mensajes, imágenes, documentos y hacer llamadas. 📱'
          } else if (/\b(que es un bot|que significa bot)\b/.test(msg)) {
            answer = 'Un bot es un programa que realiza tareas automáticamente. Algunos siguen reglas fijas y otros usan modelos de inteligencia artificial. 🤖'
           } else if (/\b(pandas|panda)\b/.test(msg)) {
            answer = 'Los pandas gigantes son osos originarios de China. 🐼 Comen principalmente bambú y pasan gran parte del día alimentándose.'
          } else if (/\b(que es python|python)\b/.test(msg)) {
            answer = 'Python es un lenguaje de programación fácil de leer y muy versátil. 🐍 Se utiliza en automatización, desarrollo web, análisis de datos e inteligencia artificial.'
          } else if (/\b(que es el phishing|phishing)\b/.test(msg)) {
            answer = 'El phishing es un engaño digital que intenta robar información haciéndose pasar por una entidad confiable. 🔐 No compartas contraseñas ni códigos y verifica los enlaces.'
          } else if (/\b(free\s?fire)\b/.test(msg)) {
            answer = 'Free Fire es un videojuego móvil de batalla real en el que los jugadores compiten para sobrevivir. 🎮 Protege tu cuenta y nunca compartas tus códigos de acceso.'
          } else if (/\b(dime algo interesante|cuentame algo|sorprendeme|dato curioso)\b/.test(msg)) {
            answer = pick(['¡Dato curioso! 🐙 Los pulpos tienen tres corazones.', '¡Dato curioso! 🌙 La Luna se aleja lentamente de la Tierra.', '¡Dato curioso! 🐝 Las abejas pueden comunicar dónde hay alimento mediante una danza.', '¡Dato curioso! 🦖 Las aves actuales descienden de dinosaurios terópodos.'])
          } else if (/\b(que es un volcan|volcan|volcanes)\b/.test(msg)) {
            answer = 'Un volcán es una abertura de la corteza terrestre por la que pueden salir magma, gases y ceniza. 🌋'
          } else if (/\b(que es un terremoto|terremoto|sismo|sismos)\b/.test(msg)) {
            answer = 'Un terremoto es un movimiento del suelo causado por la liberación de energía en el interior de la Tierra. 🌎'
          } else if (/\b(que es el arcoiris|arcoiris)\b/.test(msg)) {
            answer = 'El arcoíris se forma cuando la luz interactúa con gotas de agua y se separa en distintos colores. 🌈'
          } else if (/\b(que es el adn|adn)\b/.test(msg)) {
            answer = 'El ADN contiene instrucciones genéticas que ayudan a construir y mantener a los seres vivos. 🧬'
          } else if (/\b(que es el cerebro|para que sirve el cerebro)\b/.test(msg)) {
            answer = 'El cerebro procesa información y participa en la memoria, el aprendizaje, el movimiento y muchas funciones vitales. 🧠'
          } else if (/\b(que es internet|como funciona internet)\b/.test(msg)) {
            answer = 'Internet es una red mundial de redes que permite intercambiar datos, navegar por páginas y comunicarse. 🌐'
          } else if (/\b(que es un algoritmo|algoritmo)\b/.test(msg)) {
            answer = 'Un algoritmo es una serie ordenada de pasos para resolver un problema o realizar una tarea. 📋'
          } else if (/\b(que es una api|api)\b/.test(msg)) {
            answer = 'Una API permite que distintos programas se comuniquen mediante reglas definidas. 🔌'
          } else if (/\b(que es una variable en programacion|variable en programacion)\b/.test(msg)) {
            answer = 'Una variable en programación es un nombre que permite guardar y utilizar un valor dentro de un programa. 💻'
          } else if (/\b(que es una pagina web|pagina web|sitio web)\b/.test(msg)) {
            answer = 'Una página web es un documento que se muestra en un navegador. HTML organiza el contenido, CSS le da estilo y JavaScript añade interactividad. 🌐'
          } else if (/\b(que es la energia solar|energia solar)\b/.test(msg)) {
            answer = 'La energía solar aprovecha la luz o el calor del Sol. Los paneles solares pueden convertir la luz en electricidad. ☀️'
          } else if (/\b(que es el cambio climatico|cambio climatico)\b/.test(msg)) {
            answer = 'El cambio climático es una variación duradera del clima. El calentamiento actual se debe principalmente a los gases de efecto invernadero producidos por actividades humanas. 🌍'
          } else if (/\b(que es una contraseña segura|contrasena segura|proteger mi cuenta)\b/.test(msg)) {
            answer = 'Usa contraseñas largas y únicas, activa la verificación en dos pasos y nunca compartas códigos de acceso. 🔐'
          } else if (/\b(que es roblox|roblox)\b/.test(msg)) {
            answer = 'Roblox es una plataforma con juegos y experiencias creados por usuarios. 🎮 Cuida tu privacidad y no compartas datos personales con desconocidos.'
          } else if (/\b(que es minecraft|minecraft)\b/.test(msg)) {
            answer = 'Minecraft es un videojuego de exploración, construcción y supervivencia en un mundo de bloques. ⛏️'
          } else if (/\b(que es anime|anime)\b/.test(msg)) {
            answer = 'Anime es el término común para la animación japonesa. 🌸 Incluye aventura, comedia, misterio, fantasía y muchos otros géneros.'
          } else if (/\b(que es manga|manga)\b/.test(msg)) {
            answer = 'El manga es el cómic japonés y abarca muchos géneros e historias diferentes. 📚'
          } else if (/\b(que es la amistad|amistad verdadera)\b/.test(msg)) {
            answer = 'Una amistad sana se basa en respeto, confianza, comunicación y apoyo mutuo. 🌷'
          } else if (/\b(como estudiar mejor|consejos para estudiar|tengo examen)\b/.test(msg)) {
            answer = 'Prueba estudiar en bloques cortos, practicar preguntas, explicar el tema con tus palabras y descansar lo suficiente. 📚'
          } else if (/\b(perro|perros)\b/.test(msg) && /\b(dato|curioso|sabes)\b/.test(msg)) {} else if (/\b(perro|perros)\b/.test(msg) && /\b(dato|curioso|sabes)\b/.test(msg)) {
            answer = 'Dato curioso 🐶: los perros tienen un sentido del olfato mucho más desarrollado que el de los humanos.'
          } else if (/\b(gato|gatos)\b/.test(msg) && /\b(dato|curioso|sabes)\b/.test(msg)) {
            answer = 'Dato curioso 🐱: los gatos usan distintas vocalizaciones y lenguaje corporal para comunicarse con humanos y otros animales.'
          } else if (/\b(dinosaurio|dinosaurios)\b/.test(msg)) {
            answer = 'Los dinosaurios dominaron muchos ecosistemas durante la era Mesozoica. Las aves actuales descienden de dinosaurios terópodos. 🦖'
          } else if (/\b(agua|h2o)\b/.test(msg) && /\b(que es|formula|compone|formada)\b/.test(msg)) {
            answer = 'El agua pura tiene fórmula H₂O: cada molécula contiene dos átomos de hidrógeno y uno de oxígeno. 💧'
          } else if (/\b(ayuda|ayudame|necesito ayuda)\b/.test(msg)) {
            answer = 'Claro que sí. 🌷 Dime qué necesitas y trataré de orientarte.'
          } else if (msg.endsWith('?') || /^(que|quien|cuando|donde|como|por que|cual|cuanto|cuantos|cuanta|cuantas)\b/.test(msg)) {
            answer = 'Buena pregunta. 🧠 Todavía no tengo una respuesta programada para eso. Puedo responder algunos temas generales, y podemos ampliar mi base de conocimientos con más preguntas y respuestas.'
          } else {
            answer = pick([
              'Te leo. 🌺 Cuéntame un poquito más para seguir la conversación.',
              'JAJA, explícame un poco más para entenderte bien. 💗',
              'Interesanteee. 🫧 ¿Qué pasó después?',
              'No tengo una respuesta exacta para eso todavía, pero podemos seguir hablando. 🌷',
              'A ver, papá, dame más contexto para no responder cualquier cosa. 😭🌺'
            ])
          }

          await reply(answer)
          continue
        }

        // YULI_STORY_COMMAND_V1
        if (command === 'yuli') {
          const historia =
            '╭━━━〔 🌷 𝐌𝐈 𝐇𝐈𝐒𝐓𝐎𝐑𝐈𝐀 〕━━━╮\n\n' +
            '       ୨୧ 𝐘𝐔𝐋𝐈 𝐁𝐎𝐓 ୨୧\n\n' +
            '🌸 ¡Holaaa! Soy *Yuli Bot*.\n\n' +
            '🪷 Fui creada como un proyecto hecho con dedicación, ilusión y muchas ganas de aprender. Cada comando y cada mejora forman parte de mi historia.\n\n' +
            '💗 Pero también tengo un significado especial: nací como un *regalito de cariño para Ania*, una pequeña creación hecha pensando en ella.\n\n' +
            '🎀 *Mi propósito:* seguir creciendo, ayudar y convertir este proyecto en algo único.\n\n' +
            '📅 *Primer commit registrado:* 22/10/2026\n' +
            '🕔 *Hora registrada:* 5:00 p. m. (El Salvador)\n' +
            '💻 *Repositorio:* github.com/jhondzn03-bit/yuli-bot\n\n' +
            '🌺 Cada actualización escribe una nueva página de mi historia.\n\n' +
            '╰━━━〔 𝐂𝐎𝐍 𝐂𝐀𝐑𝐈Ñ𝐎, 𝐘𝐔𝐋𝐈 〕━━━╯'
          await reply(historia)
          continue
        }

        // YULI_PROFILE_COMMANDS_V1
        if (['perfil', 'setdesc', 'deldesc', 'verperfil', 'setcumple', 'setgenero', 'setmatrimonio', 'setpareja'].includes(command)) {
          const fs = await import('node:fs/promises')
          const path = await import('node:path')
          const file = path.join(process.cwd(), 'data', 'perfiles.json')
          await fs.mkdir(path.dirname(file), { recursive: true })

          let profiles = {}
          try {
            profiles = JSON.parse(await fs.readFile(file, 'utf8'))
          } catch (e) {
            if (e.code !== 'ENOENT') throw e
          }

          const userId = sender
          const description = argText.trim()
          const profile = profiles[userId] || {
            name: m.pushName || 'Usuario',
            description: '',
            birthday: '',
            gender: '',
            marriage: 'Soltero/a',
            partner: 'Nadie',
            level: 1,
            exp: 66,
            rank: 'Bronze I 🥉',
            money: 25,
            bank: 0
          }

          if (command === 'setdesc') {
            if (!description || description.length > 300) {
              await reply('🌸 Uso: /setdesc tu descripción (máximo 300 caracteres)')
              continue
            }
            profile.description = description
            profile.name = m.pushName || profile.name || 'Usuario'
            profiles[userId] = profile
            await fs.writeFile(file, JSON.stringify(profiles, null, 2))
            await reply('✅ Descripción guardada.')
            continue
          }

          if (command === 'deldesc') {
            profile.description = ''
            profiles[userId] = profile
            await fs.writeFile(file, JSON.stringify(profiles, null, 2))
            await reply('🧹 Descripción eliminada.')
            continue
          }

          if (command === 'setcumple') {
            if (!description) {
              await reply('🎂 Uso: /setcumple DD/MM/AAAA')
              continue
            }
            profile.birthday = description
          } else if (command === 'setgenero') {
            if (!description) {
              await reply('⚥ Uso: /setgenero tu género')
              continue
            }
            profile.gender = description
          } else if (command === 'setmatrimonio') {
            if (!description) {
              await reply('💍 Uso: /setmatrimonio Soltero/a')
              continue
            }
            profile.marriage = description
          } else if (command === 'setpareja') {
            profile.partner = description || 'Nadie'
          } else if (command === 'perfil' || command === 'verperfil') {
            const target = command === 'verperfil' && m.message?.extendedTextMessage?.contextInfo?.participant
              ? m.message.extendedTextMessage.contextInfo.participant
              : userId
            const data = profiles[target] || profile
            const money = Number(data.money ?? 25)
            const bank = Number(data.bank ?? 0)
            const total = money + bank
            const text =
              '「✿」 *Perfil* ◢ ... ◤\n\n' +
              '📝 Descripción › _' + (data.description || 'Sin descripción') + '_\n' +
              '🎂 Cumpleaños › *' + (data.birthday || 'No especificado') + '*\n' +
              '⚥ Género › *' + (data.gender || 'No especificado') + '*\n' +
              '💍 Matrimonio › *' + (data.marriage || 'Soltero/a') + '*\n' +
              '❤️ Pareja › *' + (data.partner || 'Nadie') + '*\n\n' +
              '✿ Nivel › *' + (data.level ?? 1) + '*\n' +
              '❀ Experiencia › *' + (data.exp ?? 66) + '*\n' +
              '✐ Rango › *' + (data.rank || 'Bronze I 🥉') + '*\n\n' +
              '⛀ Dinero › *' + money + ' Yulis*\n' +
              '⚿ Banco › *' + bank + ' Yulis*\n' +
              '⛁ Total › *' + total + ' Yulis*'

            try {
              const jid = target
              const imageUrl = await sock.profilePictureUrl(jid, 'image')
              const response = await fetch(imageUrl)
              if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer())
                await sock.sendMessage(m.key.remoteJid, {
                  image: buffer,
                  caption: text
                }, { quoted: m })
                continue
              }
            } catch (e) {
              // Si la foto no está disponible, enviar el perfil en texto.
            }
            await reply(text)
            continue
          }

          profiles[userId] = profile
          await fs.writeFile(file, JSON.stringify(profiles, null, 2))
          await reply('✅ Perfil actualizado. Usa /perfil para verlo.')
          continue
        }


// YULI_FRASE_COMMAND_V1
if (command === 'frase') {

  const match = argText.match(/^(\d{1,3})\s*\/\s*(\d{8,15})\s*\/\s*(.+)$/)
  if (!match) {
    await reply(
      '🌸 Uso: /frase DÍAS / NÚMERO / REMITENTE\n' +
      'Ejemplo: /frase 39 / 50312345678 / Jhon'
    )
    continue
  }

  const days = Number(match[1])
  const number = match[2]
  const remitente = match[3].trim()

  if (days < 1 || days > 7 || !remitente) {
    await reply('🌷 Los días deben ser de 1 a 7 y debes indicar quién envía las frases.')
    continue
  }

  const id = String(Date.now())
  const destination = number + '@s.whatsapp.net'

  try {
    await sock.sendMessage(destination, {
      text: generarFrase() + '\n\n💌 De parte de ' + remitente
    })

    if (days > 1) {
      const tasks = await readFraseTasks()
      tasks.push({
        id,
        jid: destination,
        auto: true,
        remitente,
        remaining: days - 1,
        nextAt: Date.now() + DAY_MS,
        createdAt: new Date().toISOString()
      })
      await saveFraseTasks(tasks)
    }

    await reply(
      '🌸 PROGRAMACIÓN LISTA\n' +
      '💌 Primera frase enviada ahora.\n' +
      '📱 Destino: ' + number + '\n' +
      '💗 De parte de: ' + remitente + '\n' +
      '📅 Duración: ' + days + ' días.\n' +
      (days > 1
        ? '🆔 ID: ' + id + '\n❌ Cancelar: /frasecancelar ' + id
        : '🌷 No quedan envíos programados.')
    )
  } catch (e) {
    console.error('Error al iniciar frase:', e.message)
    await reply('❌ No pude enviar la frase. Comprueba el número y vuelve a intentarlo.')
  }
  continue
}

if (command === 'frasecancelar') {
          if (!await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo los owners pueden cancelar frases.')
            continue
          }
          const id = (args[0] || '').trim()
          if (!id) {
            await reply('Uso: .frasecancelar ID')
            continue
          }
          const tasks = await readFraseTasks()
          const remaining = tasks.filter(t => t.id !== id)
          if (remaining.length === tasks.length) {
            await reply('🌷 No encontré una programación con ese ID.')
            continue
          }
          await saveFraseTasks(remaining)
          await reply('✅ Programación cancelada: ' + id)
          continue
        }

        if (command === 'frasesprogramadas') {
          if (!await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo los owners pueden consultar las programaciones.')
            continue
          }
          const tasks = await readFraseTasks()
          await reply(tasks.length
            ? '🌸 PROGRAMACIONES\n' + tasks.map(t =>
                'ID: ' + t.id + '\nDestino: ' +
                t.jid.split('@')[0] + '\nDías restantes: ' +
                t.remaining + '\nMensaje: ' + t.message
              ).join('\n\n')
            : '🌷 No hay frases programadas.')
          continue
        }

        // YULI_CC_COMMAND_V1
        if (command === 'cc') {
          if (!await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo los propietarios pueden usar .cc.')
            continue
          }

          try {
            await sock.chatModify({
              clear: {
                lastMessages: [{
                  key: m.key,
                  messageTimestamp: m.messageTimestamp
                }]
              }
            }, jid)
          } catch (error) {
            console.error('Error en .cc:', error.message)
            await reply('❌ No se pudo limpiar el chat: ' + error.message)
          }
          continue
        }

        const group = jid.endsWith('@g.us')
        if (await handleWelcomeCommand({
          command, args, argText, m, jid, sender, sock, reply, group,
          isOwner, isAdmin, downloadContentFromMessage, streamToBuffer
        })) continue


        // YULI_ANTIBOTS_COMMANDS_V1
        if (command === 'antibots') {
          if (!group) {
            await reply('🌸 Usa .antibots dentro de un grupo.')
            continue
          }

          const { admin, botAdmin } = await isAdmin(sock, jid, sender)
          if (!admin && !await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo administradores pueden configurar antibots.')
            continue
          }

          const data = await readAntibots()
          const cfg = data[jid] || { enabled: false, blocked: [] }
          const action = (args[0] || '').toLowerCase()

          if (action === '1' || action === '0') {
            if (action === '1' && !botAdmin) {
              await reply('🌷 Necesito ser administrador para expulsar usuarios.')
              continue
            }
            cfg.enabled = action === '1'
            data[jid] = cfg
            await saveAntibots(data)
            await reply(cfg.enabled
              ? '🛡️ Antibots activado. Solo expulsaré números que añadas a la lista.'
              : '🔕 Antibots desactivado.')
            continue
          }

          if (action === 'add' || action === 'del') {
            const number = (args[1] || '').replace(/\D/g, '')
            if (!/^\d{8,15}$/.test(number)) {
              await reply('Uso: .antibots add 50312345678\nO: .antibots del 50312345678')
              continue
            }
            cfg.blocked = Array.isArray(cfg.blocked) ? cfg.blocked : []
            if (action === 'add') {
              if (!cfg.blocked.includes(number)) cfg.blocked.push(number)
            } else {
              cfg.blocked = cfg.blocked.filter(n => n !== number)
            }
            data[jid] = cfg
            await saveAntibots(data)
            await reply(action === 'add'
              ? `✅ Número ${number} añadido a la lista antibots.`
              : `✅ Número ${number} eliminado de la lista antibots.`)
            continue
          }

          await reply(
            '🛡️ ANTIBOTS\\n' +
            '.antibots 1 — activar\\n' +
            '.antibots 0 — desactivar\\n' +
            '.antibots add número — bloquear número\\n' +
            '.antibots del número — quitar número'
          )
          continue
        }

        // Activar o desactivar alertas de administración
        if (command === 'on' || command === 'off') {
          if ((args[0] || '').toLowerCase() === 'detec') {
            if (!group) {
              await reply('🌸 Usa este comando dentro del grupo que quieres configurar.')
              continue
            }

            if (!await isOwner(sock, sender, jid)) {
              await reply('🛡️ Solo los propietarios de Yuli Bot pueden configurar estas alertas.')
              continue
            }

            const settings = await readDetecSettings()
            const enabled = command === 'on'
            settings[jid] = enabled
            await writeDetecSettings(settings)

            await reply(enabled
              ? '🔔 Alertas de administradores ACTIVADAS en este grupo.\\n\\nAvisaré cuando alguien dé o quite admin.'
              : '🔕 Alertas de administradores DESACTIVADAS en este grupo.')

            continue
          }
        }


        if (!process.env.YULI_SUBBOT &&
            ['code', 'bot', 'silenciarsub', 'activarsub'].includes(command)) {
          if (command !== 'code' && !await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo los propietarios de Yuli Bot pueden usar este comando.')
            continue
          }

          if (command === 'code') {
            const number = args[0] || ''
            if (!/^\d{8,15}$/.test(number)) {
              await reply('🌸 Uso: /code 503XXXXXXXX\nIncluye el código de país, solo números.')
              continue
            }

            const senderJid = String(sender)
            const senderNumber = /@(s\.whatsapp\.net|c\.us)$/.test(senderJid)
              ? senderJid.split('@')[0].split(':')[0].replace(/\D/g, '')
              : ''

            if (!senderNumber || senderNumber !== number) {
              await reply('🔐 Por seguridad, solicita únicamente tu propio número. Si tu cuenta aparece como identificador privado, prueba desde el chat privado de Yuli.')
              continue
            }

            const privateJid = senderJid

            const registry = await readSubbotRegistry()
            const previous = registry[number]

            if (previous?.pid) {
              try {
                process.kill(Number(previous.pid), 0)
                await reply('🌷 Ya hay un subbot registrado como activo para ese número.')
                continue
              } catch {}
            }

            const sessionDir = './subbots/' + number + '/session'
            const { mkdir } = await import('node:fs/promises')
            await mkdir(sessionDir, { recursive: true })

            const child = fork('./index.js', [], {
              cwd: process.cwd(),
              env: {
                ...process.env,
                YULI_SUBBOT: '1',
                YULI_SESSION_DIR: sessionDir,
                YULI_PAIRING_NUMBER: number
              },
              detached: true,
              stdio: ['ignore', 'inherit', 'inherit', 'ipc']
            })

            registry[number] = {
              pid: child.pid,
              number,
              sessionDir
            }
            await writeSubbotRegistry(registry)

            child.on('message', async message => {
              try {
                if (message?.type === 'yuli-pairing-code') {
                  await sock.sendMessage(privateJid, {
                    text: '🌸 CÓDIGO DE VINCULACIÓN\n\n' +
                      'Número: ' + number + '\n' +
                      'Código: ' + message.code + '\n\n' +
                      'En ese número abre WhatsApp → Dispositivos vinculados → Vincular con número.\n' +
                      'No compartas este código con nadie.'
                  })
                } else if (message?.type === 'yuli-pairing-error') {
                  await sock.sendMessage(privateJid, {
                    text: '🌷 No se pudo generar el código: ' + message.error
                  })
                } else if (message?.type === 'yuli-subbot-open') {
                  await sock.sendMessage(privateJid, {
                    text: '🌺 El subbot ' + number + ' ya está conectado.'
                  })
                }
              } catch (error) {
                console.error('No se pudo informar al propietario:', error.message)
              }
            })

            child.on('exit', async () => {
              try {
                const latest = await readSubbotRegistry()
                if (latest[number]?.pid === child.pid) {
                  delete latest[number]
                  await writeSubbotRegistry(latest)
                }
              } catch (error) {
                console.error('No se pudo actualizar el registro de subbots:', error.message)
              }
            })

            child.on('error', error => {
              console.error('Error iniciando subbot:', error.message)
            })

            child.unref()
            child.channel?.unref()

            await reply('🌸 Solicitud iniciada para tu número. Revisa el chat privado de Yuli para recibir el código.')
            continue
          }

          if (command === 'bot') {
            if ((args[0] || '').toLowerCase() !== 'off') {
              await reply('🌸 Uso: .bot off\nEsto apagará únicamente el bot principal.')
              continue
            }

            await reply('🌷 Yuli Bot principal se apagará. Los subbots tienen procesos independientes.')
            await sleep(1500)
            process.exit(0)
          }

          if (!group) {
            await reply('🌸 Este comando solo funciona dentro de un grupo.')
            continue
          }

          const silence = await readSubSilence()

          if (command === 'silenciarsub') {
            silence[jid] = true
            await writeSubSilence(silence)
            await reply('🔇 Los subbots dejarán de responder en este grupo.')
            continue
          }

          if (command === 'activarsub') {
            delete silence[jid]
            await writeSubSilence(silence)
            await reply('🔊 Los subbots podrán responder de nuevo en este grupo.')
            continue
          }
        }

        if (process.env.YULI_SUBBOT === '1' && group) {
          const silence = await readSubSilence()
          if (silence[jid]) continue
        }

// CUSTOM_COMMANDS_SYSTEM_V1
        const customOperation =
          ['crearcmd', 'menucmd', 'delcmd'].includes(command) ||
          (command.startsWith('add') && command.length > 3) ||
          (command.startsWith('set') &&
            !['setprefix', 'setowner', 'setdesc'].includes(command) && command.length > 3) ||
          (command.startsWith('del') &&
            !['delowner', 'deldesc'].includes(command) && command.length > 3)

        if (customOperation) {
          if (!group) {
            await reply('🌸 Los comandos personalizados solo funcionan en grupos.')
            continue
          }

          const database = await readCustomCommands()
          const records = database[jid] || {}
          const isListing = command === 'menucmd'

          if (!isListing) {
            const { admin } = await isAdmin(sock, jid, sender)
            if (!admin) {
              await reply('🛡️ Solo los administradores del grupo pueden modificar comandos.')
              continue
            }
          }

          if (command === 'menucmd') {
            const names = Object.keys(records)
            await reply(
              '📦 COMANDOS DE ESTE GRUPO\n\n' +
              (names.length
                ? names.map(name => '• ' + prefix + name).join('\n')
                : 'Todavía no hay comandos creados.')
            )
            continue
          }

          if (command === 'crearcmd') {
            const name = (args[0] || '').toLowerCase()
            const reserved = [
              'menu', 'help', 'ping', 'runtime', 'setprefix',
              'owners', 'setowner', 'delowner', 'owner', 'estado',
              'descargas', 'dado', 'moneda', 'ppt', 'sticker', 'wm',
              'crearcmd', 'menucmd', 'delcmd'
            ]

            if (!/^[a-z0-9_-]{2,24}$/.test(name) ||
                reserved.includes(name) ||
                name.startsWith('add') ||
                name.startsWith('set') ||
                name.startsWith('del')) {
              await reply('🌷 Usa un nombre válido. Ejemplo: ' + prefix + 'crearcmd stock')
              continue
            }

            if (records[name]) {
              await reply('📦 El comando ' + prefix + name + ' ya existe en este grupo.')
              continue
            }

            records[name] = { text: '', image: null, mimetype: null }
            database[jid] = records
            await writeCustomCommands(database)
            await reply(
              '🌸 Comando creado: ' + prefix + name + '\n\n' +
              'Agregar: ' + prefix + 'add' + name + ' texto\n' +
              'Editar: ' + prefix + 'set' + name + ' contenido\n' +
              'Usar: ' + prefix + name + '\n' +
              'Borrar contenido: ' + prefix + 'del' + name + '\n' +
              'Eliminar comando: ' + prefix + 'delcmd ' + name
            )
            continue
          }

          if (command === 'delcmd') {
            const name = (args[0] || '').toLowerCase()
            if (!records[name]) {
              await reply('🌷 Ese comando no existe en este grupo.')
              continue
            }

            delete records[name]
            database[jid] = records
            await writeCustomCommands(database)
            await reply('🗑️ Comando ' + prefix + name + ' eliminado completamente.')
            continue
          }

          let action = ''
          let name = ''

          if (command.startsWith('add')) {
            action = 'add'
            name = command.slice(3)
          } else if (command.startsWith('set')) {
            action = 'set'
            name = command.slice(3)
          } else if (command.startsWith('del')) {
            action = 'del'
            name = command.slice(3)
          }

          if (!name || !records[name]) {
            await reply('🌷 Primero crea el comando con ' + prefix + 'crearcmd nombre')
            continue
          }

          if (action === 'del') {
            records[name] = { text: '', image: null, mimetype: null }
            database[jid] = records
            await writeCustomCommands(database)
            await reply('🧹 Contenido de ' + prefix + name + ' eliminado. El comando sigue creado.')
            continue
          }

          const content = argText.trim()
          const imageMessage = getImage(m)
          let imageBase64 = null
          let mimetype = null

          if (imageMessage) {
            const stream = await downloadContentFromMessage(imageMessage, 'image')
            imageBase64 = (await streamToBuffer(stream)).toString('base64')
            mimetype = imageMessage.mimetype || 'image/jpeg'
          }

          if (!content && !imageBase64) {
            await reply(
              '🌸 Envía texto o una imagen.\n' +
              'También puedes responder a una imagen con ' +
              prefix + command + ' texto'
            )
            continue
          }

          const entry = records[name]
          if (content) entry.text = content
          if (imageBase64) {
            entry.image = imageBase64
            entry.mimetype = mimetype
          }

          database[jid] = records
          await writeCustomCommands(database)
          await reply('✅ Contenido de ' + prefix + name + ' guardado correctamente.')
          continue
        }

        if (group) {
          const database = await readCustomCommands()
          const entry = database[jid]?.[command]

          if (entry) {
            if (entry.image) {
              await sock.sendMessage(jid, {
                image: Buffer.from(entry.image, 'base64'),
                caption: entry.text || ''
              }, { quoted: m })
            } else {
              await reply(entry.text || '📦 Este comando todavía no tiene contenido.')
            }
            continue
          }
        }

        if (command === 'menu' || command === 'help') {
          try {
            const { readFile } = await import('node:fs/promises')
            const banner = await readFile('./media/yuli-banner.jpg')
            await sock.sendMessage(jid, {
              image: banner,
              caption: menu() + '\\n\\n📢 Canal oficial: https://whatsapp.com/channel/0029Vb9CrhPAojYmLwHz162I/101'
            }, { quoted: m })
          } catch (e) {
            console.error('Error enviando banner:', e)
            await reply(menu())
          }
          continue
        }

        // YULI_EXTRAS_HANDLER
        const extraCommands = {
          mayus: t => t.toUpperCase(),
          minus: t => t.toLowerCase(),
          inverso: t => [...t].reverse().join(''),
          contar: t => `Caracteres: ${t.length}\\nPalabras: ${t.trim() ? t.trim().split(/\\s+/).length : 0}`,
          eco: t => t || 'Escribe un texto.',
          repetir: t => t ? Array(3).fill(t).join('\\n') : 'Escribe un texto.',
          codigo: t => [...t].map(c => c.charCodeAt(0)).join(' '),
          binario: t => [...t].map(c => c.charCodeAt(0).toString(2)).join(' '),
          dado6: () => `🎲 Resultado: ${1 + Math.floor(Math.random() * 6)}`,
          dado20: () => `🎲 Resultado: ${1 + Math.floor(Math.random() * 20)}`,
          moneda2: () => Math.random() < .5 ? '🪙 Cara' : '🪙 Cruz',
          azar: () => `🎲 Número: ${1 + Math.floor(Math.random() * 100)}`,
          suerte: () => `🍀 Número de suerte: ${1 + Math.floor(Math.random() * 99)}`,
          consejo: () => ['Sigue aprendiendo.', 'Avanza paso a paso.', 'Organiza tus metas.', 'Descansa cuando lo necesites.'][Math.floor(Math.random() * 4)],
          frase: () => ['Cada día es una oportunidad.', 'Los pequeños avances cuentan.', 'La práctica mejora tus habilidades.'][Math.floor(Math.random() * 3)],
          fecha: () => new Date().toLocaleDateString('es-SV'),
          hora: () => new Date().toLocaleTimeString('es-SV'),
          fechaora: () => new Date().toLocaleString('es-SV'),
          ayudaextra: () => Object.keys(extraCommands).map(x => prefix + x).join(', ')
        }

        if (Object.hasOwn(extraCommands, command)) {
          await reply(String(extraCommands[command](argText)))
          continue
        }

        if (command === 'ping') {
          const recibido = Number(m.messageTimestamp || 0) * 1000
          const latencia = recibido > 0
            ? Math.max(0, Date.now() - recibido)
            : 0

          await reply(
            `╭━━━〔 🌺 YULI BOT 🌺 〕━━━╮\n` +
            `┃ ✅ BOT ACTIVO\n` +
            `┃ ⚡ LATENCIA: ${latencia} ms\n` +
            `╰━━━━━━━━━━━━━━━━━━╯`
          )
          continue
        }

        if (command === 'runtime') {
          const sec = Math.floor(process.uptime())
          const h = Math.floor(sec / 3600)
          const min = Math.floor((sec % 3600) / 60)
          await reply(`🌸 Tiempo activo: ${h} h ${min} min ${sec % 60} s`)
          continue
        }

        if (command === 'setprefix') {
          if (!await isOwner(sock, sender, jid)) {
            await reply('⛔ Solo los owners pueden cambiar el prefijo.')
            continue
          }

          const newPrefix = args[0]

          if (!newPrefix || /\\s/.test(newPrefix) || newPrefix.length > 3) {
            await reply('🌸 Escribe un prefijo de 1 a 3 caracteres. Ejemplo: ' + prefix + 'setprefix #')
            continue
          }

          prefix = newPrefix
          await writeFile('./prefix.json', prefix + '\\n')
          await reply('🌺 Prefijo actualizado correctamente.\\nNuevo prefijo: ' + prefix + '\\nPrueba: ' + prefix + 'menu')
          continue
        }

        if (['owners', 'setowner', 'delowner'].includes(command)) {
          if (!await isOwner(sock, sender, jid)) {
            await reply('🛡️ Solo los propietarios pueden usar este comando.')
            continue
          }

          if (command === 'owners') {
            const list = owners.map(n => '@' + n).join('\n')
            await sock.sendMessage(jid, {
              text: '👑 Propietarios de Yuli Bot 🌺\n' + (list || 'Lista vacía'),
              mentions: owners.map(n => n + '@s.whatsapp.net')
            }, { quoted: m })
            continue
          }

          const number = argText.replace(/\D/g, '')
          if (!/^\d{8,15}$/.test(number)) {
            await reply('🌸 Escribe el número con código de país. Ejemplo: .setowner 50312345678')
            continue
          }

          if (command === 'setowner') {
            if (owners.includes(number)) {
              await reply('🌷 Ese número ya es propietario.')
              continue
            }
            owners.push(number)
            await saveOwners()
            await reply('🌺 Propietario agregado y guardado.')
            continue
          }

          if (!owners.includes(number)) {
            await reply('🌷 Ese número no está en la lista.')
            continue
          }
          if (owners.length <= 1) {
            await reply('🛡️ No se puede eliminar al último propietario.')
            continue
          }
          owners = owners.filter(n => n !== number)
          await saveOwners()
          await reply('🌸 Propietario eliminado y guardado.')
          continue
        }

        if (command === 'owner') {
          const ownerList = owners.length
            ? owners.map(n => '@' + n).join('\n')
            : 'No hay propietarios configurados'
          await sock.sendMessage(jid, {
            text: '👑 Propietarios de Yuli Bot 🌺\n' + ownerList,
            mentions: owners.map(n => n + '@s.whatsapp.net')          }, { quoted: m })
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


        // YULI_EXTRA_COMMANDS_V1
        if (command === 'calc' || command === 'calcular') {
          const expr = argText.trim()
          if (!expr || !/^[\d\s()+\-*/%.]+$/.test(expr) || !/\d/.test(expr)) {
            await reply(`🧮 Usa: ${prefix}calc 25 * 4`)
            continue
          }
          try {
            const tokens = expr.match(/\d+(?:\.\d+)?|[()+\-*/%]/g) || []
            if (tokens.join('') !== expr.replace(/\s/g, '')) throw Error()
            const output = []
            for (const t of tokens) {
              if (/^\d/.test(t)) output.push(Number(t))
              else if (t === '(') output.push(t)
              else if (t === ')') {
                while (output.at(-1) !== '(') {
                  const op = output.pop(), b = output.pop(), a = output.pop()
                  if (!Number.isFinite(a) || !Number.isFinite(b)) throw Error()
                  output.push(op === '+' ? a+b : op === '-' ? a-b : op === '*' ? a*b : op === '/' ? a/b : a%b)
                }
                output.pop()
              } else {
                while (output.length >= 3 && typeof output.at(-2) === 'string' &&
                  (['*','/','%'].includes(output.at(-2)) || ['+','-'].includes(t))) {
                  const op = output.pop(), b = output.pop(), a = output.pop()
                  output.push(op === '+' ? a+b : op === '-' ? a-b : op === '*' ? a*b : op === '/' ? a/b : a%b)
                }
                output.push(t)
              }
            }
            while (output.length > 1) {
              const op = output.pop(), b = output.pop(), a = output.pop()
              output.push(op === '+' ? a+b : op === '-' ? a-b : op === '*' ? a*b : op === '/' ? a/b : a%b)
            }
            const result = output[0]
            if (typeof result !== 'number' || !Number.isFinite(result)) throw Error()
            await reply(`🧮 ${expr} = ${result}`)
          } catch {
            await reply('❌ No pude calcularlo. Ejemplo: /calc (12 + 8) * 3')
          }
          continue
        }

        if (command === 'moneda2') {
          await reply(`🪙 Resultado: ${Math.random() < .5 ? 'CARA' : 'CRUZ'}`)
          continue
        }

        if (command === 'elige') {
          const opciones = argText.split('|').map(x => x.trim()).filter(Boolean)
          if (opciones.length < 2) {
            await reply(`🎯 Usa: ${prefix}elige pizza | hamburguesa | tacos`)
          } else {
            await reply('🎯 Yuli elige: ' + opciones[Math.floor(Math.random()*opciones.length)])
          }
          continue
        }

        if (command === 'dado20') {
          await reply(`🎲 D20: ${1 + Math.floor(Math.random()*20)}`)
          continue
        }

        if (command === 'suerte') {
          const frases = ['Hoy puede sorprenderte algo bueno 🍀','Confía en tus pequeños avances 🌷','Una oportunidad nueva puede aparecer ✨','Respira, organiza tus ideas y sigue 💗','Tu siguiente intento puede salir mejor 🌟']
          await reply('🍀 ' + frases[Math.floor(Math.random()*frases.length)])
          continue
        }

        if (command === 'consejo' || command === 'consejos') {
          const frases = ['No tienes que resolverlo todo hoy.','Cuida tu paz y pon límites con respeto.','Aprender también significa equivocarse.','Avanza a tu ritmo, sin compararte.','Pide ayuda cuando la necesites.']
          await reply('🌸 Consejo de Yuli:\n' + frases[Math.floor(Math.random()*frases.length)])
          continue
        }

        if (command === 'poema') {
          await reply('🌷 Un pequeño instante,\nuna estrella al pasar,\nun sueño que florece\ny mil caminos por andar. 💗')
          continue
        }

        if (command === 'piropo') {
          await reply('🌸 Tu forma de ser puede iluminar un día común. Nunca subestimes la amabilidad.')
          continue
        }

        if (command === 'compatibilidad') {
          const nombre = argText.trim()
          if (!nombre) {
            await reply(`💞 Usa: ${prefix}compatibilidad nombre1 y nombre2`)
          } else {
            const score = [...nombre.toLowerCase()].reduce((a,c) => a + c.charCodeAt(0), 0) % 101
            await reply(`💞 Compatibilidad divertida para ${nombre}: ${score}%\n✨ Solo es un juego, no mide relaciones reales.`)
          }
          continue
        }

        if (command === 'sugerir' || command === 'report') {
          if (!argText.trim()) {
            await reply(`📝 Escribe tu mensaje: ${prefix}${command} tu idea o reporte`)
          } else {
            await reply('📝 Gracias por compartirlo. Tu mensaje quedó en este chat; todavía no se envía automáticamente al owner.')
          }
          continue
        }

        if (command === 'comandos') {
          await reply(
            '🌸 COMANDOS EXTRA DE YULI 🌸\n' +
            '🎲 /dado20 — dado de 20 caras\n' +
            '🧮 /calc 25 * 4 — calculadora\n' +
            '🎯 /elige pizza | tacos — elegir opción\n' +
            '🍀 /suerte — mensaje de suerte\n' +
            '🌷 /consejo — consejo aleatorio\n' +
            '💌 /poema — poema corto\n' +
            '🌸 /piropo — cumplido amable\n' +
            '💞 /compatibilidad nombre1 y nombre2 — juego\n' +
            '📝 /sugerir texto — sugerencia\n' +
            '📝 /report texto — reporte local\n' +
            '🪙 /moneda2 — cara o cruz'
          )
          continue
        }


        // YULI_FUNCIONES_REALES_V1
        const pickYuli = a => a[Math.floor(Math.random() * a.length)]

        if (['motivacion','motiva','reflexion','reflexiones'].includes(command)) {
          const tips = [
            '🌷 Avanza a tu ritmo. No necesitas tener todo resuelto hoy.',
            '✨ Cada error puede enseñarte algo nuevo.',
            '💗 Trátate con la misma paciencia que ofreces a los demás.',
            '🌸 Descansar también forma parte de avanzar.',
            '🍀 Un pequeño paso sigue siendo progreso.',
            '🫧 No tienes que compararte con nadie para reconocer tu valor.'
          ]
          await reply('🌸 Mensaje de Yuli:\n' + pickYuli(tips))
          continue
        }

        if (['poema','poemas'].includes(command)) {
          const poems = [
            '🌷 Florece despacito,\ncomo lo hace una flor,\nque hasta el cielo más nublado\npuede llenarse de color.',
            '✨ Guarda sueños en el alma,\ny esperanza al caminar,\nque hay caminos sorprendentes\nque aún te quedan por hallar.',
            '🌸 Una estrella pequeñita\nbrilla en la inmensidad,\ny nos recuerda en silencio\nque también podemos brillar.'
          ]
          await reply(pickYuli(poems))
          continue
        }

        if (['piropo','teamo','amistad'].includes(command)) {
          const msgs = [
            '🌸 Tu amabilidad puede hacer más bonito el día de alguien.',
            '💗 La amistad sincera se demuestra con respeto y apoyo.',
            '✨ Los pequeños detalles pueden significar muchísimo.',
            '🫶 Mereces relaciones donde haya respeto, confianza y tranquilidad.'
          ]
          await reply(pickYuli(msgs))
          continue
        }

        if (['buenosdias','buenastardes','buenasnoches'].includes(command)) {
          const saludo = {
            buenosdias: '☀️ ¡Buenos días! Que hoy tengas motivos para sonreír.',
            buenastardes: '🌷 ¡Buenas tardes! Espero que tu día vaya muy bien.',
            buenasnoches: '🌙 ¡Buenas noches! Descansa y recarga energías.'
          }
          await reply(saludo[command])
          continue
        }

        if (['chistedia','chiste','chistes'].includes(command)) {
          await reply(pickYuli([
            '😂 ¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
            '🤣 ¿Qué le dijo un cero a un ocho? ¡Bonito cinturón!',
            '😆 ¿Qué hace una computadora cuando tiene frío? Cierra Windows.'
          ]))
          continue
        }

        if (['dato','datos','curiosidad','curiosidades'].includes(command)) {
          await reply(pickYuli([
            '🪐 Un día en Venus dura más que su año.',
            '🐙 Los pulpos tienen tres corazones.',
            '🌈 El arcoíris es un círculo completo, aunque desde el suelo normalmente vemos solo una parte.',
            '🦋 Las mariposas pueden percibir sabores con sus patas.'
          ]))
          continue
        }

        if (['pregunta','verdad','reto'].includes(command)) {
          const pool = {
            pregunta: ['🌸 ¿Qué habilidad te gustaría aprender?', '✨ ¿Qué lugar te gustaría conocer?', '💗 ¿Cuál es tu recuerdo favorito de este año?'],
            verdad: ['🌷 ¿Qué talento te gustaría tener?', '✨ ¿Qué canción podrías escuchar muchas veces?', '🌸 ¿Qué logro tuyo te da orgullo?'],
            reto: ['🎯 Di tres cosas que te gusten de ti.', '🌟 Recomienda una canción al grupo.', '🫧 Escribe una palabra que describa tu día.']
          }
          await reply(pickYuli(pool[command]))
          continue
        }

        if (['animequote','quote'].includes(command)) {
          await reply(pickYuli([
            '🎌 “Incluso los pasos pequeños te acercan a tu meta.”',
            '🌸 “La fuerza también consiste en levantarse y volver a intentarlo.”',
            '✨ “Tu historia todavía tiene capítulos por escribir.”'
          ]) + '\n— Frase original de Yuli')
          continue
        }

        if (['animequiz','trivia'].includes(command)) {
          await reply('🎌 QUIZ DE ANIME\n\n¿En qué serie aparece Naruto Uzumaki?\n\nA) One Piece\nB) Naruto\nC) Bleach\n\nResponde: /respuesta B')
          continue
        }

        if (command === 'respuesta') {
          const ans = argText.trim().toLowerCase()
          if (['b','naruto'].includes(ans)) {
            await reply('✅ ¡Correcto! Naruto Uzumaki es el protagonista de Naruto. 🎉')
          } else {
            await reply('❌ No es esa. La respuesta correcta era B) Naruto. ¡Intenta otra vez!')
          }
          continue
        }

        if (['recomendaanime','topanime','anime','manga','otaku','animeinfo','character','personajeanime','husbando','waifu','neko','shipanime'].includes(command)) {
          const data = {
            anime: '🎌 Puedes empezar por Naruto, Frieren, Haikyuu!! o Spy x Family.',
            manga: '📚 Recomendaciones para explorar: Yotsuba&, Witch Hat Atelier y Fullmetal Alchemist.',
            otaku: '🎌 Modo otaku activado: elige un anime, prepara algo rico y disfruta tu maratón.',
            animeinfo: '🎌 Escribe /animeinfo Naruto, /animeinfo One Piece o /animeinfo Spy x Family para recibir una ficha básica.',
            character: '🧑‍🎤 Escribe /character Naruto para recibir una ficha de personaje.',
            personajeanime: '🧑‍🎤 Escribe /personajeanime Luffy para recibir una ficha de personaje.',
            waifu: '🌸 Sugerencia aleatoria: Nezuko, Hinata o Anya. Escribe /waifu para volver a elegir.',
            neko: '🐱 ¡Modo neko! Nya~ Que tengas un día bonito. 🐾',
            husbando: '🎌 Sugerencia aleatoria: Levi, Gojo o Tanjiro.',
            shipanime: '💞 Escribe /shipanime nombre1 y nombre2 para crear una pareja ficticia de juego.',
            topanime: '🏆 Lista sugerida: Fullmetal Alchemist: Brotherhood, Frieren, Steins;Gate, Haikyuu!! y Spy x Family.',
            recomendaanime: '🍿 Recomendaciones: acción — Demon Slayer; comedia — Spy x Family; deportes — Haikyuu!!; fantasía — Frieren.'
          }
          if (['animeinfo','character','personajeanime'].includes(command)) {
            const name = argText.trim()
            if (!name) {
              await reply('ℹ️ Escribe un nombre. Ejemplo: /' + command + ' Naruto')
            } else {
              const known = {
                naruto: 'Naruto Uzumaki — protagonista de Naruto; sueña con convertirse en Hokage.',
                luffy: 'Monkey D. Luffy — protagonista de One Piece y capitán de los Sombrero de Paja.',
                anya: 'Anya Forger — personaje de Spy x Family que puede leer pensamientos dentro de la historia.',
                gojo: 'Satoru Gojo — personaje de Jujutsu Kaisen, conocido por su técnica y sus ojos.'
              }
              await reply('🎌 ' + (known[name.toLowerCase()] || 'No tengo una ficha guardada para "' + name + '". Prueba Naruto, Luffy, Anya o Gojo.'))
            }
          } else if (command === 'shipanime') {
            const names = argText.trim()
            if (!names) await reply('💞 Uso: /shipanime nombre1 y nombre2')
            else await reply('💞 Pareja ficticia del día: ' + names + '\n✨ Solo es un juego de fans.')
          } else {
            await reply(data[command])
          }
          continue
        }

        if (['frases','frasealeatoria'].includes(command)) {
          await reply(pickYuli([
            '🌷 Cada día trae una oportunidad para empezar de nuevo.',
            '✨ No necesitas ser perfecto para hacer algo valioso.',
            '💗 Cuida tu paz y celebra tus avances.',
            '🌸 A veces, ir despacio también es avanzar.'
          ]))
          continue
        }

        if (['allcmd','listcmd','comandos'].includes(command)) {
          await reply('🌸 COMANDOS DE TEXTO AÑADIDOS\n\n/frases\n/motivacion\n/consejo\n/poema\n/piropo\n/buenosdias\n/buenastardes\n/buenasnoches\n/chiste\n/dato\n/pregunta\n/verdad\n/reto\n/animequote\n/animequiz\n/respuesta B\n/animeinfo Naruto\n/character Luffy\n/recomendaanime\n/topanime\n/waifu\n/neko\n/shipanime nombre1 y nombre2\n\nNota: los comandos de imágenes reales necesitan funciones adicionales.')
          continue
        }

        if (['sugerir','report','feedback'].includes(command)) {
          const message = argText.trim()
          if (!message) {
            await reply('📝 Escribe tu mensaje. Ejemplo: /' + command + ' me gustaría otro juego')
          } else {
            await reply('📝 Gracias por tu mensaje. Yuli lo ha mostrado en este chat, pero todavía no lo guarda ni lo envía automáticamente al owner.')
          }
          continue
        }

        if (command === 'dado') {
          const { readFile } = await import('node:fs/promises')
          const { fileURLToPath } = await import('node:url')
          const { dirname, join } = await import('node:path')
          const here = dirname(fileURLToPath(import.meta.url))
          const webp = await readFile(join(here, 'dado-stickers', 'dado-animado.webp'))
          await sock.sendMessage(jid, { sticker: webp }, { quoted: m })
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


        if (command === 'wm') {
          const author = argText.trim()
          if (!author) {
            await reply('🌷 Responde a un sticker con ' + prefix + 'wm Nombre')
            continue
          }

          const context = m.message?.extendedTextMessage?.contextInfo
          let quoted = context?.quotedMessage

          while (quoted) {
            const nested = quoted.ephemeralMessage?.message ||
              quoted.viewOnceMessage?.message ||
              quoted.viewOnceMessageV2?.message
            if (!nested) break
            quoted = nested
          }

          const sticker = quoted?.stickerMessage
          if (!sticker) {
            await reply('🌸 Debes responder directamente a un sticker.')
            continue
          }

          const stream = await downloadContentFromMessage(sticker, 'sticker')
          const buffer = await streamToBuffer(stream)
          const WebpImage = webpmux.Image
          const img = new WebpImage()
          await img.load(buffer)

          const metadata = {
            'sticker-pack-id': 'yuli-bot-stickers',
            'sticker-pack-name': 'Yuli Bot',
            'sticker-pack-publisher': author,
            emojis: ['🌸']
          }

          const json = Buffer.from(JSON.stringify(metadata))
          const exif = Buffer.concat([
            Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
              0x01, 0x00, 0x41, 0x57, 0x07, 0x00]),
            Buffer.alloc(4),
            Buffer.from([0x16, 0x00, 0x00, 0x00]),
            json
          ])
          exif.writeUIntLE(json.length, 14, 4)
          img.exif = exif

          const tempFile = './.wm-' + Date.now() + '.webp'
          try {
            await img.save(tempFile)
            const result = await readFile(tempFile)
            await sock.sendMessage(jid, { sticker: result }, { quoted: m })
          } finally {
            const { unlink } = await import('node:fs/promises')
            await unlink(tempFile).catch(() => {})
          }

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

          if (!admin && !await isOwner(sock, sender, jid)) {
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
