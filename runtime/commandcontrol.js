var bugsnag = require('bugsnag')
var config = require('../config.json')
bugsnag.register(config.api_keys.bugsnag)
var Logger = require('./internal/logger.js').Logger

const commands = require('./commands/index')
let alias = new Map()

for (let x in commands) {
  if (commands[x].aliases) {
    for (let y of commands[x].aliases) {
      alias.set(y, x)
    }
  }
}

exports.helpHandle = function (msg, suffix) {
  var sorts = {
    0: [
      '[Available commands]\n'
    ]
  }
  let counter = 0
  if (!suffix) {
    for (var index in commands) {
      if (!commands[index].hidden && commands[index].level !== 'master') {
        if (sorts[counter].join('\n').length > 1750) {
          counter++
          sorts[counter] = []
        }
        sorts[counter].push(index + ' = "' + commands[index].help + '"')
      }
    }
    var misc = [
      'If you want more information on the commands, check the command reference at http://docs.thesharks.xyz/commands.',
      'For further questions, join our server: discord.gg/wildbot',
      'Like what we do? Consider supportingmy developer at Patreon! <https://www.patreon.com/Dougley>'
    ]
    msg.author.getDMChannel().then((y) => {
      if (msg.channel.guild) {
        msg.channel.createMessage('Help is underway ' + msg.author.mention + '!')
      }
      for (var r in sorts) {
        y.createMessage(`\`\`\`ini\n${sorts[r].sort().join('\n')}\n\`\`\``) // FIXME: The entire commands array should sort instead of the sorts one
      }
      y.createMessage(misc.join('\n'))
    }).catch((e) => {
      Logger.error(e)
      msg.channel.createMessage('Well, this is awkward, something went wrong while trying to PM you. Do you have them enabled on this server?')
    })
  } else if (suffix) {
    if (commands[suffix] || alias.has(suffix)) {
      var c = (commands[suffix]) ? commands[suffix] : commands[alias.get(suffix)]
      var attributes = []
      var name
      for (var x in commands) {
        if (commands[x] === c) {
          name = x
          break
        }
      }
      var def = [
        `Command name: \`${name}\``,
        `What this does: \`${c.help}\``,
        'Example:',
        '```',
        `${(c.usage) ? config.settings.prefix + name + ' ' + c.usage : config.settings.prefix + name}`,
        '```',
        `**Required access level**: ${c.level}`,
        `${(c.aliases) ? '**Aliases for this command**: ' + c.aliases.join(', ') + '\n' : ''}`
      ]
      for (var attribute in c) {
        switch (attribute) {
          case 'noDM': {
            if (c[attribute] === true) attributes.push('*This command cannot be used in DMs.*')
            break
          }
          case 'hidden': {
            if (c[attribute] === true) attributes.push('*This is a hidden command.*')
            break
          }
          case 'nsfw': {
            if (c[attribute] === true) attributes.push('*This command is NSFW*')
            break
          }
          case 'timeout': {
            attributes.push(`*This command has a timeout of ${c.timeout} seconds*`)
            break
          }
        }
      }
      if (name === 'meme') {
        var str = '\n**Currently available memes:\n**'
        var meme = require('./commands/memes.json')
        for (var m in meme) {
          str += m + ', '
        }
        attributes.push(str)
      }
      msg.author.getDMChannel().then((y) => {
        y.createMessage(def.join('\n') + attributes.join('\n'))
      })
    } else {
      msg.channel.createMessage(`There is no **${suffix}** command!`)
    }
  }
}

exports.Commands = commands
exports.Aliases = alias