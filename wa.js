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
const { putObject, headObject } = require('./db.js')

async function Wa () {
   return await new Promise(async (resv) => {
         const { version } = await fetchLatestBaileysVersion()
         const { state, saveCreds } = await myCAS('bot-auths', Bucket)
         const sock = makeWASocket({
           printQRInTerminal: false,
           qrTimeout: 10000*10,
           version: version,
           syncFullHistory: true,
           auth: state,
           markOnlineOnConnect: false
         })

          sock.ev.on('creds.update', saveCreds)
          sock.ev.on('connection.update', async({ connection, lastDisconnect, qr }) => {
              if(qr)
               QRCode.toDataURL(qr, async (err, url) => {
                 console.log(await putObject(s3qrwa, {url, isLogin: false}))
                 resv(null)
               })
              if(connection === 'close'){
                 if((lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) !== DisconnectReason.loggedOut)
                    resv(await Wa())
                 else console.log('eror tidak bisa loging')
             }else if(connection === 'open'){
                 await putObject(s3qrwa, {url: null, isLogin: true})
                 resv(sock)
             }
          })
   })
}


module.exports = Wa
