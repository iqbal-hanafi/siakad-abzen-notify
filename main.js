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
      var rkls = '<ul>'
      for(dt of kelas.map(x => JSON.parse(unescape(x)))){
         rkls += `<li>${dt.mk}</li>`
         kolas[dt.id] = dt.mk
      }
      rkls += '</ul>'
      if(await headObject(s3kls)){
         var kls = await getObject(s3kls)
             kls[nim]={kelas: kolas}
         await putObject(s3kls,kls)
         title = 'Selesai disimpan'
         msg   = `<img src="/img/checklist.png" style="display: block;margin-left: auto;margin-right: auto;;width: 150px;"></img><br />Halo <b>${name}</b> ( ${nim} ) kelas sudah di simpan, anda bisa perbarui dengan login ulang<br /><br />${rkls}`
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
         if(dataAkun[nim] && dataAkun[nim].pw == pw)
            data = dataAkun[nim]
         else
            data = await login(nim, pw)
         if(data.nama && data.kuki){
            while(true){
               var kls = await getKls(data.kuki)
               var klsb  = await getObject(s3kls)
                   klsb  = ((klsb[nim] && klsb[nim].kelas) || {})

               if(kls.success && kls.data !== []){
                  var checkbox_kls = kls.data.map(x => `<label><input name="kelas[]" value="${escape(JSON.stringify(x))}" type="checkbox" id="${x.id}"${(' checked' ? klsb[x.id] : '')}>${x.mk}</label>`).join('\n')
                  console.log(checkbox_kls)
                  form = `
                  Silahkan pilih kelas yg ingin di presensi otomatis
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

                  break
               } else if(kls.msg === 'expired') {
                  data = await login(nim, pw)
               }
            }
         } else if(data.msg == 'invalid')
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
         <br />
         <br />
         <br />
         <form method="POST" enctype="multipart/form-data" autocomplete="off">
            <input type="text" name="nim" placeholder="username/nim"></input>
            <br />
            <br />
            <input type="password" name="pw" placeholder="password"></input>
            <br />
            <br />
            <button type="submit">Login</button>
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
      var kls  = await getObject(s3kls)
          kls  = kls[akun.nim]
      if(!kls) continue
      var log = await absen(akun.kuki, kls.kelas)

      console.log(`${akun.nama}: ${log.msg}`)

      if(log.msg !== 'expired' && log.eror){
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
            log:  log.data,
            time: `${tNow.getHours()}:${tNow.getMinutes()}:${tNow.getSeconds()}`
          })
          await putObject(s3logt, dataLogt)
        }
      }
      if(log.msg === 'expired'){
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
   var title = 'Akun tidak ditemukan'
   var nim = req.body.nim
   var msg = ''
   if(nim){
      var data = ((await getObject(s3log))[nim] || [])
      if(Object.keys(data).length !== 0){
         msg = data.map(x => `<li>${x.mk}: ${x.msg}</li>`).join('\n')
         msg = `<ul>${msg}</ul>`
         title = `Aktivitas Anda`
      }else
         title = 'Aktivitas belum ada'
   }
   res.render('main', {
      title,
      html:msg
   })
}).get((req, res)=>{
   res.render('main', {
      title:'Lihat Aktivitas Anda',
      html:`
      <form method="POST" enctype="multipart/form-data" autocomplete="off">
         <input type="text" placeholder="nim" name="nim"></input>
         <br />
         <br />
         <button type="submit">lihat aktivitas</button>
      </form>`})
})

app.get('/', async (req, res) => {
   var msg = ''
   if(await headObject(s3logt)){
      var dataLogt = await getObject(s3logt)
      if(dataLogt.data)
         for(dt of dataLogt.data)
            msg += `<li>${dt.nama} - ${dt.log.mk}:${dt.log.msg} - (${dt.time})</li>`
   }
   if(await headObject(s3dt)){
      var data = await getObject(s3dt)
      if(Object.keys(data).length)
         msg += '<hr/><br /><h2>Daftar Pengguna</h2><br/><ul>'
         for(dt in data){
            dt = data[dt]
            msg += `<li>${dt.nama} (${dt.nim.slice(0,5)}***)</li>`
         }
         msg += '</ul>'
   }

   res.render('main', {
      title:'Riwayat Hari ini',
      html:msg
   })
})


app.get('/about', (req, res) => {
   res.render('main', {
      title: 'About',
      html: `<span style="text-align: center">
         Aplikasi ini adalah alat presensi otomatis dengan menggunakan sistem live check pada web 'siakad.unsulbar.ac.id' dibuat untuk mahasiswa/i yang sering terlewat presensi di siakad karena faktor lupa, hilang jaringan, dll
         <a style="font-size: 12px;text-decoration:none;color:black;" href="https://instagram.com/ikbal.rdmc__">
            <i> ~ by <u>@ikbal.rdmc__</u></i>
         </a>
      </span>`
   })
})

app.listen(process.env.PORT || 3000, async () => {
  console.log(`Example app listening http://127.0.0.1:3000`)
})