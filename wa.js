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
const { Bucket } = require('./config.js')
const { putObject, headObject } = require('./db.js')

async function Wa () {
   return await new Promise(async(recvqr)=>{
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
               recvqr(url)
            })
           if(connection === 'close'){
              if((lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) !== DisconnectReason.loggedOut)
                 Wa(recvqr)
              else console.log('eror tidak bisa loging')
          }else if(connection === 'open')
              recvqr(sock)
      })
   })
}


module.exports = Wa
