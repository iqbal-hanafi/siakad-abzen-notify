
process.env.TZ = 'Asia/Makassar'

const os = require('os')

const express = require('express')
const bodyParser = require('body-parser')
const app = express()

const { login, getKls, absen } = require('./absen.js')
const { deleteObject, getObject, putObject, headObject } = require('./db.js')
const { nim_admin, s3kls, s3dt, s3log, s3logt, s3sync, s3ykls } = require('./config.js')
const { s3 } = require('./db.js')

var multer = require('multer')
var upload = multer()

app.use(bodyParser.json())
app.set('views', './templates')
app.set('view engine', 'hbs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(upload.array())

app.get('/update', async (req, res) => {
   var kls = await getObject(s3kls)
   var ykls = await getObject(s3ykls)
   var ykls = {}
   for(dt in kls){
      var kl = kls[dt]
      if(dt[0]=="D"){
         for(d of Object.keys(kl.kelas)){
            if(ykls[d] == null)
               ykls[d] = []
            ykls[d].push(dt)

         }
      }
   }
   await putObject(s3ykls, ykls)
   res.json(ykls)
})

app.get('/show-data/:key', async (req, res) => {
   var key = req.params.key
   try{
      var data = await getObject(eval(`s3${key}`))
      res.json(data)
   }catch(Exception){
      res.send("kls, dt, log, logt, sync")
   }
})



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
      var ykls = await getObject(s3ykls)
      for(klas in kolas){
         if(ykls[klas] == null)
            ykls[klas] = []
         if(!ykls[klas].includes(nim))
            ykls[klas].push(nim)
      }
      for(yk in ykls){
         if(ykls[yk].includes(nim) && !(Object.keys(kolas).includes(yk)))
            ykls[yk].splice(ykls[yk].indexOf(nim))
      }

      await putObject(s3ykls, ykls)
      title = 'Selesai disimpan'
      msg   = `<div class="card-body"><img src="/img/checklist.png" style="display: block;margin-left: auto;margin-right: auto;width: 150px;"></img><br />Halo <span class="label label-secondary">${name}</span> ( ${nim} ) kelas sudah di simpan, anda bisa perbarui dengan login ulang<br /><br />${rkls}</div>`

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
      if(dataAkun[nim] && dataAkun[nim].pw === pw)
         data = dataAkun[nim]
      else
         data = await login(nim, pw)
      if(data.nama && data.kuki){
         while(true){
            var kls = await getKls(data.kuki)
            var klsb  = await getObject(s3kls)
                klsb  = ((klsb[nim] && klsb[nim].kelas) || {})
            if(kls.success && kls.data !== []){
               var checkbox_kls = kls.data.map(x => `
               <div class="form-group">
                 <label class="form-checkbox">
                   <input type="checkbox" name="kelas[]" value="${escape(JSON.stringify(x))}" id="${x.id}"${klsb[x.id] ? ' checked': ''}>
                   <i class="form-icon"></i> ${x.mk}
                 </label>
               </div>
               `).join(os.EOL)
               form = `
               <div class="card-header">
                  <div class="card-subtitle text-gray">Silahkan pilih kelas yg ingin di presensi otomatis</div>
               </div>
               <div class="card-body">
                  <form style="padding: 30px;text-align: left" method="POST" action="/set-kelas" enctype="multipart/form-data">
                     ${checkbox_kls}
                     <input type="hidden" name="nim" value="${nim}"></input>
                     <input type="hidden" name="name" value="${data.nama}"></input>
                     <button class="btn-primary btn btn-block" type="submit">Simpan Kelas</button>
                  </form>
               </div>
               `
               dataAkun[nim] = {...data, nim, pw}
               await putObject(s3dt, dataAkun)

               msgResult = `Hallo ${data.nama}`

               break
            } else if(kls.msg === 'expired')
               data = await login(nim, pw)
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
         <div class="card-header">
            <div class="card-subtitle text-gray">patama'i akunmu sodara ( silahkan masukkan akun anda )</div>
         </div>
         <div class="card-body">
            <form method="POST" enctype="multipart/form-data" autocomplete="off">
               <div class="form-group">
                  <label class="form-label" for="user">username</label>
                  <input class="form-input" type="text" name="nim" placeholder="username/nim" id="user"></input>
               </div>
               <div class="form-group">
                  <label class="form-label" for="pw">password</label>
                  <input class="form-input" type="password" name="pw" placeholder="password" id="pw"></input>
               </div>
               <button class="btn btn-primary btn-lg btn-block" type="submit">Login</button>
            </form>
         </div>
      `
   })
})

app.get('/sync-kelas', async (req, res) => {
   // cek ykls satu satu kalau ada yang terbuka nanti langsung absen semua

})


app.get('/sync-absen', async (req, res) => {
   var dataSync = await getObject(s3sync)
   if(!Object.keys(dataSync).length)
      var dataSync = await getObject(s3dt)

   var log = null
   var count = 2
   var loge = {}
   for(akun in dataSync){
      var akun = dataSync[akun]
      var kls  = await getObject(s3kls)
          kls  = kls[akun.nim]

      if(kls.kelas == {}) continue

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

          var kls   = (await getKls(akn.kuki)).data.map(x => x.id)
          var klsb  = await getObject(s3kls)
              klsx  = ((klsb[akun.nim] && klsb[akun.nim].kelas) || {})
          var new_kls = {}
          for(kl in klsx)
            if(kls.includes(kl))
               new_kls[kl] = klsx[kl].mk
          console.log(new_kls)
          klsb[akun.nim]={kelas: new_kls}
          // await putObject(s3kls, klsb)
          
          await putObject(s3dt, data)
          break
      }else
         delete dataSync[akun.nim]

      await putObject(s3logt, dataLogt)

      if(count === 0) break
      else count = count - 1
      loge[akun.nama] = log
   }

   await putObject(s3sync, dataSync)
   res.json(loge)
})

app.route('/get-log-by-nim/:nim').get(async (req, res) => {
   var nim      = req.params.nim
   var data     = ((await getObject(s3log))[nim] || [])
   var dataAkun = ((await getObject(s3dt))[nim] || [])
   if(dataAkun){
      delete dataAkun['pw']
      delete dataAkun['kuki']
   }
   res.json({
      log: data,
      akun: dataAkun
   })
})


app.route('/show-log').post(async (req, res) => {
   var title = 'Akun tidak ditemukan'
   var nim = req.body.nim
   var msg = ''
   if(nim){
      var data = ((await getObject(s3log))[nim] || [])
      if(data.length !== 0){
         var datas = {}
         for(dt in data){
            dt = data[dt]
            var day = ''
            var jam = ''
            if(dt.waktu){
               var waktu = dt.waktu.split(', ')
               day = waktu[0]
               jam = waktu[1]
            }
            if(!datas[day])
               datas[day]=''
            datas[day] += `
               <p class="tile-title"><span class="label label-secondary">${jam}</span> ${dt.mk} - ${dt.msg}</p>
            `
         }
         var i = 0
         for(dt in datas){
            msg += `<div class="timeline-item">
                       <div class="timeline-left">
                           <a class="timeline-icon${i!=0 ? ' icon-lg' : ''}" data-tooltip="${dt}">
                              ${i != 0 ? '<i class="icon icon-check"></i>' : ''}
                           </a>
                       </div>
                       <div class="timeline-content">
                         <div class="tile">
                           <div class="tile-content">
                             <p class="tile-subtitle">${dt}</p>
                             ${datas[dt]}
                           </div>
                         </div>
                       </div>
                    </div>`
            i++
         }
         msg = `<div class="card-body">
                  <div class="timeline">
                     ${msg}
                  </div>
                </div>`
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
      <div class="card-body">
         <form method="POST" enctype="multipart/form-data" autocomplete="off">
            <div class="form-group">
               <label class="form-label" for="nim">NIM</label>
               <input class="form-input" id="nim" type="text" placeholder="nim" name="nim"></input>
            </div>
            <button class="btn btn-primary btn-block" type="submit">lihat aktivitas</button>
         </form>
     </div>`})
})

app.get('/', async (req, res) => {

   var msg = ''
   var dataLogt = await getObject(s3logt)
   var nextAbsen = await getObject(s3sync)
   var date = (new Date()).toLocaleString('id-ID', {dateStyle:'full'})
   if(dataLogt.data)
      msg += `<div class="card-body"><p>presensi otomatis ${date}</p><table class="table table-striped table-scroll">
      <thead>
      <tr>
         <th>Nama</th>
         <th>Mata Kuliah</th>
         <th>Informasi</th>
         <th>Waktu</th>
      </tr>
      </thead>
      <tbody>
      `
      for(dt of dataLogt.data)
         for(dtt of dt.log)
            msg += `<tr>
               <td><span class="text-small label label-success">${dt.nama}</span></td>
               <td>${dtt.mk}</td>
               <td>${dtt.msg}</td>
               <td>${dt.time}</td>
            </tr>`
      msg += `</tbody></table></div>`

   var data = await getObject(s3dt)
   var prodis = {'Lainnya':[]}
   for(dt in data){
      dt = data[dt]
      if(dt.prodi && !prodis[dt.prodi])
          prodis[dt.prodi]=[]
      prodis[dt.prodi || 'Lainnya'].push(dt)
   }
   msg += '</div>'

      // check live
   var xmsg = `<div style="padding-top:20;padding-bottom:20;margin-top: 40;margin-bottom:40;background-color: white" class="px-2"><h5 class="text-center m-2 text-primary">Absen Checker</h5><p class="px-2 mx-2">Setiap 5 menit akan dilakukan pengecekan kelas tiap user di bawah untuk absesnsi otomatis dan repeat</p><div class="timeline">`
   var akon = []
   for(akn in nextAbsen){
      akn = nextAbsen[akn]
      akon.push(akn)
      if(akon.length > 3)
         break
   }

   var j1 = akon.slice(0,2)
   var j2 = akon.slice(2,4)

   var i = (5-((new Date()).getMinutes() % 5))

   for(akn of [j1, j2]){
      if(akn == [])
         break
      xmsg += `
      <div class="timeline-item" id="timeline-${akn}">
       <div class="timeline-left">
         <a class="timeline-icon icon-lg" href="#timeline-${akn}">
           <i class="icon icon-time"></i>
         </a>
       </div>
       <div class="timeline-content">
         <div class="tile">
            <div class="tile-content">
              <p class="tile-subtitle">${i} menit kedepan</p>
              ${akn.map(x => '<p class="tile-title">'+x.nama+' <span class="label label-primary text-small">'+x.prodi+'</span></p>').join('\n')}
            </div>
          </div>
       </div>
     </div>
      `
      i += 5
   }
   xmsg += '</p></div></div>'
   if(Object.keys(nextAbsen).length > 2)
      msg += xmsg

   if(prodis){
      msg += `<div class="p-2 m-2"><h5 class="text-center">Daftar Pengguna</h5>`
      for(prodi in prodis){
         if (!prodis[prodi].length) continue
         msg += `
                  <div class="accordion">
                     <input id="accordion-${prodi}" type="radio" name="accordion-radio" hidden="">
                     <label class="accordion-header c-hand" for="accordion-${prodi}"><i class="icon icon-arrow-right mr-1"></i><span class="badge" data-badge="${prodis[prodi].length}">${prodi}</span></label>
                     <div class="accordion-body">
                        <ul class="menu menu-nav">`
               for(dt of prodis[prodi])
                  msg += `
                     <li class="menu-item text-small">${dt.nama} <span class="label label-secondary label-rounded">${dt.nim.slice(0,5)}***</span></li>
                  `
         msg += `</ul>
            </div>
         </div>`
      }
   }

   res.render('main', {
      title:'Riwayat Hari ini',
      html: msg
   })
})


app.get('/about', (req, res) => {
   res.render('main', {
      title: 'Bot Siakad',
      html: `<span style="text-align: center">
        <div class="card-image">
         <!---<img src="https://scontent.cdninstagram.com/v/t51.2885-15/248444045_620208956055681_81260960514199161_n.jpg?stp=dst-jpg_e35&_nc_ht=scontent.cdninstagram.com&_nc_cat=109&_nc_ohc=0KSrCT_R2vcAX9DRWr4&edm=APs17CUBAAAA&ccb=7-5&ig_cache_key=MjY5MzY3NzY4ODYxNDI1MDY2NA%3D%3D.2-ccb7-5&oh=00_AfCOMd9MbtTyP8MGl0HkrF952u2a8qlbZXJJbwVSAnBuMw&oe=65572D3B&_nc_sid=10d13b" class="img-responsive">--->
         <img src="img/logobs.png" class="img-responsive">
        </div>
        <div class="card-header">
          <div class="card-subtitle">Aplikasi ini adalah alat presensi otomatis dengan menggunakan sistem live check pada web <mark>siakad.unsulbar.ac.id</mark> dibuat untuk mahasiswa/i yang sering terlewat presensi di siakad karena faktor lupa, hilang jaringan, dll</div>
        </div>
        <div class="card-footer">
          <a href="https://www.instagram.com/ikbal.rdmc__">
            <i>~ by Muh Iqbal Hanafi</i>
          </a>
        </div>
      </span>`
   })
})

app.listen(process.env.PORT || 3000, async () => {
  console.log(`Example app listening http://127.0.0.1:${(process.env.PORT || 3000)}`)
})