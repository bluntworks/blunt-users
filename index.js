var log         = require('bitlog')
//var level       = require('level')
var Users       = require('level-users')
var tru         = require('through')
var isEmail     = require('validator').validators.isEmail
var bcrypt      = require('bcrypt')
var randpass    = require('randpass')
var sep = '\xff'
var usr_prfx = sep + 'INDEX' + sep + 'username'

var opts = { valueEncoding: 'json' }


var Udb = function(db, o) {
  if(!(this instanceof Udb)) return new Udb(db, o)
  Users.call(this, db)
  var o = o || {}

  var indexes = (o.indexes)
    ? ['username', 'email'].concat(o.indexes)
    : ['username', 'email']

  //log('indexes', indexes, o)
  this.addIndexes(indexes, function(err) {
    //log('addIndexes', arguments)
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
      //log('auth', err, user, put)
      if(err) return cb(err)
      if(!user) return cb(null, false)
      user.id = id
      cb(null, user)
    })
  })
}

Udb.prototype.newUser = function(user, cb) {
  var self = this
  user.password = user.temp = randpass()
  user.status = 'pending'
  user.hash_id = hashit(user)

  this.create(user, function(err, id) {
    if(err) return log('new user err ', err)
    self.get(id, function(err, u) {
      if(err) return cb(err)
      user.id = id
      cb(null, user)
    })
  })
}

Udb.prototype.getUser = function(hid, cb) {
  var self = this
  self.get(hid, function(err, id) {
    if(err) return cb(err)
    self.get(id, function(err, u) {
      if(err) return cb(err)
      u.id = id
      cb(null, u)
    })
  })
}

Udb.prototype.confirm = function(hid, cb) {
  var self = this
  this.get({ hash_id: hid }, function(err, id) {
    if(err) return cb(err)
    self.get(id, function(err, u) {
      if(err) return cb(err)
      u.status = 'confirmed'
      self.db.put(id, u, opts, function(err) {
        log.warn('UDB UPDATED',hid, arguments)
        cb(null, u)
      })
    })
  })
}

Udb.prototype.password = function(o, cb) {
  if(o.new_pass !== o.conf_pass) return cb('passwwords dont match')
  var self = this
  self.getUser({ hash_id: o.hash_id }, function(err, user) {
    if(err) return cb(err)
    if(user) {
      bcrypt.hash(o.new_pass, 5, function(err, bcryptPass) {
        log('bycrypt', err, bcryptPass, user)
        if(err) return cb(err)
        user.salt = bcryptPass
        delete user.temp
        self.db.put(self.prefix + user.id, user, function(err) {
          log('update pass/user', err)
          if(err) return cb(err)
          cb(null, user)
        })
      })
    }
  })
}

// module.exports = function(db, o) {
//   var db = ('string' == typeof db)
//   ? Udb(level(db), o)
//   : Udb(db, o)
//
//   return db
// }

module.exports = function(o) {
  var db = { db: o.db }
  delete o.db
  return new Udb(db, o)
}

module.exports.routes = require('./routes.js')

var crypto = require('crypto')
function hashit(u) {
  var sha = crypto.createHash('sha1')
  u.date = new Date().getTime()
  sha.update(JSON.stringify(u))
  return sha.digest('hex')
}
