
require('seneca')()
  .use('user')
  .listen()
  .ready(function(){
    this.act({role:'user',cmd:'register',nick:'u1',name:'U1',password:'u1'})
  })


