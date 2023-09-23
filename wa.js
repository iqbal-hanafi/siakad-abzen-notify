const {

   default: makeWASocket,
   DisconnectReason,
   BufferJSON,
   useMultiFileAuthState,
   fetchLatestBaileysVersion,
   

} = require("@whiskeysockets/baileys")

const fs = require('fs')

async function connectToWhatsApp (msg='', id='') {
      const { version } = await fetchLatestBaileysVersion()
      const { state, saveCreds } = await useMultiFileAuthState('bot-auths')
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
        if(connection === 'close'){
           if((lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) !== DisconnectReason.loggedOut)
                 connectToWhatsApp(msg, id)
           else return console.log('eror tidak bisa loging')
       }else if(connection === 'open'){
//         var users = (await sock.groupMetadata(group_id)).participants.map(x => x.id).filter(x => !sock.user.id.includes(x.split('@')[0]))
         var [rs] = await sock.onWhatsApp(id)
         if(rs.exists){
            sock.sendMessage(id.jid, {text: msg}) //, mentions: users})
            sock.ev.removeAllListeners()
         }
       }
    })
}


module.exports = connectToWhatsApp