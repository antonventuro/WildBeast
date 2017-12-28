'use strict'
var v = require('../internal/voice.js')
var checkLevel = require('../databases/permissions.js').checkLevel
var Commands = []

Commands.voice = {
  name: 'voice',
  help: 'I\'ll join a voice channel!',
  aliases: ['join-voice'],
  noDM: true,
  timeout: 10,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.join(msg, suffix, bot)
  }
}

Commands['leave-voice'] = {
  name: 'leave-voice',
  aliases: ['stop'],
  help: 'I\'ll leave the current voice channel.',
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.leave(msg, bot)
  }
}

Commands.volume = {
  name: 'volume',
  help: 'I\'ll change my volume or return the current volume if you don\'t provide a number!',
  usage: '<nothing/number>',
  aliases: ['vol'],
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.volume(msg, suffix, bot)
  }
}

Commands.pause = {
  name: 'pause',
  help: 'I\'ll pause the music, may be temporary!',
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.pause(msg, bot)
  }
}

Commands.resume = {
  name: 'resume',
  help: 'I\'ll resume the music.',
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.resume(msg, bot)
  }
}

Commands.skip = {
  name: 'skip',
  help: 'I\'ll skip this song if you don\'t like it.',
  noDM: true,
  level: 2,
  fn: function (msg, suffix, bot) {
    v.skip(msg, bot)
  }
}

Commands.voteskip = {
  name: 'voteskip',
  help: 'Vote to skip the current playing song.',
  noDM: true,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.voteSkip(msg, bot)
  }
}

Commands.shuffle = {
  name: 'shuffle',
  help: 'Shuffle the current playlist.',
  noDM: true,
  level: 2,
  fn: function (msg, suffix, bot) {
    v.shuffle(msg, bot)
  }
}

Commands.playlist = {
  name: 'playlist',
  help: 'Use remove and a song number to remove it from the list, clear to empty the queue else I will fetch you the queue I\'m currently playing!',
  usage: '<nothing> or <remove number> or <clear>',
  aliases: ['list'],
  noDM: true,
  timeout: 5,
  level: 0,
  fn: function (msg, suffix, bot) {
    suffix = suffix.toLowerCase().split(' ')
    if (['clear', 'remove'].includes(suffix[0])) {
      checkLevel(msg, msg.author.id, msg.member.roles).then(x => {
        if (x >= 1) {
          v.manageList(msg, suffix, bot)
        } else {
          msg.channel.createMessage('You do not have the required setlevel for this subcommand, check with the server owner if you should be allowed to do this, required level is 1 or higher.')
        }
      })
    } else {
      v.fetchList(msg, bot)
    }
  }
}

Commands.time = {
  name: 'time',
  aliases: ['timeleft', 'nowplaying', 'np'],
  help: 'get the current time / time left of the current track',
  noDM: true,
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.time(msg, bot)
  }
}

Commands.search = {
  name: 'search',
  help: 'Use this to search for songs on youtube',
  noDM: true,
  usage: 'keywords to search youtube',
  timeout: 10,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.search(msg, suffix, bot)
  }
}

Commands.request = {
  name: 'request',
  help: 'Use this to request songs!',
  aliases: ['queue'],
  noDM: true,
  usage: 'link or keywords to search youtube',
  timeout: 10,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.request(msg, suffix, bot)
  }
}

exports.Commands = Commands
