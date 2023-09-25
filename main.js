process.env.TZ = 'Asia/Makassar'

const os = require('os')

const express = require('express')
const bodyParser = require('body-parser')
const app = express()

const { login, getKls, absen } = require('./absen.js')
const { deleteObject, getObject, putObject, headObject } = require('./db.js')
const { nim_admin, s3kls, s3dt, s3log, s3logt, s3sync } = require('./config.js')
const { s3 } = require('./db.js')

var multer = require('multer')
var upload = multer()

app.use(bodyParser.json())
app.set('views', './templates')
app.set('view engine', 'hbs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(upload.array())

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
      var kls = await getObject(s3kls)
          kls[nim]={kelas: kolas}
      await putObject(s3kls,kls)
      title = 'Selesai disimpan'
      msg   = `<img src="/img/checklist.png" style="display: block;margin-left: auto;margin-right: auto;width: 150px;"></img><br />Halo <b>${name}</b> ( ${nim} ) kelas sudah di simpan, anda bisa perbarui dengan login ulang<br /><br />${rkls}`

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
               var checkbox_kls = kls.data.map(x => `<label><input name="kelas[]" value="${escape(JSON.stringify(x))}" type="checkbox" id="${x.id}"${klsb[x.id] ? ' checked': ''}>${x.mk}</label>`).join(os.EOL)
               form = `
               Silahkan pilih kelas yg ingin di presensi otomatis
               <br />
               <form style="padding: 30px;text-align: left" method="POST" action="/set-kelas" enctype="multipart/form-data">
                  ${checkbox_kls}
                  <input type="hidden" name="nim" value="${nim}"></input>
                  <input type="hidden" name="name" value="${data.nama}"></input>
                  <br />
                  <br />
                  <button type="submit">Simpan Kelas</button>
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
      } else if(data == 'invalid')
         msgResult = `gagal menambahkan '${nim}' & '${pw}' karena akun tidak ditemukan`
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
   var count = 2

   for(akun in dataSync){
      var akun = dataSync[akun]
      var kls  = await getObject(s3kls)
          kls  = kls[akun.nim]
      if(!kls) continue

      log = await absen(akun.kuki, kls.kelas)

      console.log(`${akun.nama}: ${log.msg}`)
      var dataLogt = await getObject(s3logt)
      var tNow     = (new Date())
      if(dataLogt.time !== tNow.getDate()){
         dataLogt.data = []
         dataLogt.time = tNow.getDate()
      }
      if(log.msg === 'melakukan presensi otomatis'){
       var dataLog = await getObject(s3log)
           dataLog[akun.nim] = [...(dataLog[akun.nim] || []), ...log.data]
       await putObject(s3log, dataLog)
       dataLogt.data.push({
         nama: akun.nama,
         log:  log.data,
         time: `${tNow.getHours()}:${tNow.getMinutes()}:${tNow.getSeconds()}`
       })
      }

      if(log.msg === 'expired'){
          var akn = await login(akun.nim, akun.pw)
          var data = await getObject(s3dt)
              data[akun.nim] = {...akun,...akn}
              dataSync[akun.nim] = {...akun,...akn}
          await putObject(s3dt, data)
          break
      }else
         delete dataSync[akun.nim]

      await putObject(s3logt, dataLogt)

      if(count === 0) break
      else count = count - 1
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
      if(data.length !== 0){
         msg = data.map(x => `<tr>
                 <td>${x.mk}</td>
                 <td>${x.msg}</td>
                 <td>${x.waktu}</td>
         </tr>`).join(os.EOL)
         msg = `<br/><table>
                  <thead>
                     <tr>
                        <th>Matkul</th>
                        <th>Informasi</th>
                        <th>Waktu</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${msg}
                  </tbody>
                </table>`
         title = `Aktivitas Anda (${nim})`
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
   var dataLogt = await getObject(s3logt)
   var date = (new Date()).toLocaleString('id-ID', {dateStyle:'full'})
   if(dataLogt.data)
      msg += `<span>Riwayat presensi otomatis ${date}</span><br/><br/><br/><table style="margin: 10px;">
      <thead>
      <tr>
         <th>Nama</th>
         <th>Matkul</th>
         <th>Informasi</th>
         <th>Waktu</th>
      </tr>
      </thead>
      <tbody>
      `
      for(dt of dataLogt.data)
         for(dtt of dt.log)
            msg += `<tr>
               <td>${dt.nama}</td>
               <td>${dtt.mk}</td>
               <td>${dtt.msg}</td>
               <td>${dt.time}</td>
            </tr>`
      msg += `</tbody></table><br/>`
   var data = await getObject(s3dt)
   if(Object.keys(data).length)
      msg += '<br /><h2>Daftar Pengguna</h2><br/><ul>'
      for(dt in data){
         dt = data[dt]
         msg += `<li>${dt.nama} (${dt.nim.slice(0,5)}***)</li>`
      }
      msg += '</ul>'

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
  console.log(`Example app listening http://127.0.0.1:${(process.env.PORT || 3000)}`)
})