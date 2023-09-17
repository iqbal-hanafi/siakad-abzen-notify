const AWS = require("aws-sdk");
const s3 = new AWS.S3()

const s3dt = {
   Bucket: 'cyclic-cooperative-flannel-shirt-eu-west-3',
   Key: 'akun-ente'
}

const s3log = {
   Bucket: 'cyclic-cooperative-flannel-shirt-eu-west-3',
   Key: 'log'
}

const express = require('express')
const bodyParser = require('body-parser')
const app     = express()

const { login, absen } = require('./absen.js')
// const wa    = require('./wa.js')

var multer = require('multer')
var upload = multer()

app.set('view engine', 'pug')
app.set('views', './views')

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({ extended: true }))

app.use(upload.array())
app.use(express.static('public'))

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
   await headObject(params)
   while(true){
      var data = await new Promise(resv => {
         s3.getObject(params, async (err, dta) => {
             console.log([err, dta])
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

app.route('/adduser').post(async (req, res) => {
   var msgResult = ''
   var nim = req.body.nim
   var pw  = req.body.pw
   var msg = await login(nim, pw)
   if(msg.nama && msg.kuki){
      msgResult = `akun ${msg.nama} absen otomatis aktif`
      var akun = {...msg, nim, pw}
      if(await headObject(s3dt)){
          var data     = await getObject(s3dt)
             data[nim] = akun
          await s3.putObject({
            Body: JSON.stringify(data), ...s3dt
          }).promise()
      }
   } else if(msg == 'invalid')
      msgResult = `gagal menambahkan '${nim}' & '${pw}'`
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
            <h2 style="padding: 30px;">${msgResult}</h2>
            <a href="javascript:history.back()">KEMBALI</a>
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
         <center class="main">
         <br/>
         <br/>
         <h2 style="padding: 20px;">LOGIN SIAKAD</h2>
         <quote>patama'i akunmu sodara ( silahkan masukkan akun anda )</quote>
         <br />
         <br />
         <form method="POST" enctype="multipart/form-data">
            <input type="text" name="nim" placeholder="username/nim" autocomplete="off"></input>
            <br />
            <br />
            <input type="text" name="pw" placeholder="password" autocomplete="off"></input>
            <br />
            <br />
            <button type="submit">Login</button>
            <button type="button" style="padding-left:10px" onclick="window.location.href='/show-log';">Lihat aktivitas</button>
         </form>
         <br />
         <br />
         <span class="jstfy">
            Aplikasi ini adalah alat untuk absen otomatis di siakad dengan menggunakan sistem live check pada web 'siakad.unsulbar.ac.id' dibuat untuk anda yang sering terlewat absen siakad dengan beberapa faktor lupa, hilang jaringan dll
         </span>
         <a style="font-size: 12px;text-decoration:none;color:black;" href="https://instagram.com/ikbal.rdmc__">
            <i> ~ by <u>@ikbal.rdmc__</u></i>
         </a>
         </center>
         <marquee class="footer" bgcolor="black" direction="right">#SALAM TEKNIK ☠️</marquee>
         <audio controls autoplay style="display:none;">
           <source src="audio.mp3" type="audio/mpeg">
         </audio>
         </body>
   </html>
   `)
})

app.get('/sync-absen', async (req, res) => {
   var data = await getObject(s3dt)
   if(data)
      for(akun in data){
         console.log(data)
         var log = await absen(data[akun].kuki)
         if(log)
           if(await headObject(s3log)){
             var data      = await getObject(s3log)
                 data[nim] = [...(data[nim] || []),log]
             await s3.putObject({
                  Body: JSON.stringify(data), ...s3log
             }).promise()
           }
      }
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
            <form method="POST" enctype="multipart/form-data">
               <input type="text" autocomplete="off" placeholder="nim" name="nim"></input>
               <br />
               <br />
               <button type="submit">lihat aktivitas</button>
               <button type="button" onclick="window.location.href='/adduser';" style="margin-left: 20px">Login akun</button>
            </form>
            </center>
         </body>
      </html>
   `)
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