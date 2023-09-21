
var request = require('request')

const Jimp = require('jimp')
const { parse } = require('node-html-parser')
const UA   = 'Mozilla/5.0' // (X11; U; Linux i686; es-VE;  rv:1.9.0.1)Gecko/2008071615 Debian/6.0 Firefox/9'
const URL  = 'https://siakad.unsulbar.ac.id'
var apiKey = [
   'K87191403588957',
   'K81070060988957',
   'K81942015488957',
   'donotstealthiskey8589'
]

var key = apiKey.pop()

async function getKls(kuki){
   var absenreq = request.defaults({
      headers: {
         'User-Agent': UA,
         'Cookie': kuki
      }
   })
   return await new Promise((resv)=>{
      absenreq.get(`${URL}/mahasiswa/jadwal`, async (e,r,b)=>{
         var msgD = {
            success: null,
            eror: null,
            data: [],
            msg: null
         }
         if(!b.includes('Logout')){
            msgD.eror = true
            msgD.msg  = 'expired'
         } else {
            for(id of parse(b).querySelectorAll('[data-id*="unsulbar"]')){
               id = id.getAttribute('data-id')
               mk = await new Promise((resv1)=>{
                  absenreq.post(`${URL}/mahasiswa/jadwal/presensi`,(e,r,b)=>{
                     return resv1((b.match(/(?<=Matakuliah\s\:)(?:[\w\s]+)/)[0] || '').trim())
                  }).form({kls_id: id})
               })
               msgD.data.push({id,mk})
            }
            msgD.success = (msgD.data !== [])
         }
         return resv(msgD)
      })
   })
}

async function absen(kuki, mkL){
   var absenreq = request.defaults({
      headers: {
         'User-Agent': UA,
         'Cookie': kuki
      }
   })
   return await new Promise((resv)=>{
      absenreq.get(`${URL}/mahasiswa/jadwal`, async (e,r,b)=>{
         var msgD = {
            success: null,
            eror: null,
            data: [],
            msg: null
         }
         if(!b.includes('Logout')){
            msgD.eror = true
            msgD.msg = 'expired'
         } else {
            for(id of parse(b).querySelectorAll('[data-id*="unsulbar"]')){
               id = id.getAttribute('data-id')
               rs = await new Promise((resv, rej)=>{
                  absenreq.post(`${URL}/mahasiswa/jadwal/presensi`,(e,r,b)=>{
                     var mk = (b.match(/(?<=Matakuliah\s\:)(?:[\w\s]+)/)[0]).trim()
                     // filter
                     if(mkL[id] === mk){
                        var msg = b.match(/(?<=\<br\/\>)((Pre|Per)[A-Za-z\:\s0-9]+)/)[0]
                        if (b.toLowerCase().includes('tandai kehadiran')){
                           // notif absen dibuka
                           var setabsen = parse(b).querySelector('form')
                           var acturl = setabsen.getAttribute('action')
                           var data = {};
                           for(inp of setabsen.querySelectorAll('input'))
                              data[
                                  inp.getAttribute('name')
                              ] = inp.getAttribute('value')
                           absenreq.post(acturl,(e,r,b) => {
                              console.log(b)
                           }).form(data)
                           resv({mk, msg})
                        }
                     }
                     resv({})
                  }).form({kls_id: id})
               })
               if(rs)
                  msgD.data.push(rs)
            }
            msgD.success = (msgD.data !== [])
         }
         return resv(msgD)
      })
   })
}


async function login(usr, pwd){
   var jar    = request.jar()
   var logreq = request.defaults({
      jar : jar,
      headers: {
         'User-Agent': UA
      }
   })
   while (true) {
     var resl = await new Promise((resv) => {
         logreq.get(`${URL}/login`, (err, res, body) => {
            if(body.includes('/logout')){
               jar._jar.store.getAllCookies(function(err, cookieArray) {
                  return resv({
                     nama: body.match(/(?<=class\="d-sm-none\sd-lg-inline-block"\>)([.\w\s]+)(?=\s)/)[0],
                     kuki: cookieArray.toString()
                  })
               })
               return
            }
            if(body.toLowerCase().includes('invalid password or username'))
               return resv('invalid')
            var root = parse(body)
            var form = root.querySelector('form[action*="login/act"]');
            var data = {};
            for(inp of form.querySelectorAll('input'))
               data[
                   inp.getAttribute('name')
               ] = inp.getAttribute('value')

            var imgChp = root.querySelector('img[id="Imageid"]').getAttribute('src')
            Jimp.read(imgChp, (err, image) => {
               if(!image)
                  return resv('continue')
               var w = image.bitmap.width
               var h = image.bitmap.height
               for(y=0; y<h; y++){
                  for(x=0; x<w; x++){
                     var rgb = Jimp.intToRGBA(image.getPixelColor(x,y))
                     rgb = [rgb.r, rgb.g, rgb.b, rgb.a]
                     if (rgb[0] > 100)
                        rgb = [255, 255, 255, 255]
                     image.setPixelColor(Jimp.rgbaToInt(...rgb),x,y)
                  }
               }
               image.greyscale()
               image.contrast(1)
               image.getBase64Async(Jimp.MIME_PNG)
               .then((b64img) => {
                  logreq.post('https://api.ocr.space/parse/image', {headers: {
                     apikey: key
                  }},(er, res, body)=>{
                     if(!body)
                        return resv('continue')
                     if(body.includes('number of times within 3600 seconds'))
                        key = apiKey.pop()
                     var chpta = JSON.parse(body).ParsedResults
                         chpta = chpta ? (chpta[0].ParsedText || '').trim().replace(' ','') : ''
                     if(chpta.length !== 8)
                        return resv('continue')
                     data['user']=usr
                     data['pwd']=pwd
                     data['captcha']=chpta
                     logreq.post(form.getAttribute('action'),(e, r, b) => {
                        return resv('continue')
                     }).form(data)
                  }).form({
                     base64Image: b64img
                  })
               })
            })
         })
      })

      if (resl === 'invalid' || resl !== 'continue')
         return resl
   }
}

module.exports = {login,absen,getKls}