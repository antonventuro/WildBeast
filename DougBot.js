'use strict'
process.title = 'WildBeast'

var Config

try {
  Config = require('./config.json')
} catch (e) {
  console.log('\nWildBeast encountered an error while trying to load the config file, please resolve this issue and restart WildBeast\n\n' + e.message)
  process.exit()
}

var argv = require('minimist')(process.argv.slice(2))
var Logger = require('./runtime/internal/logger.js').Logger

var Eris = require('eris')
var bot
var runtime = require('./runtime/runtime.js')
var timeout = runtime.internal.timeouts
var commands = runtime.commandcontrol.Commands
var aliases = runtime.commandcontrol.Aliases
var datacontrol = runtime.datacontrol
const {PlayerManager} = require('eris-lavalink')

Logger.info('Initializing...')

if (argv.shardmode && !isNaN(argv.maxShards) &&!isNaN(argv.firstShard) && !isNaN(argv.lastShard)) {
  Logger.info('Starting in ShardMode')
  bot = new Eris(Config.bot.token, {
    getAllUsers: true,
    maxShards: argv.maxShards,
    firstShardID: argv.firstShard,
    lastShardID: argv.lastShard,
    restMode: true
  })
} else {
  bot = new Eris(Config.bot.token, {getAllUsers: true, restMode: true})
}

var bugsnag = require('bugsnag')
bugsnag.register(Config.api_keys.bugsnag)

bot.once('ready', () => {
  runtime.internal.versioncheck.versionCheck(function (err, res) {
    if (err) {
      Logger.error('Version check failed, ' + err)
    } else if (res) {
      Logger.info(`Version check: ${res}`)
    }
  })
  Logger.info('Ready to start!', {
    botID: bot.user.id,
    version: require('./package.json').version
  })
  Logger.info(`Logged in as ${bot.user.username}#${bot.user.discriminator} (ID: ${bot.user.id}) and serving ${bot.users.size} users in ${bot.guilds.size} servers.`)
  if (argv.shutdownwhenready) {
    console.log('o okei bai')
    process.exit(0)
  }

  if (!(bot.voiceConnections instanceof PlayerManager)) {
    bot.voiceConnections = new PlayerManager(bot, Config.musicNodes, {
      numShards: bot.shards.size,
      userId: bot.user.id,
      defaultRegion: 'eu'
    })
  }
})

bot.on('messageCreate', msg => {
  if (!bot.ready) return
  if (msg.author.bot || msg.author.id === bot.user.id) {
    return
  }
  datacontrol.users.isKnown(msg.author)
  var prefix
  var guild = msg.channel.guild
  var loggingGuild = {}
  loggingGuild.id = guild.id
  loggingGuild.name = guild.name
  loggingGuild.ownerID = guild.ownerID
  loggingGuild.icon = guild.icon
  loggingGuild.splash = guild.splash // Only because doug wants EVERYTHING. We have no realistic use for most of this.
  loggingGuild.roles = guild.roles.size
  loggingGuild.afkChannelID = guild.afkChannelID
  loggingGuild.afkTimeout = guild.afkTimeout
  loggingGuild.verificationLevel = guild.verificationLevel
  loggingGuild.explicitContentFilter = guild.explicitContentFilter
  loggingGuild.region = guild.region
  loggingGuild.memberCount = guild.memberCount

  datacontrol.customize.getGuildData(msg.channel.guild).then(function (g) {
    if (g.customize.prefix === null) {
      prefix = Config.settings.prefix
    } else {
      prefix = g.customize.prefix
    }
    var cmd
    var suffix
    if (msg.content.startsWith(prefix)) {
      cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
      suffix = msg.content.substr(prefix.length).split(' ')
      suffix = suffix.slice(1, suffix.length).join(' ')
    } else if (msg.content.startsWith(bot.user.mention)) {
      cmd = msg.content.substr(bot.user.mention.length + 1).split(' ')[0].toLowerCase()
      suffix = msg.content.substr(bot.user.mention.length).split(' ')
      suffix = suffix.slice(2, suffix.length).join(' ')
    } else if (msg.content.startsWith(`<@!${bot.user.id}>`)) {
      cmd = msg.content.substr(`<@!${bot.user.id}>`.length + 1).split(' ')[0].toLowerCase()
      suffix = msg.content.substr(`<@!${bot.user.id}>`.length).split(' ')
      suffix = suffix.slice(2, suffix.length).join(' ')
    }
    if (cmd === 'help') {
      runtime.commandcontrol.helpHandle(msg, suffix, bot)
    }
    if (aliases.has(cmd)) {
      cmd = aliases.get(cmd)
    }
    if (commands[cmd]) {
      if (typeof commands[cmd] !== 'object') {
        return // ignore JS built-in array functions
      }
      Logger.info(`Executing <${msg.cleanContent}> from ${msg.author.username}`, {
        author: msg.author.username,
        authorID: msg.author.id,
        guild: loggingGuild,
        botID: bot.user.id,
        cmd: cmd,
        shard: guild.shard.id
      })
      if (commands[cmd].level === 'master') {
        if (Config.permissions.master.indexOf(msg.author.id) > -1) {
          try {
            commands[cmd].fn(msg, suffix, bot)
          } catch (e) {
            bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
            Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
              author: msg.author.username,
              authorID: msg.author.id,
              guild: loggingGuild,
              botID: bot.user.id,
              cmd: cmd,
              shard: guild.shard.id,
              error: e
            })
          }
        } else {
          bot.createMessage(msg.channel.id, 'This command is only for the bot owner.')
        }
      } else if (msg.channel.type === 0) {
        datacontrol.permissions.checkLevel(msg, msg.author.id, msg.member.roles).then(r => {
          if (r !== -1) {
            timeout.check(commands[cmd], msg.channel.guild.id, msg.author.id).then(t => {
              if (t !== true) {
                if (g.customize.timeout === null || g.customize.timeout === 'default') {
                  bot.createMessage(msg.channel.id, `Wait ${Math.round(t)} more seconds before using that again.`)
                } else {
                  bot.createMessage(msg.channel.id, g.customize.timeout.replace(/%user/g, msg.author.mention).replace(/%server/g, msg.channel.guild.name).replace(/%channel/, msg.channel.name).replace(/%timeout/, Math.round(t)))
                }
              } else {
                if (r >= commands[cmd].level) {
                  if (!commands[cmd].hasOwnProperty('nsfw')) {
                    try {
                      commands[cmd].fn(msg, suffix, bot)
                    } catch (e) {
                      bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                      Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
                        author: msg.author.username,
                        authorID: msg.author.id,
                        guild: loggingGuild,
                        botID: bot.user.id,
                        cmd: cmd,
                        shard: guild.shard.id,
                        error: e
                      })
                    }
                  } else {
                    if (msg.channel.nsfw === true) {
                      try {
                        commands[cmd].fn(msg, suffix, bot)
                      } catch (e) {
                        bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                        Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
                          author: msg.author.username,
                          authorID: msg.author.id,
                          guild: loggingGuild,
                          botID: bot.user.id,
                          cmd: cmd,
                          shard: guild.shard.id,
                          error: e
                        })
                      }
                    } else {
                      if (g.customize.nsfw === null || g.customize.nsfw === 'default') {
                        bot.createMessage(msg.channel.id, 'This channel does not allow NSFW commands, enable them by setting this channel to NSFW')
                      } else {
                        bot.createMessage(msg.channel.id, g.customize.nsfw.replace(/%user/g, msg.author.mention).replace(/%server/g, msg.guild.name).replace(/%channel/, msg.channel.name))
                      }
                    }
                  }
                } else {
                  if (g.customize.perms === null || g.customize.perms === 'default') {
                    if (r > -1 && !commands[cmd].hidden) {
                      var reason = (r > 4) ? '**This is a master user only command**, ask the bot owner to add you as a master user if you really think you should be able to use this command.' : 'Ask the server owner to modify your level with `setlevel`.'
                      bot.createMessage(msg.channel.id, 'You have no permission to run this command!\nYou need level ' + commands[cmd].level + ', you have level ' + r + '\n' + reason)
                    }
                  } else {
                    bot.createMessage(msg.channel.id, g.customize.perms.replace(/%user/g, msg.author.mention).replace(/%server/g, msg.channel.guild.name).replace(/%channel/, msg.channel.name).replace(/%nlevel/, commands[cmd].level).replace(/%ulevel/, r))
                  }
                }
              }
            })
          }
        }).catch(function (e) {
          Logger.error('Permission error: ' + e, {
            author: msg.author.username,
            authorID: msg.author.id,
            guild: loggingGuild,
            botID: bot.user.id,
            cmd: cmd,
            shard: guild.shard.id,
            error: e
          })
        })
      } else {
        if (commands[cmd].noDM) {
          bot.createMessage(msg.channel.id, 'This command cannot be used in DM, invite the bot to a server and try this command again.')
        } else {
          datacontrol.permissions.checkLevel(msg, msg.author.id, []).then(function (r) {
            if (r !== -1 && r >= commands[cmd].level) {
              try {
                commands[cmd].fn(msg, suffix, bot)
              } catch (e) {
                bot.createMessage(msg.channel.id, 'An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`)
              }
            } else {
              if (r === -1) {
                bot.createMessage(msg.channel.id, 'You have been blacklisted from using this bot, for more help contact my developers.')
              } else {
                bot.createMessage(msg.channel.id, 'You have no permission to run this command in DM, you probably tried to use restricted commands that are either for master users only or only for server owners.')
              }
            }
          }).catch(function (e) {
            Logger.error('Permission error: ' + e, {
              author: msg.author.username,
              authorID: msg.author.id,
              guild: loggingGuild,
              botID: bot.user.id,
              cmd: cmd,
              shard: guild.shard.id,
              error: e
            })
          })
        }
      }
    }
  }).catch(function (e) {
    if (e.msg === 'None of the pools have an opened connection and failed to open a new one') {
      Logger.warn('RethinkDB server is not running or I could not connect, process will now exit.')
      process.exit(1)
    } else {
      Logger.error('Prefix error: ' + e.stack, {
        author: msg.author.username,
        authorID: msg.author.id,
        guild: loggingGuild,
        botID: bot.user.id,
        shard: guild.shard.id,
        error: e
      })
    }
  })
})

/* This will remain commented out due to customize needing a welcomechannel method
bot.Dispatcher.on(Event.GUILD_MEMBER_ADD, function (s) {
  datacontrol.permissions.isKnown(s.guild)
  datacontrol.customize.isKnown(s.guild)
  datacontrol.customize.check(s.guild).then((r) => {
    if (r === 'on' || r === 'channel') {
      datacontrol.customize.reply(s, 'welcomeMessage').then((x) => {
        if (x === null || x === 'default') {
          s.guild.generalChannel.sendMessage(`Welcome ${s.member.username} to ${s.guild.name}!`)
        } else {
          s.guild.generalChannel.sendMessage(x.replace(/%user/g, s.member.mention).replace(/%server/g, s.guild.name))
        }
      }).catch((e) => {
        Logger.error(e)
      })
    } else if (r === 'private') {
      datacontrol.customize.reply(s, 'welcomeMessage').then((x) => {
        if (x === null || x === 'default') {
          s.member.openDM().then((g) => g.sendMessage(`Welcome to ${s.guild.name}! Please enjoy your stay!`))
        } else {
          s.member.openDM().then((g) => g.sendMessage(x.replace(/%user/g, s.member.mention).replace(/%server/g, s.guild.name)))
        }
      }).catch((e) => {
        Logger.error(e)
      })
    }
  }).catch((e) => {
    Logger.error(e)
  })
  datacontrol.users.isKnown(s.member)
})
*/

bot.on('guildCreate', function (guild) {
  datacontrol.permissions.isKnown(guild)
  datacontrol.customize.isKnown(guild)
})

bot.on('guildUpdate', (newGuild, oldGuild) => {
  if (newGuild.ownerID !== oldGuild.ownerID) {
    datacontrol.permissions.updateGuildOwner(newGuild)
  }
})

bot.on('shardResume', function () {
  Logger.info('Connection to the Discord gateway has been resumed.')
})

bot.on('userUpdate', (newUser, oldUser) => {
  datacontrol.users.isKnown(newUser).then(() => {
    if (newUser.username !== oldUser.username) {
      datacontrol.users.namechange(newUser).catch((e) => {
        Logger.error(e)
      })
    }
  })
})

bot.on('shardDisconnect', function (error, id) {
  Logger.error(`Shard ${id} disconnected from the Discord gateway`, error)
  Logger.info('Trying to login again...')
})

// bot.onAny((type, data) => { TODO: Find equivalent
//   if (data.type === 'READY' || type === 'VOICE_CHANNEL_JOIN' || type === 'VOICE_CHANNEL_LEAVE' || type.indexOf('VOICE_USER') === 0 || type === 'PRESENCE_UPDATE' || type === 'TYPING_START' || type === 'GATEWAY_DISPATCH') return
//   Bezerk.emit(type, data, bot)
// })

process.on('unhandledRejection', (reason, p) => {
  if (p !== null && reason !== null) {
    bugsnag.notify(new Error(`Unhandled promise: ${require('util').inspect(p, {depth: 3})}: ${reason}`))
  }
})

bot.connect()
