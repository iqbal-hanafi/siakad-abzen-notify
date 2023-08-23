const express = require('express')
const app     = express()

const login = require('./absen.js')
const wa    = require('./wa.js')


// this only for unsulbar student `siakad.unsulbar.ac.id`
app.get('/cekabsen/:nim/:pw', async (req, res) => {
  var nim = req.params.nim // nim
  var pw = req.params.pw // password
  var gcid = '6285341748143-1633925671@g.us' // change
  var msg = await login(nim, pw)
  if(msg === 'invalid')
    return res.send('invalid password atau username')
  if(msg !== ''){
    msg = `silahkan absen\n*${msg}*`
    await wa(msg, gcid)
  }
  return res.send(msg)
})


app.listen(process.env.PORT || 3000, () => {
  console.log(`Example app listening`)
})