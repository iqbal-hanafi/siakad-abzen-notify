
var request = require('request')


const Jimp = require('jimp')
const {parse} = require('node-html-parser')
const j = request.jar();
request = request.defaults({
   jar : j,
   headers: {
      'User-Agent': 'Mozilla/5.0 (X11; U; Linux i686; es-VE;  rv:1.9.0.1)Gecko/2008071615 Debian/6.0 Firefox/9'
   }
})

async function login(usr, pwd){
   const URL = 'https://siakad.unsulbar.ac.id'
   while (true) {
     var resl = await new Promise((resv) => {
         request.get(`${URL}/login`, (err, res, body) => {
            if(body.includes('/logout'))
               return resv(body)
            if(body.toLowerCase().includes('invalid password or username'))
               return resv('invalid')
            var root = parse(body)
            var form = root.querySelector('form[action*="login/act"]');
            var data = {};
            for(inp of form.querySelectorAll('input'))
               data[
                   inp.getAttribute('name')
               ] = inp.getAttribute('value')

            var imgChp = root.querySelector('img[id="Imageid"]').getAttribute('src');
            Jimp.read(imgChp, (err, image) => {
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
                  request.post('https://api.ocr.space/parse/image', {headers: {
                     apikey: 'donotstealthiskey8589',
                  }},(er, res, body)=>{
                     var chpta = JSON.parse(body).ParsedResults[0].ParsedText.trim().replace(' ','')
                     if(chpta.length !== 8)
                        return resv(false)
                     data['user']=usr
                     data['pwd']=pwd
                     data['captcha']=chpta
                     request.post(form.getAttribute('action'), (e, r, b)=>{
                        if(b.includes('/logout'))
                           return resv(b)
                        else return resv(false)
                     }).form(data)
                  }).form({
                     base64Image: b64img
                  })
               })
            })
         })
      })
      if (resl === 'invalid')
         return resl
      if (resl !== false){
         return await new Promise((resv)=>{
            request.get(`${URL}/mahasiswa/jadwal`, async (e,r,b)=>{
               var msg = '';
               for(id of parse(b).querySelectorAll('[data-id*="unsulbar"]')){
                  id = id.getAttribute('data-id')
                  msg += await new Promise((resv)=>{
                     request.post(`${URL}/mahasiswa/jadwal/presensi`,(e,r,b)=>{
                        var mk = b.match(/(?<=Matakuliah\s\:)(?:[\w\s]+)/)[0]
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
                           request.post(acturl,(e,r,b) => {
                              console.log(b)
                           }).form(data)
                           return resv(`${mk} ${msg}\n`)
                        }
                        return resv('')
                     }).form({kls_id: id})
                  })
               }
               return resv(msg)
            })
         })
      }
   }
}

module.exports = login