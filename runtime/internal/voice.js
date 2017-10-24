'use strict'
let config = require('../../config.json')
let info = {}
let superagent = require('superagent')
let url = require('url')
let customize = require('../databases/controllers/customize.js')
let prefixRegex = /([~*_])/g
let reactions = {
  '1⃣': 0,
  '2⃣': 1,
  '3⃣': 2,
  '4⃣': 3,
  '5⃣': 4,
  '❌': 'cancel'
}

// TODO: Proper error messages everywhere and finish adding whatever's not added.
// TODO: Something to track how many voice connections are active, Bezerk?

exports.join = function (msg, suffix, bot) {
  // TODO: Make a function that creates the join message so we don't have a hundred line export.
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    if (msg.channel.guild.channels.filter(c => c.type === 2).length === 0) {
      msg.channel.createMessage(`${msg.author.mention}, sorry pal but there are no voice channels I can join.`)
    } else {
      let voiceChan = msg.channel.guild.channels.find(c => c.id === msg.channel.guild.members.find(m => m.id === msg.author.id).voiceState.channelID)
      if (!voiceChan) {
        msg.channel.createMessage(`${msg.author.mention}, join a voice channel before using this command again.`)
      } else {
        customize.getGuildData(msg.channel.guild).then(g => {
          let prefix = g.customize.prefix !== null ? g.customize.prefix.replace(prefixRegex, '\$1') : config.settings.prefix.replace(prefixRegex, '\$1')
          if (suffix) {
            if (url.parse(suffix).host === null) {
              resolveTracks(config.musicNodes[0], `ytsearch:${encodeURI(suffix)}`).then(tracks => {
                if (tracks.length === 0) {
                  msg.channel.createMessage(`No tracks found.`)
                } else {
                  getPlayer(bot, voiceChan).then(() => {
                    msg.channel.createMessage(makeJoinMessage(prefix, voiceChan.name))
                    makeGuildInfo(msg, bot, voiceChan, [tracks[0]])
                  })
                }
              })
            } else {
              resolveTracks(config.musicNodes[0], suffix).then(tracks => {
                if (tracks.length === 0) {
                  msg.channel.createMessage(`No tracks found.`)
                } else {
                  getPlayer(bot, voiceChan).then(() => {
                    msg.channel.createMessage(makeJoinMessage(prefix, voiceChan.name))
                    makeGuildInfo(msg, bot, voiceChan, tracks)
                  })
                }
              })
            }
          } else {
            getPlayer(bot, voiceChan).then(() => {
              msg.channel.createMessage(makeJoinMessage(prefix, voiceChan.name))
              makeGuildInfo(msg, bot, voiceChan)
            })
          }
        })
      }
    }
  } else {
    msg.channel.createMessage(`${msg.author.mention}, I am already streaming in this guild.`)
  }
}

exports.leave = function (msg, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention}, sorry but i am not in voice.`)
  } else {
    getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
      player.stop()
      player.disconnect()
      delete info[msg.channel.guild.id]
      info[msg.channel.guild.id] = undefined
    }).catch(err => {
      console.log(err)
    })
  }
}

exports.volume = function (msg, suffix, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention}, sorry but i am not in voice.`)
  } else {
    if (!suffix) {
      msg.channel.createMessage(`${msg.author.mention}, the volume is currently ${info[msg.channel.guild.id].volume !== undefined ? info[msg.channel.guild.id].volume : '100'}`)
    } else if (isNaN(suffix)) {
      msg.channel.createMessage(`${msg.author.mention}, use a number between 0-100`)
    } else {
      getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
        player.setVolume(suffix)
        info[msg.channel.guild.id].volume = suffix
        msg.channel.createMessage(`${msg.author.mention}, the volume is now set to ${suffix}`)
      }).catch(err => {
        console.log(err)
      })
    }
  }
}

exports.pause = function (msg, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention} I am not streaming in this guild.`)
  } else {
    if (info[msg.channel.guild.id].paused === false) {
      getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
        player.setPause(true)
      })
      info[msg.channel.guild.id].paused = true
      msg.channel.createMessage(`The music is now paused.`)
      if (config.settings.leaveAfterPause) {
        info[msg.channel.guild.id].pauseTimeout = setTimeout(function () {
          exports.leave(msg, bot)
        }, 300000) // 300000 for 5 minutes
      }
    } else {
      msg.channel.createMessage(`The music is already paused.`)
    }
  }
}

exports.resume = function (msg, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention} I am not streaming in this guild.`)
  } else {
    if (info[msg.channel.guild.id].paused === false) {
      msg.channel.createMessage(`The music is not paused.`)
    } else {
      getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
        player.setPause(false)
      })
      info[msg.channel.guild.id].paused = false
      msg.channel.createMessage(`The music has been resumed`)
      if (info[msg.channel.guild.id].pauseTimeout !== undefined) {
        clearTimeout(info[msg.channel.guild.id].pauseTimeout)
      }
    }
  }
}

exports.skip = function (msg, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention} I am not streaming in this guild.`)
  } else {
    if (info[msg.channel.guild.id].track.length <= 1) {
      if (config.settings.leaveAfterPlaylistEnd) {
        getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
          player.stop()
          player.disconnect()
          delete info[msg.channel.guild.id]
          info[msg.channel.guild.id] = undefined
        })
        msg.channel.createMessage(`The playlist has ended, leaving voice.`)
      } else {
        info[msg.channel.guild.id].track = []
        info[msg.channel.guild.id].title = []
        info[msg.channel.guild.id].length = []
        info[msg.channel.guild.id].requester = []
        info[msg.channel.guild.id].skips = {count: 0, users: []}
        getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
          player.stop()
        })
        msg.channel.createMessage(`The playlist has ended, add more tracks with request.`)
      }
    } else {
      info[msg.channel.guild.id].track.shift()
      info[msg.channel.guild.id].title.shift()
      info[msg.channel.guild.id].length.shift()
      info[msg.channel.guild.id].requester.shift()
      info[msg.channel.guild.id].skips = {count: 0, users: []}
      getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
        if (player.playing) {
          player.stop()
        }
      })
      msg.channel.createMessage(`Now playing ${info[msg.channel.guild.id].title[0]} [${hhMMss(info[msg.channel.guild.id].length[0] / 1000)}] requested by ${msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]) !== null ? msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).nick !== null ? msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).nick : msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).user.username : info[msg.channel.guild.id].requester[0]}`)
      play(msg, bot)
    }
  }
}

exports.voteSkip = function (msg, bot) {
  // TODO: Make this elemayo, create an event listener so if someone leaves they are removed from the list
}

exports.time = function (msg, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention} I am not streaming in this guild.`)
  } else {
    getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
      if (player.playing) {
        let user = msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]) !== null ? msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).nick !== null ? msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).nick : msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).user.username : info[msg.channel.guild.id].requester[0]
        msg.channel.createMessage(`**Current song:** _${info[msg.channel.guild.id].title[0]}_\n**Requested by:** _${user}_\n:arrow_forward: ${progressBar(Math.round((player.getTimestamp() / info[msg.channel.guild.id].length[0]) * 9))} **[${hhMMss(player.getTimestamp() / 1000)}/${hhMMss(info[msg.channel.guild.id].length[0] / 1000)}]**`)
      }
    })
  }
}

exports.fetchList = function (msg) {
  // TODO: MOVE THE COMMAND LOGIC TO HERE
  return new Promise((resolve, reject) => {
    if (info[msg.channel.guild.id] && info[msg.channel.guild.id].track.length >= 1) {
      return resolve(info[msg.channel.guild.id])
    } else {
      return reject()
    }
  })
}

exports.shuffle = function (msg) {
  // TODO: MAKE IT!
  // TODO: The function for this is in WildBeats.
}

exports.plreq = function (msg, suffix, bot) {
  var link = url.parse(suffix)
  var query = require('querystring').parse(link)
  console.log(query)
  resolveTracks(config.musicNodes[0], suffix).then(tracks => {
    console.log(tracks)
  })
}

exports.testreq = function (msg, suffix, bot) {
  if (url.parse(suffix).host === null) {
    resolveTracks(config.musicNodes[0], `ytsearch:${suffix}`).then(tracks => {
      if (tracks.length === 0) {
        msg.channel.createMessage('no tracks lul')
      } else {
        let titles = tracks.splice(0, 5).map(t => `${t.info.title.indexOf}: ${t.info.title}`)
        msg.channel.createMessage(titles)
      }
    })
  } else {
    resolveTracks(config.musicNodes[0], suffix).then(tracks => {
      if (tracks.length === 0) {
        msg.channel.createMessage('no tracks lul')
      } else {
        let titles = tracks.splice(0, 5).map(t => `${t.info.title.indexOf}: ${t.info.title}`)
        msg.channel.createMessage(titles)
      }
    })
  }
}

exports.search = function (msg, suffix, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention}, sorry but i am not in voice.`)
  } else if (!suffix) {
    msg.channel.createMessage(`<@${msg.author.id}>, Please enter something to search for!`)
  } else {
    resolveTracks(config.musicNodes[0], `ytsearch:${suffix}`).then(tracks => {
      if (tracks.length === 0) {
        msg.channel.createMessage('no tracks lul')
      } else {
        react(msg, bot, tracks)
      }
    }).catch(err => {
      console.log(err)
    })
  }
}

exports.request = function (msg, suffix, bot) {
  let chan = bot.voiceConnections.find(vc => vc.guildId === msg.channel.guild.id)
  if (!chan) {
    msg.channel.createMessage(`${msg.author.mention}, sorry but i am not in voice.`)
  } else if (!suffix) {
    msg.channel.createMessage(`<@${msg.author.id}>, Please enter something to search for!`)
  } else {
    if (url.parse(suffix).host === null) {
      resolveTracks(config.musicNodes[0], `ytsearch:${encodeURI(suffix)}`).then(tracks => {
        if (tracks.length === 0) {
          msg.channel.createMessage(`${msg.author.mention}, sorry but i could not find any tracks with those keywords`)
        } else {
          addTracks(msg, bot, [tracks[0]])
        }
      }).catch(err => {
        console.error(err)
      })
    } else {
      // TODO: Maybe fix youtube watch?v=ID&list=smth or throw an error, probably throw.
      resolveTracks(config.musicNodes[0], suffix).then(tracks => {
        if (tracks.length === 0) {
          msg.channel.createMessage(`${msg.author.mention}, sorry but i could not fetch that`)
        } else {
          if (tracks.length === 1) {
            addTracks(msg, bot, [tracks[0]])
          } else {
            addTracks(msg, bot, tracks)
          }
        }
      }).catch(err => {
        console.error(err)
      })
    }
  }
}

function play (msg, bot) {
  getPlayer(bot, info[msg.channel.guild.id].channel).then(player => {
    player.play(info[msg.channel.guild.id].track[0])

    player.once('disconnect', (err) => {
      if (err) {
        console.error(err)
      }
      // do something
    })

    player.once('error', err => {
      if (err) {
        console.error(err)
      }
      // log error and handle it
    })

    player.once('stuck', msg => {
      if (msg) {
        console.error(msg)
      }
      // track stuck event
    })

    player.once('end', data => {
      if (data.reason && data.reason === 'REPLACED' || data.reason && data.reason === 'STOPPED') {
        console.log(`track ended with reason ${data.reason}`)
        return
      } else {
        if (info[msg.channel.guild.id].track.length <= 1) {
          if (config.settings.leaveAfterPlaylistEnd) {
            msg.channel.createMessage(`The playlist has ended, leaving voice.`)
            player.disconnect()
            delete info[msg.channel.guild.id]
            info[msg.channel.guild.id] = undefined
          } else {
            msg.channel.createMessage(`The playlist has ended, add more tracks with request.`)
            info[msg.channel.guild.id].track = []
            info[msg.channel.guild.id].title = []
            info[msg.channel.guild.id].length = []
            info[msg.channel.guild.id].requester = []
            info[msg.channel.guild.id].skips = {count: 0, users: []}
          }
        } else {
          info[msg.channel.guild.id].track.shift()
          info[msg.channel.guild.id].title.shift()
          info[msg.channel.guild.id].length.shift()
          info[msg.channel.guild.id].requester.shift()
          info[msg.channel.guild.id].skips = {count: 0, users: []}
          let user = msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]) !== null ? msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).nick !== null ? msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).nick : msg.channel.guild.members.get(info[msg.channel.guild.id].requester[0]).user.username : info[msg.channel.guild.id].requester[0]
          msg.channel.createMessage(`Now playing ${info[msg.channel.guild.id].title[0]} [${hhMMss(info[msg.channel.guild.id].length[0] / 1000)}] requested by ${user}`)
          play(msg, bot)
        }
      }
    })
  })
}

exports.getPlayer = getPlayer

function makeJoinMessage (prefix, channel) {
  let resp = ''
  resp += `I've joined voice channel **${channel}**.\n`
  resp += `You have one minute to request something.\n`
  resp += `__**Voice Commands**__\n`
  resp += `**${prefix}request** - *Request a song via a youtube or soundcloud link, or use keywords to add the first result from youtube.*\n`
  resp += `**${prefix}search** - *Search youtube with keywords*\n`
  resp += `**${prefix}voteskip** - *Vote to skip the current song.*\n`
  resp += `**${prefix}skip** - *Force skip the current song.*\n`
  resp += `**${prefix}pause** - *Pauses the current song.*\n`
  resp += `**${prefix}resume** - *Resumes the current song.*\n`
  resp += `**${prefix}volume** - *Change the volume of the current song.*\n`
  resp += `**${prefix}playlist** - *List upcoming requested songs.*\n`
  resp += `**${prefix}shuffle** - *Shuffle the music playlist.*\n`
  resp += `**${prefix}leave-voice** - *Leaves the voice channel.*`
  return resp
}

function makeGuildInfo (msg, bot, voiceChan, tracks) {
  info[msg.channel.guild.id] = {
    channel: voiceChan,
    track: [],
    title: [],
    length: [],
    requester: [],
    volume: undefined,
    paused: false,
    skips: {count: 0, users: []}
  }
  if (tracks) {
    addTracks(msg, bot, tracks)
  }
}

function addTracks (msg, bot, tracks) {
  if (tracks.length > 1) {
    safeLoop(msg, bot, tracks)
  } else {
    if (info[msg.channel.guild.id].track.length === 0) {
      info[msg.channel.guild.id].track.push(tracks[0].track)
      info[msg.channel.guild.id].title.push(tracks[0].info.title)
      info[msg.channel.guild.id].length.push(tracks[0].info.length)
      info[msg.channel.guild.id].requester.push(msg.author.id)
      msg.channel.createMessage(`Now playing ${tracks[0].info.title} [${hhMMss(tracks[0].info.length / 1000)}] requested by ${msg.member !== null ? msg.member.nick !== null ? msg.member.nick : msg.author.username : msg.author.id}`)
      play(msg, bot)
    } else {
      info[msg.channel.guild.id].track.push(tracks[0].track)
      info[msg.channel.guild.id].title.push(tracks[0].info.title)
      info[msg.channel.guild.id].length.push(tracks[0].info.length)
      info[msg.channel.guild.id].requester.push(msg.author.id)
      msg.channel.createMessage(`Added track ${tracks[0].info.title} [${hhMMss(tracks[0].info.length / 1000)}] to the queue by request of ${msg.member !== null ? msg.member.nick !== null ? msg.member.nick : msg.author.username : msg.author.id}.`)
    }
  }
}

function react (msg, bot, tracks) {
  //TODO: EMBED THIS!!
  let titles = tracks.slice(0, 5).map((t, index) => `${index + 1}: ${t.info.title} [${hhMMss(t.info.length / 1000)}]`)
  if (msg.channel.permissionsOf(bot.user.id).has('addReactions')) {
    msg.channel.createMessage(`${titles.join('\n')}\nPlease pick one using 1-5 or use :x: to cancel`).then(ms => {
      ms.addReaction('1⃣')
      ms.addReaction('2⃣')
      ms.addReaction('3⃣')
      ms.addReaction('4⃣')
      ms.addReaction('5⃣')
      ms.addReaction('❌').then(() => {
        bot.on('messageReactionAdd', function pick (m, emoji, user) {
          if (m.channel.id === msg.channel.id && user === msg.author.id) {
            if (reactions[emoji.name] !== 'cancel') {
              ms.edit(`You picked ${titles[reactions[emoji.name]]} to play`).then(() => {
                setTimeout(() => {
                  ms.delete()
                }, 5000)
              })
              addTracks(msg, bot, [tracks[reactions[emoji.name]]])
              bot.removeListener('messageReactionAdd', pick)
            } else if (reactions[emoji.name] === 'cancel') {
              ms.edit(`Cancelling request.`).then(() => {
                setTimeout(() => {
                  ms.delete()
                }, 3000)
              })
              bot.removeListener('messageReactionAdd', pick)
            }
          }
        })
      })
    }).catch(console.log)
  } else {
    msg.channel.createMessage(`${titles.join('\n')}\nPlease pick one by replying 1-5 or cancel`).then(ms => {
      bot.on('messageCreate', function pick (m) {
        if (m.channel.id === msg.channel.id && m.author.id === msg.author.id) {
          if (!isNaN(m.content) || m.content >= 0 || m.content <= 5) {
            ms.edit(`You picked ${titles[m.content - 1]} to play`).then(() => {
              setTimeout(() => {
                ms.delete()
              }, 5000)
            })
            addTracks(msg, bot, [tracks[m.content - 1]])
            bot.removeListener('messageCreate', pick)
          } else if (m.content.toLowerCase() === 'cancel') {
            ms.edit(`Cancelling request.`).then(() => {
              setTimeout(() => {
                ms.delete()
              }, 3000)
            })
            bot.removeListener('messageCreate', pick)
          }
        }
      })
    }).catch(console.log)
  }
}

function getPlayer (bot, channel) {
  if (!channel || !channel.guild) {
    return Promise.reject('Not a guild channel.')
  }

  let player = bot.voiceConnections.get(channel.guild.id)
  if (player) {
    return Promise.resolve(player)
  }

  let options = {}
  if (channel.guild.region) {
    options.region = channel.guild.region
  }

  return bot.voiceConnections.join(channel.guild.id, channel.id, options)
}

function resolveTracks (node, search) {
  return new Promise((resolve, reject) => {
    superagent.get(`http://${node.host}:2333/loadtracks?identifier=${search}`)
      .set('Authorization', node.password)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(res.body)
        }
      })
  })
}

function safeLoop (msg, bot, tracks) {
  if (tracks.length === 0) {
    msg.channel.createMessage('Done fetching that playlist')
  } else {
    if (info[msg.channel.guild.id].track.length === 0) {
      info[msg.channel.guild.id].track.push(tracks[0].track)
      info[msg.channel.guild.id].title.push(tracks[0].info.title)
      info[msg.channel.guild.id].length.push(tracks[0].info.length)
      info[msg.channel.guild.id].requester.push(msg.author.id)
      msg.channel.createMessage(`Auto playing ${tracks[0].info.title} [${hhMMss(tracks[0].info.length / 1000)}]`)
      play(msg, bot)
      tracks.shift()
      safeLoop(msg, bot, tracks)
    } else {
      info[msg.channel.guild.id].track.push(tracks[0].track)
      info[msg.channel.guild.id].title.push(tracks[0].info.title)
      info[msg.channel.guild.id].length.push(tracks[0].info.length)
      info[msg.channel.guild.id].requester.push(msg.author.id)
      tracks.shift()
      safeLoop(msg, bot, tracks)
    }
  }
}

function hhMMss (time) {
  if (time !== undefined || isNaN(time)) {
    let hours = (Math.floor(time / ((60 * 60)) % 24))
    let minutes = (Math.floor(time / (60)) % 60)
    let seconds = (Math.floor(time) % 60)
    let parsedTime = []
    hours >= 1 ? parsedTime.push(hours) : null
    minutes >= 10 ? parsedTime.push(minutes) : parsedTime.push(`0${minutes}`)
    seconds >= 10 ? parsedTime.push(seconds) : parsedTime.push(`0${seconds}`)
    return parsedTime.join(':')
  } else {
    return '00:00:00'
  }
}

exports.hhMMss = hhMMss

function progressBar (percent) {
  let str = ''
  for (let i = 0; i < 9; i++) {
    if (i === percent)
      str += '\uD83D\uDD18'
    else
      str += '▬'
  }
  return str
}
