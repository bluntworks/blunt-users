var log       = require('blunt-log')
var Users     = require('./index.js')
var weave     = require('blunt-weave')
var redirect  = require('blunt-redirect')

function restrict(req, res, next) {
  if(req.session.user) return next()
  redirect(res, '/login')
}

module.exports = function(app, udb) {
  var users = Users({ db: udb })

  app.get('/login', function(req, res) {
    weave(__dirname + '/views')
      .part('body', 'login.html')
      .pipe(res)
  })

  app.post('/login', function(req, res) {
    users.check(req, function(err, user) {
      log('user check', err, user)

    })
  })



}
