const {

   default: makeWASocket,
   DisconnectReason,
   BufferJSON,
   useMultiFileAuthState,
   fetchLatestBaileysVersion,

} = require("@whiskeysockets/baileys")

const fs = require('fs')
const QRCode = require('qrcode')

const myCAS = require('./umfas.js')
const { s3qrwa, Bucket } = require('./config.js')
const { s3, deleteObject } = require('./db.js')

async function Wa () {
   return await new Promise(async (resv) => {
         const { version } = await fetchLatestBaileysVersion()
         const { state, saveCreds } = await myCAS('bot-auths', Bucket)
         const sock = makeWASocket({
           printQRInTerminal: true,
           qrTimeout: 10000*10,
           version: version,
           syncFullHistory: true,
           auth: state,
           markOnlineOnConnect: false
         })

          sock.ev.on('creds.update', saveCreds)
          sock.ev.on('connection.update', async({ connection, lastDisconnect, qr }) => {
              console.log(qr)
              if(qr)
               QRCode.toDataURL(qr, async (err, url) => {
                 await s3.putObject({...s3qrwa, Body: url})
               })
              if(connection === 'close'){
                 if((lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) !== DisconnectReason.loggedOut)
                    resv(await Wa())
                 else console.log('eror tidak bisa loging')
             }else if(connection === 'open')
                 resv(sock)
          })
   })
}


module.exports = Wa
