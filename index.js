var log         = require('bitlog')
//var level       = require('level')
var Users       = require('level-users')
var tru         = require('through')
var isEmail     = require('validator').validators.isEmail
var sep = '\xff'
var usr_prfx = sep + 'INDEX' + sep + 'username'


var Udb = function(db, o) {
  if(!(this instanceof Udb)) return new Udb(db, o)
  Users.call(this, db)
  var o = o || {}

  var indexes = (o.indexes)
    ? ['username', 'email'].concat(o.indexes)
    : ['username', 'email']

  this.addIndexes(indexes, function(err) {
    if(err) return log('indexes created err', err)
  })
}

require('util').inherits(Udb, Users)

Udb.prototype.all = function(fn) {
  var rs = this.db.createReadStream({ end: sep })
  if(!fn) return rs
  var tr = tru(fn)
  rs.pipe(tr)
  return tr
}

Udb.prototype.check = function(req, cb) {
  var self  = this
  var name  = req.body.username || req.body.email
  var pass  = req.body.password
  if(!name || !pass)
    return cb('username and passwd require')

  var qry = (isEmail(name)) ? { email: name } : { username: name }

  self.get(qry, function(err, id) {
    if(err) return cb(err)
    self.auth(id, pass, function(err, user, put) {
      log('auth', err, user, put)
      if(err) return cb(err)
      if(!user) return cb(null, false)
      user.id = id
      cb(null, user)
    })
  })

}

module.exports = function(db, o) {
  var db = ('string' == typeof db)
  ? Udb(level(db), o)
  : Udb(db, o)

  return db
}

module.exports.routes = require('./routes.js')
