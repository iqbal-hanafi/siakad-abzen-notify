const AWS = require('aws-sdk')
const s3 = new AWS.S3()

const Bucket = 'cyclic-cooperative-flannel-shirt-eu-west-3'
const s3dt = {
   Key: 'akun-ente',
   Bucket
}

const s3log = {
   Key: 'log',
   Bucket
}

const s3sync = {
   Key: 'next-user',
   Bucket
}

const s3logt = {
   Key: 'loga-today',
   Bucket
}

const s3kls = {
   Key: 'kelas',
   Bucket
}


const express = require('express')
const bodyParser = require('body-parser')
const app     = express()

const { login, getKls, absen } = require('./absen.js')
const wa    = require('./wa.js')

var multer = require('multer')
var upload = multer()

app.use(bodyParser.json())
app.set('views', './templates')
app.set('view engine', 'hbs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(upload.array())

async function putObject(params, body){
   return s3.putObject({
      Body: JSON.stringify(body), ...params
   }).promise()
}

async function headObject(params){
   while(true){
      var res = await new Promise(resv => {
         s3.headObject(params, async (err, _) => {
           if (err && err.code === 'NotFound') {
             await putObject(params, {})
             resv(false)
           }
           else if (err)
             resv(false)
           else
             resv(true)
         })
      })
      if(res) return res
   }
}

async function getObject(params){
   if(await headObject(params)){
      while(true){
         var data = await new Promise(resv => {
            s3.getObject(params, async (err, dta) => {
                if(err && err.code === 'NotFound')
                  resv(false)
                else if(err)
                  resv(false)
                else
                  resv(JSON.parse(dta.Body.toString()))
            })
         })
         if(data) return data
     }
   }
}

app.post('/set-kelas', async (req, res) => {
   var kelas = req.body.kelas
   var nim   = req.body.nim
   var name  = req.body.name
   var kolas = {}
   var title = ''
   var msg   = ''
   if(kelas.length !== 0){
      for(dt of kelas.map(x => JSON.parse(unescape(x))))
         kolas[dt.id] = dt.mk
      if(await headObject(s3kls)){
         var kls = await getObject(s3kls)
             kls[nim]={kelas: kolas}
         await putObject(s3kls,kls)
         title = 'Selesai disimpan'
         msg   = `akun ${name}:${nim} selesai di simpan`
      }
   }
   res.render('main', {
      title,
      html:msg
   })
})

app.route('/adduser').post(async (req, res) => {
   var form      = ''
   var msgResult = ''
   var nim = (req.body.nim || '')
   var pw  = (req.body.pw || '')
   if(!nim.length  && !pw.length)
      msgResult = 'isi dengan benar'
   else {
      if(await headObject(s3dt)){
         var dataAkun = await getObject(s3dt)
         var data     = {}
         if(dataAkun[nim])
            data = dataAkun[nim]
         else
            data = await login(nim, pw)
         if(data.nama && data.kuki){
            var kls  = await getKls(data.kuki)
            if(kls.success && kls.data !== []){
               var checkbox_kls = kls.data.map(x => `<label><input name="kelas[]" value="${escape(JSON.stringify(x))}" type="checkbox" id="${x.id}">${x.mk}</label>`).join('\n')
               form = `
               Silahkan pilih kelas yg ingin di absen otomatis
               <br />
               <br />
               <form style="padding: 30px;text-align: left" method="POST" action="/set-kelas" enctype="multipart/form-data">
                  ${checkbox_kls}
                  <input type="hidden" name="nim" value="${nim}"></input>
                  <input type="hidden" name="name" value="${data.nama}"></input>
                  <br />
                  <br />
                  <br />
                  <button type="submit">Simpan</button>
               </form>
               <br />
               `
               dataAkun[nim] = {...data, nim, pw}
               await putObject(s3dt, dataAkun)
               msgResult = `Hallo ${data.nama}`
            }
         } else if(msg == 'invalid')
            msgResult = `gagal menambahkan '${nim}' & '${pw}' karena akun tidak ditemukan`
      }
   }
   res.render('main', {
      title:msgResult,
      html:form
   })
}).get((req, res) => {
   res.render('main', {
      title:'Login Siakad',
      html:`
         <quote>patama'i akunmu sodara ( silahkan masukkan akun anda )</quote>
         <form method="POST" enctype="multipart/form-data" autocomplete="off">
            <input type="text" name="nim" placeholder="username/nim"></input>
            <br />
            <br />
            <input type="password" name="pw" placeholder="password"></input>
            <br />
            <br />
            <button type="submit">Login</button>
            <button type="button" style="padding-left:3px;" onclick="window.location.href='/show-log';">Lihat aktivitas >></button>
         </form>
      `
   })
})

app.get('/sync-absen', async (req, res) => {
   var dataSync = await getObject(s3sync)
   if(!Object.keys(dataSync).length)
      var dataSync = await getObject(s3dt)

   var log = null

   for(akun in dataSync){
      var akun = dataSync[akun]
      var kls  = await getObject(s3kls)[akun.nim]
      log = await absen(akun.kuki, kls)

      console.log(`${akun.nama}: ${log}`)

      if(log !== 'expired' && log !== ''){
        if(await headObject(s3log)){
          var dataLog      = await getObject(s3log)
              dataLog[akun.nim] = [...(dataLog[akun.nim] || []), log]
          await putObject(s3log, dataLog)
        }
        if(await headObject(s3logt)){
          var dataLogt = await getObject(s3logt)
          var tNow     = (new Date())
          if(dataLogt.time !== tNow.getDate()){
            dataLogt.data = []
            dataLogt.time = tNow.getDate()
          }
          dataLogt.data.push({
            nama: akun.nama,
            log:  log,
            time: `${tNow.getHours()}:${tNow.getMinutes()}:${tNow.getSeconds()}`
          })
          await putObject(s3logt, dataLogt)
        }
      }
      if(log === 'expired'){
         var akn = await login(akun.nim, akun.pw)
         if(await headObject(s3dt)){
             var data     = await getObject(s3dt)
                 data[akun.nim] = {...akun,...akn}
                 dataSync[akun.nim] = {...akun,...akn}
             await putObject(s3dt, data)
         }
      }else
         delete dataSync[akun.nim]
      break
   }

   await putObject(s3sync, dataSync)

   res.json(log)
})



app.route('/show-log').post(async (req, res) => {
   var msg = 'akun tidak ditemukan'
   var nim = req.body.nim
   if(nim){
      var data = (await getObject(s3log))[nim]
      if(data)
         msg = data.join('<br />')
      else
         msg = 'aktivitas belum ada'
   }
   res.render('main', {
      title:msg,
      html:msg
   })
}).get((req, res)=>{
   res.render('main', {
      title:'lihat aktivitas akun anda',
      html:`
      <form method="POST" enctype="multipart/form-data" autocomplete="off">
         <input type="text" placeholder="nim" name="nim"></input>
         <br />
         <br />
         <button type="submit">lihat aktivitas</button>
         <button type="button" onclick="window.location.href='/adduser';" style="margin-left: 5px"><< Login akun</button>
      </form>`})
})

app.get('/', async (req, res) => {
   var msg = ''
   if(await headObject(s3logt)){
      var dataLogt = await getObject(s3logt)
      if(dataLogt.data)
         for(dt of dataLogt.data)
            msg += `<li>${dt.nama} - ${dt.log} - [ ${dt.time} ]</li><br />`
   }
   res.render('main', {
      title:'Riwayat Hari ini',
      html:msg
   })
})


app.get('/show-user', async (req, res) => {
   if(await headObject(s3dt)){
      var data = await getObject(s3dt)
      res.json(data)
   }
   res.send('')
})

app.get('/cekabsen/:nim/:pw', async (req, res) => {
  var nim  = req.params.nim
  var pw   = req.params.pw
  var akun = await login(nim, pw)
  var msg  = ''
  if(akun.kuki)
     msg = await absen(akun.kuki)
  return res.send(msg)
})

app.listen(process.env.PORT || 3000, async () => {
  console.log(`Example app listening http://127.0.0.1:3000`)
})