const AWS = require('aws-sdk')
const s3 = new AWS.S3()

async function deleteObject(params){
   return await s3.deleteObject(params).promise()
}

async function putObject(params, body){
   return await s3.putObject({
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


module.exports = {
   getObject, headObject, putObject, deleteObject, s3
}