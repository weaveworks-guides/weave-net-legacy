
var express    = require('express')
var bodyParser = require('body-parser')
var seneca     = require('seneca')()


seneca
  .use('user')
  .use('auth')
  .use('../lib/api.js')
  .client({host:offer-ms.weave.local,pin:{role:'offer',cmd:'*'}})
  .client({host:user-ms.weave.local,pin:{role:'user',cmd:'*'}})

var app = express()

app.use( bodyParser.json() )
app.use( seneca.export('web') )
app.use( express.static('/opt/app/public') )

app.listen(80)

