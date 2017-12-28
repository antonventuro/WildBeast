'use strict'
var Config = require('../../config.json')
var Logger = require('../internal/logger.js').Logger
var Dash = require('rethinkdbdash')
var r = new Dash({
  user: Config.database.user,
  password: Config.database.password,
  silent: true,
  servers: [{
    host: Config.database.host,
    port: Config.database.port
  }]
})

exports.checkLevel = function (msg, user, roles) {
  return new Promise(function (resolve, reject) {
    if (Config.permissions.master.indexOf(user) > -1) {
      return resolve(Infinity) // lol
    } else if (Config.permissions.level1.indexOf(user) > -1) {
      return resolve(1)
    } else if (Config.permissions.level2.indexOf(user) > -1) {
      return resolve(2)
    } else if (Config.permissions.level3.indexOf(user) > -1) {
      return resolve(3)
    } else {
      r.db('Discord').table('Users').get(user).then(u => {
        if (u !== null && u.banned) {
          return resolve(-1)
        } else if (msg.channel.type !== 0 || !msg.channel.guild) {
          return resolve(0)
        } else if (user === msg.channel.guild.ownerID) {
          return resolve(4)
        } else {
          getDatabaseDocument(msg.channel.guild).then((d) => {
            var level = d.perms.standard.everyone
            if (roles) {
              for (var r of roles) {
                if (d.perms.roles.level1.indexOf(r) > -1) {
                  level = (level > 1) ? level : (level !== -1) ? 1 : -1
                } else if (d.perms.roles.level2.indexOf(r) > -1) {
                  level = (level > 1) ? level : (level !== -1) ? 2 : -1
                } else if (d.perms.roles.level3.indexOf(r) > -1) {
                  level = (level > 1) ? level : (level !== -1) ? 3 : -1
                } else if (d.perms.roles.negative.indexOf(r) > -1) {
                  level = -1
                }
              }
            }
            if (d.perms.standard.level1.indexOf(user) > -1) {
              level = (level > 1) ? level : (level !== -1) ? 1 : -1
            } else if (d.perms.standard.level2.indexOf(user) > -1) {
              level = (level > 1) ? level : (level !== -1) ? 2 : -1
            } else if (d.perms.standard.level3.indexOf(user) > -1) {
              level = (level > 1) ? level : (level !== -1) ? 3 : -1
            } else if (d.perms.standard.negative.indexOf(user) > -1) {
              level = -1
            }
            return resolve(level)
          }).catch((e) => {
            initialize(msg.channel.guild)
            reject(e)
          })
        }
      })
    }
  })
}

exports.adjustLevel = function (msg, users, level, roles) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(msg.channel.guild).then((d) => {
      var roleIds = roles
      var userIds = users.map((x) => x.id)

      if (msg.mentionEveryone) {
        d.perms.standard.everyone = level
      }

      d.perms.roles.level1 = d.perms.roles.level1.filter((el) => roleIds.indexOf(el) < 0)
      d.perms.roles.level2 = d.perms.roles.level2.filter((el) => roleIds.indexOf(el) < 0)
      d.perms.roles.level3 = d.perms.roles.level3.filter((el) => roleIds.indexOf(el) < 0)
      d.perms.roles.negative = d.perms.roles.negative.filter((el) => roleIds.indexOf(el) < 0)

      if (d.perms.roles.hasOwnProperty('level' + level)) {
        d.perms.roles['level' + level].push.apply(d.perms.roles['level' + level], roleIds)
      } else if (level < 0) {
        d.perms.roles.negative.push.apply(d.perms.roles.negative, roleIds)
      }

      d.perms.standard.level1 = d.perms.standard.level1.filter((el) => userIds.indexOf(el) < 0)
      d.perms.standard.level2 = d.perms.standard.level2.filter((el) => userIds.indexOf(el) < 0)
      d.perms.standard.level3 = d.perms.standard.level3.filter((el) => userIds.indexOf(el) < 0)
      d.perms.standard.negative = d.perms.standard.negative.filter((el) => userIds.indexOf(el) < 0)

      if (d.perms.standard.hasOwnProperty('level' + level)) {
        d.perms.standard['level' + level].push.apply(d.perms.standard['level' + level], userIds)
      } else if (level < 0) {
        d.perms.standard.negative.push.apply(d.perms.standard.negative, userIds)
      }

      r.db('Discord').table('Guilds').get(msg.channel.guild.id).update(d).run().then(() => {
        resolve('Done!')
      }).catch((e) => {
        reject(e)
      })
    }).catch((e) => {
      initialize(msg.channel.guild)
      reject(e)
    })
  })
}

exports.restore = function (guild) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(guild).then(() => {
      r.db('Discord').table('Guilds').get(guild.id).delete().run().then(() => {
        initialize(guild).then(() => {
          resolve('Done!')
        }).catch((e) => {
          reject(e)
        })
      }).catch((e) => {
        reject(e)
      })
    }).catch((e) => {
      reject(e)
    })
  })
}

exports.updateGuildOwner = function (guild) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(guild).then(d => {
      d.superUser = guild.ownerID
      r.db('Discord').table('Guilds').get(guild.id).update(d).run().then(() => {
        resolve(true)
      })
    }).catch((e) => reject(e))
  })
}

function initialize (guild) {
  return new Promise(function (resolve, reject) {
    var doc = {
      customize: {
        nsfw: null,
        perms: null,
        prefix: null,
        timeout: null,
        welcome: false,
        welcomeMessage: null
      },
      id: guild.id,
      lang: 'en',
      perms: {
        roles: {
          level1: [],
          level2: [],
          level3: [],
          negative: []
        },
        standard: {
          everyone: 0,
          level1: [],
          level2: [],
          level3: [],
          negative: []
        },
        nsfw: []
      },
      superUser: guild.ownerID
    }
    r.db('Discord').table('Guilds').insert(doc).run().then(() => {
      resolve('ok')
    }).catch((e) => {
      Logger.error(e)
      reject(e)
    })
  })
}

exports.isKnown = function (guild) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(guild).then((r) => {
      if (r !== null) {
        return resolve()
      } else {
        return reject()
      }
    }).catch((e) => {
      reject(e)
    })
  })
}

function getDatabaseDocument (guild) {
  return new Promise(function (resolve, reject) {
    r.db('Discord').table('Guilds').get(guild.id).then((t) => {
      if (t !== null) {
        resolve(t)
      } else {
        reject(null)
      }
    }).catch((e) => {
      reject(e)
    })
  })
}
