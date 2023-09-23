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

const s3qrwa = {
   Key: 'qr-wa',
   Bucket
}

const nim_admin = 'D0121505'

module.exports = {
   s3dt, s3log, s3kls, s3qrwa, s3logt, s3sync, nim_admin, Bucket
}