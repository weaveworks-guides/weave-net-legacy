require('seneca')()
  .use('../lib/offer')
  .listen()
  .ready(function(){
    this.act({role:'offer',cmd:'provide'},console.log)
  })



