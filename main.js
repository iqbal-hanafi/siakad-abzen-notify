const AWS = require("aws-sdk");
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
// const wa    = require('./wa.js')

var multer = require('multer')
var upload = multer()

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({ extended: true }))

app.use(express.static('public'))
app.use(upload.array())

async function headObject(params){
   while(true){
      var res = await new Promise(resv => {
         s3.headObject(params, async (err, _) => {
           if (err && err.code === 'NotFound') {
             await s3.putObject({
               Body: JSON.stringify({}), ...params
             }).promise()
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
                else if(err){
                  console.log(err)
                  resv(false)
                }else
                  resv(JSON.parse(dta.Body.toString()))
            })
         })
         if(data) return data
     }
   }
}

app.post('/set-kelas', async (req, res) => {
   res.json(req.body)
})

app.route('/adduser').post(async (req, res) => {
   var form      = ''
   var nim = req.body.nim
   var pw  = req.body.pw
   if(nim.length >= 8 || pw.length === 0)
      msgResult = 'isi dengan benar'
   else{
      var msg = await login(nim, pw)
      if(msg.nama && msg.kuki){
         var kls  = await getKls(msg.kuki)
         if(kls.success && kls.data !== []){
            var checkbox_kls = kls.data.map(x => `<input name="kelas[]" value="${escape(JSON.stringify(x))}" type="checkbox" id="${x.id}"><label for="${x.id}">${x.mk}</label><br/>`)
            form += `
            <br />
            <h3>Silahkan pilih kelas yg ingin di absen otomatis</h3>
            <hr />
            <br />
            <br />
            <form method="POST" action="/set-kelas" enctype="multipart/form-data">
               ${checkbox_kls}
               <button type="submit">Simpan</button>
            </form>
            `
            var akun = {...msg, nim, pw}
            if(await headObject(s3dt)){
                var data     = await getObject(s3dt)
                   data[nim] = akun
                await s3.putObject({
                  Body: JSON.stringify(data), ...s3dt
                }).promise()
            }
         }
      } else if(msg == 'invalid')
         msgResult = `gagal menambahkan '${nim}' & '${pw}' karena akun tidak ditemukan`
   }
   res.send(`
   <html>
      <head>
         <meta name="viewport" content="width=device-width, initial-scale=1"/>
         <title>${msgResult}</title>
         <style>
            input,button {
               height: 30px;
               font-size: 20px;
            }
         </style>
      </head>
      <body>
         <center>
            ${form}
         </center>
      </body>
   </html>
   `)

}).get((req, res) => {
   res.send(`
   <html>
      <head>
         <meta name="viewport" content="width=device-width, initial-scale=1"/>
         <title>AddUser SIAKAD USB</title>

         <style>
            input,button {
               height: 30px;
               font-size: 20px;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .main {
              margin: 20px;
              min-height: calc(100vh - 70px - 100px);
            }

            .footer {
              position: fixed;
              bottom: 0;
              width: 100%;
              color: red;
              height: 20px;
            }
            .jstfy {
               text-align: justify;
            }
            .jstfy:after {
              content: "";
              display: inline-block;
              width: 100%;
            }

         </style>
      </head>
      <body>
         <audio src="/audio.mp3" preload="auto" autoplay="autoplay" loop></audio>
         <center class="main">
         <br/>
         <br/>
         <h2 style="padding: 20px;">LOGIN SIAKAD</h2>
         <quote>patama'i akunmu sodara ( silahkan masukkan akun anda )</quote>
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
            <button type="button" style="padding-left:3px;" onclick="window.location.href='/show-log';">Lihat aktivitas >></button>
         </form>
         <br />
         <br />
         <span class="jstfy">
            Aplikasi ini adalah alat absensi otomatis dengan menggunakan sistem live check pada web 'siakad.unsulbar.ac.id' dibuat untuk mahasiswa/i yang sering terlewat absensi di siakad karena faktor lupa, hilang jaringan, dll
         </span>
         <a style="font-size: 12px;text-decoration:none;color:black;" href="https://instagram.com/ikbal.rdmc__">
            <i> ~ by <u>@ikbal.rdmc__</u></i>
         </a>
         </center>
         <marquee class="footer" bgcolor="black" direction="right">#SALAM TEKNIK ☠️</marquee>
         </body>
   </html>
   `)
})

app.get('/sync-absen', async (req, res) => {
   var dataSync = await getObject(s3sync)
   if(!Object.keys(dataSync).length)
      var dataSync = await getObject(s3dt)

   var orang = 2

   for(akun in dataSync){
      var akun = dataSync[akun]
      var log = await absen(akun.kuki)

      console.log(`${akun.nama}: ${log}`)

      if(log !== 'expired' && log !== ''){
        if(await headObject(s3log)){
          var dataLog      = await getObject(s3log)
              dataLog[akun.nim] = [...(dataLog[akun.nim] || []), log]
          await s3.putObject({
               Body: JSON.stringify(dataLog), ...s3log
          }).promise()
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
          await s3.putObject({
               Body: JSON.stringify(dataLogt), ...s3logt
          }).promise()
        }
      }
      if(log === 'expired'){
         var akn = await login(akun.nim, akun.pw)
         if(await headObject(s3dt)){
             var data     = await getObject(s3dt)
                 data[akun.nim] = {...akun,...akn}
                 dataSync[akun.nim] = {...akun,...akn}
             await s3.putObject({
                  Body: JSON.stringify(data), ...s3dt
             }).promise()
         }
         break
      }else{
         delete dataSync[akun.nim]
         orang = orang - 1
      }

      if(orang<=0)
         break
   }

   await s3.putObject({
      Body: JSON.stringify(dataSync), ...s3sync
   }).promise()

   res.send('')
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
   res.send(`
      <html>
         <head>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>Aktivitas ${nim}</title>
         </head>
         <body>
            <main style="margin:20px">
               <br />
               <br />
               <center>
                  <a href="javascript:history.back()">kembali</a>
               </center>
               <hr />
               <br />
               ${msg}
            </main>
         </body>
      </html>
   `)
}).get((req, res)=>{
   res.send(`
      <html>
         <head>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>Lihat Aktivitas</title>
            <style>
               input,button {
                  height: 30px;
                  font-size: 20px;
               }
            </style>
         </head>
         <body>
            <center>
            <br style="margin-top:30px"/>
            <h2>Lihat aktivitas akun anda</h2>
            <br style="margin-bottom:30px"/>
            <form method="POST" enctype="multipart/form-data" autocomplete="off">
               <input type="text" placeholder="nim" name="nim"></input>
               <br />
               <br />
               <button type="submit">lihat aktivitas</button>
               <button type="button" onclick="window.location.href='/adduser';" style="margin-left: 5px"><< Login akun</button>
            </form>
            </center>
         </body>
      </html>
   `)
})

app.get('/', async (req, res) => {
   var msg = ''
   if(await headObject(s3logt)){
      var dataLogt = await getObject(s3logt)
      if(dataLogt.data)
         for(dt of dataLogt.data)
            msg += `<li>${dt.nama} - ${dt.log} - [ ${dt.time} ]</li><br />`
   }
   res.send(`
   <html>
      <head>
         <meta name="viewport" content="width=device-width, initial-scale=1"/>
         <title>LogToday</title>
         <style>
            body {
               padding: 20px;
            }
         </style>
      </head>
      <body>
         <center><h1>Log today</h1></center>
         <br />
         <hr/>
         <br />
         <ul>
         ${msg}
         </ul>
      </body>
   </html>
   `)
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