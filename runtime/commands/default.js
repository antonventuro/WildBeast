var Commands = []
var request = require('superagent')
var config = require('../../config.json')
var Logger = require('../internal/logger.js').Logger
var argv = require('minimist')(process.argv.slice(2))
var bugsnag = require('bugsnag')
bugsnag.register(config.api_keys.bugsnag)

function getUptime () {
  var d = Math.floor(process.uptime() / 86400)
  var hrs = Math.floor((process.uptime() % 86400) / 3600)
  var min = Math.floor(((process.uptime() % 86400) % 3600) / 60)
  var sec = Math.floor(((process.uptime() % 86400) % 3600) % 60)

  if (d === 0 && hrs !== 0) {
    return `${hrs} hrs, ${min} mins, ${sec} seconds`
  } else if (d === 0 && hrs === 0 && min !== 0) {
    return `${min} mins, ${sec} seconds`
  } else if (d === 0 && hrs === 0 && min === 0) {
    return `${sec} seconds`
  } else {
    return `${d} days, ${hrs} hrs, ${min} mins, ${sec} seconds`
  }
}

Commands.ping = {
  name: 'ping',
  help: 'I\'ll reply to you with pong!',
  timeout: 10,
  level: 0,
  fn: function (msg) {
    msg.channel.createMessage(`Pong! \nLatency: ${msg.channel.guild.shard.latency} ms.`)
  }
}

Commands.say = {
  name: 'say',
  help: 'Repeat after me.',
  aliases: ['echo', 'repeat'],
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.createMessage(`${msg.author.mention}, Cannot send an empty message, ya doof.`)
      return
    }
    var re = /(discord(\.gg|app\.com\/invite)\/([\w]{16}|([\w]+-?){3}))/
    if (msg.mentions.length >= 5) {
      msg.channel.createMessage(`${msg.author.mention}, No more than five mentions at a time please.`)
    } else if (re.test(msg.content)) {
      msg.channel.createMessage(`${msg.author.mention}, Lol no thanks, not sending that.`)
    } else {
      msg.channel.createMessage('\u200B' + suffix.replace(/@everyone/, '@\u200Beveryone').replace(/@here/, '@\u200Bhere'))
    }
  }
}

Commands.purge = {
  name: 'purge',
  help: 'Use this command to delete any amount of message up to 100.',
  usage: '<number>',
  aliases: ['prune'],
  noDM: true,
  timeout: 30,
  level: 0,
  fn: function (msg, suffix, bot) {
    var guildPerms = msg.member.permission.json
    var botPerms = msg.channel.guild.members.get(bot.user.id).permission.json

    if (!guildPerms.manageMessages) {
      msg.channel.createMessage(`<@${msg.author.id}>, You do not have the permission to manage messages!`)
    } else if (!botPerms.manageMessages) {
      msg.channel.createMessage('I do not have `Manage Messages` permission!')
    } else {
      if (!suffix || isNaN(suffix) || suffix > 100 || suffix < 0) {
        msg.channel.createMessage(`<@${msg.author.id}>, Please try again with a number between **0** to **100**.`)
      } else {
        msg.channel.getMessages(suffix).then((messages) => {
          var cantDelete = 0
          var x = 0
          var deleteMe = []
          for (x = 0; x < messages.length; x++) {
            var compareNums = (new Date(msg.timestamp) - new Date(messages[x].timestamp))
            if (compareNums > 1209600000) {
              cantDelete++
            } else {
              deleteMe.push(messages[x].id)
            }
          }
          msg.channel.createMessage(`${deleteMe.length} message(s) have been purged. ${cantDelete} were omitted due to them being over two weeks old.`).then((m) => {
            if (config.settings.autodeletemsg) {
              setTimeout(() => {
                m.delete().catch((e) => Logger.error(e))
              }, config.settings.deleteTimeoutLong)
            }
          })
          msg.channel.deleteMessages(deleteMe)
        }).catch((error) => {
          msg.channel.createMessage('I could not fetch messages to delete, try again later.')
          Logger.error(error)
        })
      }
    }
  }
}

Commands.eval = {
  name: 'eval',
  help: 'Allows for the execution of arbitrary Javascript.',
  level: 'master',
  fn: function (msg, suffix, bot) {
    if (msg.author.id === bot.user.id) return // To statisfy our styleguide :P
    var util = require('util')
    try {
      var returned = eval(suffix) // eslint-disable-line no-eval
      var str = util.inspect(returned, {
        depth: 2
      })
      if (str.length > 1900) {
        str = str.substr(0, 1897)
        str = str + '...'
      }
      str = str.replace(new RegExp(bot.token, 'gi'), '( ͡° ͜ʖ ͡°)') // Because some frog broke this string with a shruglenny
      msg.channel.createMessage('```xl\n' + str + '\n```').then((ms) => {
        if (returned !== undefined && returned !== null && typeof returned.then === 'function') {
          returned.then(() => {
            var str = util.inspect(returned, {
              depth: 2
            })
            if (str.length > 1900) {
              str = str.substr(0, 1897)
              str = str + '...'
            }
            ms.edit('```xl\n' + str + '\n```')
          }, (e) => {
            var str = util.inspect(e, {
              depth: 2
            })
            if (str.length > 1900) {
              str = str.substr(0, 1897)
              str = str + '...'
            }
            ms.edit('```xl\n' + str + '\n```')
          })
        }
      })
    } catch (e) {
      msg.channel.createMessage('```xl\n' + e + '\n```')
    }
  }
}

Commands.plaineval = {
  name: 'plaineval',
  help: 'Allows for the execution of arbitrary Javascript.',
  level: 'master',
  fn: function (msg, suffix, bot) {
    if (msg.author.id === bot.user.id) return // To statisfy our styleguide :P
    var evalfin = []
    try {
      evalfin.push('```xl')
      evalfin.push(eval(suffix)) // eslint-disable-line no-eval
      evalfin.push('```')
    } catch (e) {
      evalfin = []
      evalfin.push('```xl')
      evalfin.push(e)
      evalfin.push('```')
    }
    msg.channel.createMessage(evalfin.join('\n'))
  }
}

Commands.globalban = {
  name: 'globalban',
  alias: ['globalignore'],
  help: 'Deny a user from using the bot globally.',
  usage: '<ban/unban/status> <userid>',
  level: 'master',
  fn: function (msg, suffix) {
    var users = require('../databases/controllers/users.js')
    var what = suffix.toLowerCase().split(' ')[0]
    var who = suffix.split(' ')[1] !== undefined ? suffix.split(' ')[1] : what
    var reason = suffix.substr(what.length + who.length + 1)
    users.globalBan(what, who, reason).then(x => {
      msg.channel.createMessage(`<@${msg.author.id}>, ${x}`)
    }).catch(err => {
      msg.channel.createMessage(`<@${msg.author.id}>, ${err}`)
    })
  }
}

Commands.twitch = {
  name: 'twitch',
  help: 'Tells you if a specified streamer is live on Twitch.tv',
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.createMessage('No channel specified!')
      return
    }
    var url = 'https://api.twitch.tv/kraken/streams/' + suffix
    request.get(url)
      .set({'Accept': 'application/vnd.twitchtv.v3+json', 'Client-ID': config.api_keys.twitchId})
      .end((error, response) => {
        if (error) {
          bugsnag.notify(error)
        }
        if (!error && response.statusCode === 200) {
          var resp
          try {
            resp = response.body
          } catch (e) {
            msg.channel.createMessage('The API returned an unconventional response.')
          }
          if (resp.stream !== null) {
            msg.channel.createMessage(suffix + ' is currently live at https://www.twitch.tv/' + suffix)
            return
          } else if (resp.stream === null) {
            msg.channel.createMessage(suffix + ' is not currently streaming')
            return
          }
        } else if (!error && response.statusCode === 404) {
          msg.channel.createMessage('Channel does not exist!')
          return
        }
      })
  }
}

Commands.customize = {
  name: 'customize',
  help: 'Adjust my behaviour in this server!',
  noDM: true,
  level: 3,
  fn: function (msg, suffix) {
    var c = require('../databases/controllers/customize.js')
    suffix = suffix.split(' ')
    var x = suffix.slice(1, suffix.length).join(' ')
    if (suffix[0].length === 0) {
      var datacontrol = require('../datacontrol')
      datacontrol.customize.getGuildData(msg.channel.guild).then(g => {
        msg.channel.createMessage(`No option entered! Check ${g.customize.prefix !== null ? g.customize.prefix : config.settings.prefix}customize help to see the various options you can set.`)
      })
    } else if (suffix[0] === 'help') {
      c.helpHandle(msg)
    } else {
      c.adjust(msg, suffix[0], x).then((r) => {
        msg.channel.createMessage(':ok_hand: Adjusted ' + suffix[0] + ' to `' + r + '`')
      }).catch((e) => {
        msg.channel.createMessage('Whoops, ' + e)
      })
    }
  }
}

Commands.info = {
  name: 'info',
  help: 'I\'ll print some information about me.',
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    var owner
    try {
      owner = `${bot.users.get(config.permissions.master[0]).username}#${bot.users.get(config.permissions.master[0]).discriminator}`
    } catch (e) {
      owner = `'ID: ${config.permissions.master[0]}`
    }
    var field = [{name: 'Servers Connected', value: '```\n' + bot.guilds.size + '```', inline: true},
      {name: 'Users Known', value: '```\n' + bot.users.size + '```', inline: true},
      {name: 'Channels Connected', value: '```\n' + Object.keys(bot.channelGuildMap).length + '```', inline: true},
      {name: 'Private Channels', value: '```\n' + Object.keys(bot.privateChannelMap).length + '```', inline: true},
      {name: 'Owner', value: '```\n' + owner + '```', inline: true},
      {name: 'Sharded?', value: '```\n' + `${argv.shardmode ? 'Yes' : 'No'}` + '```', inline: true}]
    if (argv.shardmode) {
      field.push({name: 'Shard ID', value: '```\n' + argv.shardid + '```', inline: true})
      field.push({name: 'Shard Count', value: '```\n' + argv.shardcount + '```', inline: true})
    }
    msg.channel.createMessage({
      embed: {
        color: 0x3498db,
        author: {icon_url: bot.user.avatarURL, name: `${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`},
        title: `Running on WildBeast version ${require('../../package.json').version}`,
        timestamp: new Date(),
        fields: field,
        description: '*My developer is Dougley#6248*',
        url: 'https://github.com/TheSharks/WildBeast',
        footer: {text: `Online for ${getUptime()}`}
      }
    })
  }
}

Commands['leave-server'] = {
  name: 'leave-server',
  help: 'I\'ll leave this server if I am not welcome here.',
  noDM: true,
  level: 3,
  fn: function (msg) {
    msg.channel.createMessage('Okay, cya!')
    msg.channel.guild.leave()
  }
}

Commands.killswitch = {
  name: 'killswitch',
  help: 'This will instantly terminate all running bot processes',
  level: 'master',
  fn: function (msg, suffix, bot) {
    bot.disconnect()
    Logger.warn('Disconnected via killswitch!')
    process.exit(0)
  }
}

Commands.namechanges = {
  name: 'namechanges',
  help: 'I will tell you the name changes for the user you mention.',
  noDM: true,
  level: 0,
  fn: function (msg) {
    const n = require('../databases/controllers/users.js')
    if (msg.mentions.length === 0) {
      msg.channel.createMessage('Please mention the user you want the name changes of.')
      return
    }
    msg.mentions.map((u) => {
      n.names(u).then((n) => {
        msg.channel.createMessage(n.join(', '))
      })
    })
  }
}

Commands.setlevel = {
  name: 'setlevel',
  help: 'This changes the permission level of a user.',
  noDM: true,
  level: 3,
  fn: function (msg, suffix, bot) {
    var Permissions = require('../databases/controllers/permissions.js')
    suffix = suffix.split(' ')
    if (isNaN(suffix[0])) {
      msg.channel.createMessage(`<@${msg.author.id}>, Your first parameter is not a number!`)
    } else if (suffix[0] > 3) {
      msg.channel.createMessage('Setting a level higher than 3 is not allowed.')
    } else if (msg.mentions.length === 0 && msg.roleMentions.length === 0 && !msg.mentionEveryone) {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s)/role(s) you want to set the permission level of.`)
    } else if (msg.mentions.length === 1 && msg.mentions[0].id === msg.channel.guild.ownerID) {
      msg.channel.createMessage(`<@${msg.author.id}>, You cannot set the server owner's level.`)
    } else if (msg.mentions.length === 1 && msg.mentions[0].id === bot.user.id) {
      msg.channel.createMessage(`<@${msg.author.id}>, I don't need any level set, I can do anything regardless of access levels.`)
    } else {
      Permissions.adjustLevel(msg, msg.mentions, parseFloat(suffix[0]), msg.roleMentions).then(function () {
        msg.channel.createMessage('Alright! The permission levels have been set successfully!')
      }).catch(function (err) {
        msg.channel.createMessage('Help! Something went wrong!')
        bugsnag.notify(err)
        Logger.error(err)
      })
    }
  }
}

Commands.addrole = {
  name: 'addrole',
  help: 'Give a role to user or users.',
  usage: '@user @user2 rolename',
  noDM: true,
  level: 3,
  fn: function (msg, suffix, bot) {
    var guildPerms = msg.member.permission.json
    var botPerms = msg.channel.guild.members.get(bot.user.id).permission.json

    let roleToAdd = suffix.split(' ').splice(msg.mentions.length).join(' ')
    let role = msg.channel.guild.roles.find(r => r.name === roleToAdd).id
    if (!guildPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, You don't have Manage Roles permission here.`)
    } else if (!botPerms.manageRoles) {
      msg.channel.createMessage('I don\'t have Manage Roles permission here, sorry!')
    } else if (msg.mentions.length === 0 && !msg.mentionEveryone) {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s) you want to give the role to.`)
    } else if (typeof role !== 'string') {
      msg.channel.createMessage(`<@${msg.author.id}>, The role does not seem to exist. Check your spelling and remember that this command is case sensitive.`)
    } else {
      msg.mentions.map(u => {
        let guildMember = msg.channel.guild.members.get(u.id)
        guildMember.addRole(role).then(() => {
          msg.channel.createMessage('Role `' + roleToAdd + '` successfully assigned to **' + guildMember.username + '**!')
        }).catch(err => {
          msg.channel.createMessage(`<@${msg.author.id}>, Something went wrong: ${err}`)
        })
      })
    }
  }
}

Commands.takerole = {
  name: 'takerole',
  help: 'Take a role from a user or users',
  usage: '@user @user2 rolename',
  noDM: true,
  level: 3,
  fn: function (msg, suffix, bot) {
    var guildPerms = msg.member.permission.json
    var botPerms = msg.channel.guild.members.get(bot.user.id).permission.json

    let roleToRemove = suffix.split(' ').splice(msg.mentions.length).join(' ')
    let role = msg.channel.guild.roles.find(r => r.name === roleToRemove).id
    if (!guildPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, You don't have Manage Roles permission here.`)
    } else if (!botPerms.manageRoles) {
      msg.channel.createMessage('I don\'t have Manage Roles permission here, sorry!')
    } else if (msg.mentions.length === 0 && !msg.mentionEveryone) {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s) you want to give the role to.`)
    } else if (typeof role !== 'string') {
      msg.channel.createMessage(`<@${msg.author.id}>, The role does not seem to exist. Check your spelling and remember that this command is case sensitive.`)
    } else {
      msg.mentions.map(u => {
        let guildMember = msg.channel.guild.members.get(u.id)
        guildMember.removeRole(role).then(() => {
          msg.channel.createMessage('Role `' + roleToRemove + '` successfully taken from **' + guildMember.username + '**!')
        }).catch(err => {
          msg.channel.createMessage('Something went wrong: ' + err)
        })
      })
    }
  }
}

Commands.rankup = {
  name: 'rankup',
  help: 'Level up somebody\'s level by one.',
  noDM: true,
  timeout: 5,
  level: 3,
  fn: function (msg, suffix, bot) {
    var Permissions = require('../databases/controllers/permissions.js')
    if (msg.mentions.length > 0) {
      Permissions.checkLevel(msg, msg.author.id, msg.member.roles).then((authorLevel) => {
        let list = {success: [], error: {level2: [], level3: []}}
        msg.mentions = msg.mentions.filter(u => u.id !== bot.user.id)
        safeLoop(msg, authorLevel, msg.mentions, list)
      }).catch(e => console.log(e))
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, Please @mention the user(s) you want to rank up the permission level of.`)
    }

    function safeLoop (msg, authorLevel, users, list) {
      if (users.length === 0) {
        let resp = ''
        if (list.success.length !== 0) resp += `The following have been leveled up: ${list.success.join(', ')}`
        if (list.error.level2.length !== 0) resp += `\nThe following are already at level 2 or more: ${list.error.level2.join(', ')}`
        if (list.error.level3.length !== 0) resp += `\nThe following are already at level 3 or more: ${list.error.level3.join(', ')}`
        msg.channel.createMessage(`<@${msg.author.id}>, ${resp}`)
      } else {
        Permissions.checkLevel(msg, users[0].id, msg.channel.guild.members.get(users[0].id).roles).then(level => {
          if (authorLevel > 3 && level >= 3) {
            list.error.level3.push(users[0].username)
            users.shift()
            safeLoop(msg, authorLevel, users, list)
          } else if (authorLevel === 3 && level >= 2) {
            list.error.level2.push(users[0].username)
            users.shift()
            safeLoop(msg, authorLevel, users, list)
          } else if ((authorLevel === 3 && level < 2) || (authorLevel > 3 && level < 3)) {
            Permissions.adjustLevel(msg, users[0], level + 1, []).then(() => {
              list.success.push(users[0].username)
              users.shift()
              safeLoop(msg, authorLevel, users, list)
            }).catch(err => {
              bugsnag.notify(err)
              Logger.error(err)
            })
          }
        }).catch(err => {
          msg.channel.createMessage('Help! Something went wrong!')
          bugsnag.notify(err)
          Logger.error(err)
        })
      }
    }
  }
}

Commands.setnsfw = {
  name: 'setnsfw',
  help: 'deprecated',
  noDM: true,
  level: 3,
  fn: function (msg) {
    msg.channel.createMessage(`<@${msg.author.id}>, **setnsfw** has been deprecated. Please set the channel to NSFW in the settings if you want to use NSFW commands!`)
  }
}

Commands.hello = {
  name: 'hello',
  help: 'I\'ll respond to you with hello along with a GitHub link!',
  timeout: 20,
  level: 0,
  fn: function (msg, suffix, bot) {
    msg.channel.createMessage('Hi ' + msg.author.username + ', I\'m ' + bot.user.username + ' and I was developed by the team over at TheSharks! Improve me by contributing to my source code on GitHub: https://github.com/TheSharks/WildBeast')
  }
}

Commands.setstatus = {
  name: 'setstatus',
  help: 'Change my playing status on Discord to something else or pass nothing to clear the status!',
  usage: '<online / idle / dnd / invisible / twitch url> [playing status]',
  level: 'master',
  fn: function (msg, suffix, bot) {
    var first = suffix.split(' ')
    if (!suffix) {
      bot.editStatus('online', {
        game: null // clears status
      })
      msg.channel.createMessage(`Cleared status.`)
    } else {
      if (/^https?/.test(first[0])) {
        bot.editStatus(null, {
          game: {
            name: (first[1] ? suffix.substring(first[0].length + 1) : null),
            url: first[0]
          }
        })
        msg.channel.createMessage(`Set status to streaming with message ${suffix.substring(first[0].length + 1)}`)
      } else if (['online', 'idle', 'dnd', 'invisible'].indexOf(first[0]) > -1) {
        bot.editStatus(first[0], {
          name: (first[1] ? suffix.substring(first[0].length + 1) : null)
        })
        msg.channel.createMessage(`Set status to ${first[0]} with message ${suffix.substring(first[0].length + 1)}`)
      } else if (suffix.substring(first[0].length + 1).length < 1) {
        msg.reply('Can only be `online`, `idle`, `dnd` or `invisible`!')
      } else {
        bot.editStatus('online', {
          game: {
            name: null
          }
        })
        msg.channel.createMessage(`Cleared status.`)
      }
    }
  }
}

Commands['server-info'] = {
  name: 'server-info',
  help: 'I\'ll tell you some information about the server you\'re currently in.',
  aliases: ['serverinfo'],
  noDM: true,
  timeout: 20,
  level: 0,
  fn: function (msg, suffix, bot) {
    var field = [{name: 'Server name', value: `${msg.channel.guild.name} (${msg.channel.guild.id})`},
      {
        name: 'Owned by',
        value: '```\n' + `${bot.users.get(msg.channel.guild.ownerID).username}#${bot.users.get(msg.channel.guild.ownerID).username} (${bot.users.get(msg.channel.guild.ownerID).username})` + '```',
        inline: true
      },
      {name: 'Current Region', value: '```\n' + msg.channel.guild.region + '```', inline: true},
      {name: 'Members', value: '```\n' + msg.channel.guild.members.size + '```', inline: true},
      {
        name: 'Text Channels',
        value: '```\n' + msg.channel.guild.channels.filter(c => c.type === 0).length + '```',
        inline: true
      },
      {
        name: 'Voice Channels',
        value: '```\n' + msg.channel.guild.channels.filter(c => c.type === 2).length + '```',
        inline: true
      },
      {name: 'Total Roles', value: '```\n' + msg.channel.guild.roles.size + '```', inline: true}]

    if (msg.channel.guild.afkChannelID === null) {
      field.push({name: 'AFK-Channel', value: '```\nNone```'})
    } else {
      field.push({
        name: 'AFK-Channel',
        value: '```\n' + `${msg.channel.guild.channels.get(msg.channel.guild.afkChannelID).name} (${msg.channel.guild.channels.get(msg.channel.guild.afkChannelID).id})` + '```'
      })
    }
    var embed = {
      author: {name: `Information requested by ${msg.author.username}`},
      timestamp: new Date(),
      color: 0x3498db,
      fields: field,
      footer: {text: `Online for ${getUptime()}`, icon_url: bot.user.avatarURL}
    }
    if (msg.channel.guild.icon) {
      embed.thumbnail = {url: msg.channel.guild.iconURL}
      embed.url = msg.channel.guild.iconURL
    }
    msg.channel.createMessage({embed: embed})
  }
}

Commands.userinfo = {
  name: 'userinfo',
  help: 'I\'ll get some information about the user you\'ve mentioned.',
  noDM: true,
  level: 0,
  fn: function (msg, suffix, bot) {
    var Permissions = require('../databases/controllers/permissions.js')
    if (msg.mentions.length === 0) {
      Permissions.checkLevel(msg, msg.author.id, msg.member.roles).then((level) => {
        var tempRoles = msg.member.roles.map(r => msg.channel.guild.roles.get(r)).sort(function (a, b) {
          return a.position - b.position
        }).reverse()
        var roles = []
        for (var i in tempRoles) {
          roles.push(tempRoles[i].name)
        }
        roles = roles.splice(0, roles.length).join(', ')
        var field = [
          {name: 'Status', value: '```\n' + msg.member.status + '```', inline: true},
          {name: 'Account Creation', value: '```\n' + new Date(msg.member.createdAt) + '```'},
          {name: 'Access Level', value: '```\n' + level + '```'},
          {name: 'Roles', value: '```\n' + `${tempRoles.length > 0 ? roles : 'None'}` + '```'}]
        if (msg.member.game) {
          field.splice(1, 0, {name: 'Playing', value: '```\n' + msg.member.game.name + '```', inline: true})
        }
        var embed = {
          author: {name: `${msg.author.username}#${msg.author.discriminator} (${msg.author.id})`},
          timestamp: new Date(),
          fields: field,
          footer: {text: `Online for ${getUptime()}`, icon_url: bot.user.avatarURL}
        }
        if (msg.author.avatarURL) {
          embed.author.icon_url = msg.author.avatarURL
          embed.thumbnail = {url: msg.author.avatarURL}
          embed.url = msg.author.avatarURL
        }
        msg.channel.createMessage({embed: embed})
      }).catch((error) => {
        msg.channel.createMessage('Something went wrong, try again later.')
        Logger.error(error)
      })
      return
    }
    msg.mentions.map(function (user) {
      Permissions.checkLevel(msg, user.id, msg.channel.guild.members.get(user.id).roles).then(function (level) {
        var guild = msg.channel.guild
        var member = guild.members.get(user.id)
        var tempRoles = member.roles.map(r => msg.channel.guild.roles.get(r)).sort(function (a, b) {
          return a.position - b.position
        }).reverse()
        var roles = []
        for (var i in tempRoles) {
          roles.push(tempRoles[i].name)
        }
        roles = roles.splice(0, roles.length).join(', ')
        var field = [
          {name: 'Status', value: '```\n' + member.status + '```', inline: true},
          {name: 'Account Creation', value: '```\n' + new Date(member.createdAt) + '```'},
          {name: 'Access Level', value: '```\n' + level + '```'},
          {name: 'Roles', value: '```\n' + `${tempRoles.length > 0 ? roles : 'None'}` + '```'}]
        if (member.game) {
          field.splice(1, 0, {name: 'Playing', value: '```\n' + member.game.name + '```', inline: true})
        }
        var embed = {
          author: {name: `${user.username}#${user.discriminator} (${user.id})`},
          timestamp: new Date(),
          fields: field,
          footer: {text: `Online for ${getUptime()}`, icon_url: bot.user.avatarURL}
        }
        if (user.avatarURL) {
          embed.author.icon_url = user.avatarURL
          embed.thumbnail = {url: user.avatarURL}
          embed.url = user.avatarURL
        }
        msg.channel.createMessage({embed: embed})
      }).catch(function (err) {
        Logger.error(err)
        msg.channel.createMessage('Something went wrong, try again later.')
      })
    })
  }
}

Commands['join-server'] = {
  name: 'join-server',
  help: 'I\'ll join the server you\'ve requested me to join, as long as the invite is valid and I\'m not banned of already in the requested server.',
  aliases: ['join', 'joinserver', 'invite'],
  usage: '<bot-mention> <instant-invite>',
  level: 0,
  fn: function (msg, suffix, bot) {
    if (bot.user.bot) {
      msg.channel.createMessage('Sorry, bot accounts can\'t accept instant invites, instead, use my OAuth URL: <' + config.bot.oauth + '>')
      return
    } else {
      Logger.warn('Using user accounts is deprecated!')
    }
  }
}

Commands.kick = {
  name: 'kick',
  help: 'Kick the user(s) out of the server!',
  noDM: true,
  usage: '<user-mentions> [reason]',
  level: 0,
  fn: function (msg, suffix, bot) {
    if (!msg.member.permission.json.kickMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to kick members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.kickMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to kick members.`)
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length === 0) {
      msg.channel.createMessage('Please mention the user(s) you want to kick.')
    } else {
      let chunks = suffix.split(' ')
      let members = msg.mentions.filter(u => u.id !== bot.user.id).map((user) => msg.channel.guild.members.get(user.id))
      let reason = chunks.slice(members.length).join(' ').length === 0 ? 'No reason provided.' : chunks.slice(members.length).join(' ')
      let list = {success: [], error: []}
      safeLoop(msg, members, reason, list)
    }

    function safeLoop (msg, members, reason, list) {
      if (members.length === 0) {
        let resp = ''
        if (list.success.length !== 0) resp += `Kicked the following: ${list.success.join(', ')}\n`
        if (list.error.length !== 0) resp += `Could not kick the following: ${list.error.join(', ')}\n`
        resp += `Reason provided by user: ${reason}`
        msg.channel.createMessage(`<@${msg.author.id}>, ${resp}`)
      } else {
        members[0].kick(`${msg.author.username}#${msg.author.discriminator} used kick for: ${reason}`).then(() => {
          list.success.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, members, reason, list)
        }).catch(() => {
          list.error.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, members, reason, list)
        })
      }
    }
  }
}

Commands.ban = {
  name: 'ban',
  help: 'Swing the banhammer on someone!',
  noDM: true,
  usage: '[days (can be 0, 1, or 7)] <user-mention || user-mentions> [reason]',
  level: 0,
  fn: function (msg, suffix, bot) {
    function safeLoop (msg, days, members, reason, list) {
      if (members.length === 0) {
        let resp = ``
        if (list.success.length !== 0) resp += `Banned the following for **${days}** days: ${list.success.join(', ')}\n`
        if (list.error.length !== 0) resp += `Could not ban the following: ${list.error.join(', ')}\n`
        resp += `Reason provided by user: ${reason}`
        msg.channel.createMessage(`<@${msg.author.id}>, ${resp}`)
      } else {
        members[0].ban(parseInt(days), `${msg.author.username}#${msg.author.discriminator} used ban for: ${reason}`).then(() => {
          list.success.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, days, members, reason, list)
        }).catch(() => {
          list.error.push(`\`${members[0].username}\``)
          members.shift()
          safeLoop(msg, days, members, reason, list)
        })
      }
    }

    if (!msg.member.permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to ban members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to ban members.`)
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length === 0) {
      msg.channel.createMessage('Please mention the user(s) you want to ban.')
    } else {
      let chunks = suffix.split(' ')
      let days = isNaN(parseInt(chunks[0], 10)) ? 1 : parseInt(chunks[0], 10)
      if ([0, 1, 7].includes(days)) {
        let members = msg.mentions.filter(u => u.id !== bot.user.id).map((user) => msg.channel.guild.members.find(m => m.id === user.id))
        let reason = isNaN(chunks[0]) ? chunks.slice(members.length).join(' ').length === 0 ? 'No reason provided.' : chunks.slice(members.length).join(' ') : chunks.slice(members.length + 1).join(' ').length === 0 ? 'No reason provided.' : chunks.slice(members.length + 1).join(' ')
        let list = {success: [], error: []}

        safeLoop(msg, days, members, reason, list)
      } else {
        msg.channel.createMessage(`<@${msg.author.id}>, Your first argument must be a number or nothing for the default of 1, can only be 0, 1 or 7!`)
      }
    }
  }
}

Commands.hackban = {
  name: 'hackban',
  help: 'Swing the ban hammer on someone who isn\'t a member of the server!',
  noDM: true,
  usage: '<userid | userids> <optional reason>',
  level: 0,
  fn: function (msg, suffix, bot) {
    if (!msg.member.permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to ban members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to ban members.`)
    } else if (!suffix) {
      msg.channel.createMessage('You need to provide an ID to ban!')
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length > 0) {
      msg.channel.createMessage('You need to provide an ID to ban! Mentions aren\'t supported for hackban.')
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, Please wait...`).then((m) => {
        let banMembers = {success: [], error: []}
        let idArray = []
        let reasonWords = []
        suffix.split(' ').map((id) => {
          if (isNaN(id) || id.length < 16) {
            reasonWords.push(id)
          } else {
            idArray.push(id)
          }
        })
        let reason = reasonWords.length > 0 ? reasonWords.join(' ') : 'No reason provided.'
        idArray.map((id) => {
          bot.getRESTUser(id).then((user) => {
            msg.channel.guild.banMember(id, 0, `${msg.author.username}#${msg.author.discriminator} used hackban for: ${reason}`).then(() => {
              banMembers.success.push(`\`${user.username}#${user.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Hackbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not hackban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            }).catch(() => {
              banMembers.error.push(`\`${user.username}#${user.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Hackbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not hackban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            })
          })
        })
      })
    }
  }
}

Commands.softban = {
  name: 'softban',
  help: 'Bans and immediately unbans the user, removing their messages.',
  noDM: true,
  usage: '<user-mention> | <userid> <optional reason>',
  level: 0,
  fn: function (msg, suffix, bot) {
    if (!msg.member.permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but you do not have permission to ban members.`)
    } else if (!msg.channel.guild.members.get(bot.user.id).permission.json.banMembers) {
      msg.channel.createMessage(`<@${msg.author.id}>, Sorry but I do not have the required permission to ban members.`)
    } else if (!suffix) {
      msg.channel.createMessage('You need to provide an ID to ban!')
    } else if (msg.mentions.filter(m => m.id !== bot.user.id).length > 0) {
      msg.channel.createMessage('Please wait...').then((m) => {
        let membersToBan = msg.mentions.filter(m => m.id !== bot.user.id)
        let banMembers = {success: [], error: []}
        let reasonWords = []
        suffix.split(' ').map((id) => {
          if (id.startsWith('<@')) {
          } else {
            reasonWords.push(id)
          }
        })
        let reason = reasonWords.length > 0 ? reasonWords.join(' ') : 'No reason provided.'
        membersToBan.map((user) => {
          msg.channel.guild.banMember(user.id, 1, `${msg.author.username}#${msg.author.discriminator} used softban for: ${reason}`).then(() => {
            msg.channel.guild.unbanMember(user.id, 'Automatic unban from softban.').then(() => {
              banMembers.success.push(`\`${user.username}#${user.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === membersToBan.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            }).catch(() => {
              banMembers.error.push(`\`${user.username}#${user.discriminator}\``)
              if (membersToBan.length === banMembers.error.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            })
          }).catch(() => {
            banMembers.error.push(`\`${user.username}#${user.discriminator}\``)
            if (membersToBan.length === banMembers.error.length) {
              let resp = ''
              if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
              if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
              resp += `Reason provided by user: ${reason}`
              m.edit(resp)
            }
          })
        })
      })
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, Please wait...`).then((m) => {
        let banMembers = {success: [], error: []}
        let idArray = []
        let reasonWords = []
        suffix.split(' ').map((id) => {
          if (isNaN(id) || id.length < 16) {
            reasonWords.push(id)
          } else {
            idArray.push(id)
          }
        })
        let reason = reasonWords.length > 0 ? reasonWords.join(' ') : 'No reason provided.'
        idArray.map((id) => {
          let member = msg.channel.guild.members.get(id)
          if (!member) {
            m.edit('A provided ID isn\'t a member of this guild!')
            return
          }
          msg.channel.guild.banMember(id, 1, `${msg.author.username}#${msg.author.discriminator} used softban for: ${reason}`).then(() => {
            member.unbanMember(id, 'Automatic unban from softban').then(() => {
              banMembers.success.push(`\`${member.username}#${member.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            }).catch(() => {
              banMembers.error.push(`\`${member.username}#${member.discriminator}\``)
              if (banMembers.success.length + banMembers.error.length === idArray.length) {
                let resp = ''
                if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
                if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
                resp += `Reason provided by user: ${reason}`
                m.edit(resp)
              }
            })
          }).catch(() => {
            banMembers.error.push(`\`${member.username}#${member.discriminator}\``)
            if (banMembers.success.length + banMembers.error.length === idArray.length) {
              let resp = ''
              if (banMembers.success.length !== 0) resp += `Softbanned the following: ${banMembers.success.join(', ')}\n`
              if (banMembers.error.length !== 0) resp += `Could not softban the following: ${banMembers.error.join(', ')}\n`
              resp += `Reason provided by user: ${reason}`
              m.edit(resp)
            }
          })
        })
      })
    }
  }
}

Commands.prefix = {
  name: 'prefix',
  help: 'If you, despite reading this have no clue what my prefix is, I\'ll tell you!',
  timeout: 5,
  level: 0,
  fn: function (msg) {
    var datacontrol = require('../datacontrol')
    datacontrol.customize.getGuildData(msg.channel.guild).then(g => {
      msg.channel.createMessage(`My prefix on this server is ${g.customize.prefix !== null ? g.customize.prefix : config.settings.prefix}`)
    }).catch((error) => {
      Logger.error(error)
      msg.channel.createMessage('Whoops, something went wrong.')
    })
  }
}

Commands.colorrole = {
  name: 'colorrole',
  help: 'Use this to color a role you have!',
  usage: '<role name> <hexadecimal value ("#FFFFFF" or "FFFFFF")',
  timeout: 5,
  level: '3',
  fn: function (msg, suffix, bot) {
    var split = suffix.split(' ')
    var hex = split[split.length - 1]
    split.pop()
    var role = msg.channel.guild.roles.find(r => r.name === split.join(' '))
    var Reg = /^#?([\da-fA-F]{6})$/
    var botPerms = msg.channel.guild.members.get(bot.user.id).permission.json
    if (typeof role !== 'object' || hex.length === 0) {
      msg.channel.createMessage(`<@${msg.author.id}>, Input a valid role name and an hexadecimal value!`)
      return
    }
    if (!Reg.test(hex)) {
      msg.channel.createMessage(`<@${msg.author.id}>, Invalid hex value!`)
      return
    }
    if (typeof msg.member.roles.find(r => r === role.id) !== 'object' && msg.author.id !== msg.channel.guild.ownerID) {
      msg.channel.createMessage(`<@${msg.author.id}>, You do not have that role!`)
      return
    }
    if (!botPerms.manageRoles) {
      msg.channel.createMessage(`<@${msg.author.id}>, I do not have Manage Roles permission here, sorry!`)
      return
    }
    var botRole = msg.channel.guild.members.get(bot.user.id).roles.map(r => msg.channel.guild.roles.get(r)).sort(function (a, b) {
      return a.position < b.position
    })[0]
    if (role.position >= botRole.position) {
      msg.channel.createMessage(`<@${msg.author.id}>, This role is higher or equal to my highest role, I cannot color it!`)
      return
    }
    role.edit({
      color: parseInt(hex.replace(Reg, '$1'), 16)
    }, `${msg.author.username}#${msg.author.discriminator} colored ${role.name} ${hex}.`)
    msg.channel.createMessage(`Colored the role ${role.name} with the value \`${hex}\`!`)
  }
}

exports.Commands = Commands
