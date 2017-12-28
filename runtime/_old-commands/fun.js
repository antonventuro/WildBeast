var Commands = []
var Logger = require('../internal/logger.js').Logger
var Giphy = require('../giphy.js')
var config = require('../../config.json')
var request = require('superagent')

Commands.gif = {
  name: 'gif',
  help: 'I\'ll search Giphy for a gif matching your tags.',
  aliases: ['giphy'],
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    var tags = suffix.split(' ')
    Giphy.get_gif(tags, function (id) {
      if (typeof id !== 'undefined') {
        msg.channel.createMessage(`<@${msg.author.id}>, http://media.giphy.com/media/${id}/giphy.gif [Tags: ${tags}]`)
      } else {
        msg.channel.createMessage(`<@${msg.author.id}>, Sorry! Invalid tags, try something else. For example something that exists [Tags: ${tags}]`)
      }
    })
  }
}

Commands.rip = {
  name: 'rip',
  help: 'Posts a ripme.xyz link',
  aliases: ['ripme'],
  level: 0,
  timeout: 10,
  fn: function (msg, suffix, bot) {
    var qs = require('querystring')
    var resolve = []
    var skipped = false
    if (msg.mentions.length > 0) {
      for (var m of msg.mentions) {
        if (m.id !== bot.User.id) {
          if (resolve[0] === undefined) {
            resolve[0] = m.username
          } else {
            resolve[0] += ' and ' + m.username
          }
        } else {
          skipped = true
        }
      }
    } else if (suffix) {
      resolve[0] = suffix
    }
    if (skipped === true && msg.mentions.length === 1 && suffix) {
      resolve[0] = suffix
    }
    msg.channel.createMessage('http://ripme.xyz/' + qs.stringify(resolve).substr(2))
  }
}

Commands.randomcat = {
  name: 'randomcat',
  help: 'I\'ll get a random cat image for you!',
  aliases: ['cat'],
  module: 'fun',
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('http://random.cat/meow')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.file)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.randomdog = {
  name: 'randomdog',
  help: 'I\'ll get a random doggo image for you!',
  aliases: ['doggo'],
  module: 'fun',
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('https://random.dog/woof.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.url)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.dogfact = {
  name: 'dogfact',
  help: 'I\'ll give you some interesting dogfacts!',
  aliases: ['dogfacts'],
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('https://dog-api.kinduff.com/api/facts')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.facts[0])
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.catfact = {
  name: 'catfact',
  help: 'I\'ll give you some interesting catfacts!',
  aliases: ['catfacts'],
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('https://catfact.ninja/fact')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.fact)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.leetspeak = {
  name: 'leetspeak',
  help: '1\'Ll 3nc0d3 Y0uR Me5s@g3 1Nt0 l337sp3@K!',
  aliases: ['leetspeek', 'leetspeach'],
  level: 0,
  fn: function (msg, suffix) {
    if (suffix.length > 0) {
      var leetspeak = require('leetspeak')
      var thing = leetspeak(suffix)
      msg.channel.createMessage(`<@${msg.author.id}>, ${thing}`)
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, *You need to type something to encode your message into l337sp3@K!*`)
    }
  }
}

Commands.stroke = {
  name: 'stroke',
  help: 'I\'ll stroke someones ego!',
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    var name
    if (suffix) {
      name = suffix.split('"')
      if (name.length === 1) {
        name = ['', name]
      }
    } else {
      name = ['Andrei', 'Zbikowski'] // I'm not sorry b1nzy <3
    }
    request.get('http://api.icndb.com/jokes/random')
      .query({escape: 'javascript'})
      .query({firstName: name[0]})
      .query({lastName: name[1]})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.value.joke)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.yomomma = {
  name: 'yomomma',
  help: 'I\'ll get a random yomomma joke for you!',
  timeout: 5,
  level: 0,
  fn: function (msg) {
    request.get('http://api.yomomma.info/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            msg.channel.createMessage('The API returned an unconventional response.')
            return
          }
          var joke = JSON.parse(res.text)
          msg.channel.createMessage(joke.joke)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.advice = {
  name: 'advice',
  help: 'I\'ll give you some fantastic advice!',
  noDM: true,
  timeout: 5,
  level: 0,
  fn: function (msg) {
    request.get('http://api.adviceslip.com/advice')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            msg.channel.createMessage('The API returned an unconventional response.')
            return
          }
          var advice = JSON.parse(res.text)
          msg.channel.createMessage(advice.slip.advice)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.yesno = {
  name: 'yesno',
  help: 'Returns a gif displaying yes or no',
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    request.get('http://yesno.wtf/api/')
      .query({force: suffix})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(`<@${msg.author.id}>, ${res.body.image}`)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.urbandictionary = {
  name: 'urbandictionary',
  help: 'I\'ll fetch what idiots on the internet think something means',
  aliases: ['ud', 'urban'],
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.createMessage(`<@${msg.author.id}>, Yes, let\'s just look up absolutely nothing.`)
    } else {
      request.get('http://api.urbandictionary.com/v0/define')
        .query({term: suffix})
        .end((err, res) => {
          if (!err && res.status === 200) {
            var uD = res.body
            if (uD.result_type !== 'no_results') {
              msg.channel.createMessage({
                embed: {
                  color: 0x6832e3,
                  author: {name: 'UrbanDictionary'},
                  title: `The internet's definition of ${uD.list[0].word}`,
                  url: uD.list[0].permalink,
                  timestamp: new Date(),
                  fields: [
                    {name: 'Word', value: `\`\`\`${uD.list[0].word}\`\`\``},
                    {name: 'Definition', value: `\`\`\`${uD.list[0].definition}\`\`\``},
                    {name: 'Example', value: `\`\`\`${uD.list[0].example}\`\`\``},
                    {name: 'Thumbs up', value: `\`\`\`${uD.list[0].thumbs_up}\`\`\``, inline: true},
                    {name: 'Thumbs down', value: `\`\`\`${uD.list[0].thumbs_down}\`\`\``, inline: true}
                  ]
                }
              })
            } else {
              msg.channel.createMessage(`<@${msg.author.id}>, ${suffix}: This word is so screwed up, even Urban Dictionary doesn't have it in its database`)
            }
          } else {
            Logger.error(`Got an error: ${err}, status code: ${res.status}`)
          }
        })
    }
  }
}

Commands.fact = {
  name: 'fact',
  help: 'I\'ll give you some interesting facts!',
  timeout: 5,
  level: 0,
  fn: function (msg) {
    var xml2js = require('xml2js')
    request.get('http://www.fayd.org/api/fact.xml')
      .end((err, res) => {
        if (err) {
          Logger.error(err)
        }
        if (!err && res.status === 200) {
          xml2js.parseString(res.text, function (err, result) {
            if (err) {
              Logger.error(err)
            }
            try {
              msg.channel.createMessage(`<@${msg.author.id}>, ${result.facts.fact[0]}`)
            } catch (e) {
              msg.channel.createMessage('The API returned an unconventional response.')
            }
          })
        }
      })
  }
}

Commands.dice = {
  name: 'dice',
  help: 'I\'ll roll some dice!',
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    var dice
    if (suffix) {
      dice = suffix
    } else {
      dice = 'd6'
    }
    request.get('https://rolz.org/api/?' + dice + '.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          var roll = res.body
          msg.channel.createMessage(`<@${msg.author.id}>, Your ${roll.input} resulted in ${roll.result}${roll.details}`)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.fancyinsult = {
  name: 'fancyinsult',
  help: 'I\'ll insult your friends!',
  aliases: ['insult'],
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    request.get('http://quandyfactory.com/insult/json/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          var fancyinsult = res.body
          if (suffix === '') {
            msg.channel.createMessage(fancyinsult.insult)
          } else {
            msg.channel.createMessage(suffix + ', ' + fancyinsult.insult)
          }
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.e621 = {
  name: 'e621',
  help: 'e621, the definition of *Stop taking the Internet so seriously.*',
  usage: '<tags> multiword tags need to be typed like: wildbeast_is_a_discord_bot',
  level: 0,
  nsfw: true,
  fn: function (msg, suffix) {
    msg.channel.sendTyping()
    request.post(`https://e621.net/post/index.json`)
      .query({limit: '30', tags: suffix})
      .set({'Accept': 'application/json', 'User-Agent': 'Superagent Node.js'})
      // Fetching 30 posts from E621 with the given tags
      .end(function (err, result) {
        if (!err && result.status === 200) {
          if (result.body.length < 1) {
            msg.channel.createMessage(`<@${msg.author.id}>, Sorry, nothing found.`) // Correct me if it's wrong.
          } else {
            var count = Math.floor((Math.random() * result.body.length))
            var FurryArray = []
            if (suffix) {
              FurryArray.push(`${msg.author.mention}, you've searched for ` + '`' + suffix + '`')
            } else {
              FurryArray.push(`${msg.author.mention}, you've searched for ` + '`random`')
            } // hehe no privacy if you do the nsfw commands now.
            FurryArray.push(result.body[count].file_url)
            msg.channel.createMessage(FurryArray.join('\n'))
          }
        } else {
          Logger.error(`Got an error: ${err}, status code: ${result.status}`)
        }
      })
  }
}

Commands.rule34 = {
  name: 'rule34',
  help: 'Rule#34 : If it exists there is porn of it. If not, start uploading.',
  level: 0,
  nsfw: true,
  fn: function (msg, suffix) {
    msg.channel.sendTyping()
    request.post('http://rule34.xxx/index.php') // Fetching 100 rule34 pics
      .query({page: 'dapi', s: 'post', q: 'index', tags: suffix})
      .end((err, result) => {
        if (err || result.status !== 200) {
          Logger.error(`${err}, status code ${result.status}`)
          msg.channel.createMessage('The API returned an unconventional response.')
        }
        var xml2js = require('xml2js')
        if (result.text.length < 75) {
          msg.channel.createMessage(`<@${msg.author.id}>, sorry, nothing found.`) // Correct me if it's wrong.
        } else {
          xml2js.parseString(result.text, (err, reply) => {
            if (err) {
              msg.channel.createMessage('The API returned an unconventional response.')
            } else {
              var count = Math.floor((Math.random() * reply.posts.post.length))
              var FurryArray = []
              if (!suffix) {
                FurryArray.push(msg.author.mention + ', you\'ve searched for `random`')
              } else {
                FurryArray.push(msg.author.mention + ', you\'ve searched for `' + suffix + '`')
              }
              FurryArray.push(`https:${reply.posts.post[count].$.file_url}`)
              msg.channel.createMessage(FurryArray.join('\n'))
            }
          })
        }
      })
  }
}

Commands.meme = {
  name: 'meme',
  help: 'I\'ll create a meme with your suffixes!',
  timeout: 10,
  usage: '<memetype> "<Upper line>" "<Bottom line>" **Quotes are important!**',
  level: 0,
  fn: function (msg, suffix, bot) {
    var tags = suffix.split('"')
    var memetype = tags[0].split(' ')[0]
    var meme = require('./memes.json')
    var Imgflipper = require('imgflipper')
    var imgflipper = new Imgflipper(config.api_keys.imgflip.username, config.api_keys.imgflip.password)
    imgflipper.generateMeme(meme[memetype], tags[1] ? tags[1] : '', tags[3] ? tags[3] : '', (err, image) => {
      if (err) {
        msg.channel.createMessage(`<@${msg.author.id}>, Please try again, use \`help meme\` if you do not know how to use this command.`)
      } else {
        var user = bot.user
        if (msg.channel.guild) {
          msg.channel.createMessage(image)
        } else if (msg.channel.guild.members.get(user.id).permission.json.manageMessages) {
          msg.delete()
          msg.channel.createMessage(image)
        } else {
          msg.channel.createMessage(image)
        }
      }
    })
  }
}

Commands.xkcd = {
  name: 'xkcd',
  help: 'I\'ll get a XKCD comic for you, you can define a comic number and I\'ll fetch that one.',
  timeout: 10,
  usage: 'Nothing for a random comic, current for latest, number to get that comic.',
  level: 0,
  fn: function (msg, suffix) {
    var xkcdInfo
    request.get('http://xkcd.com/info.0.json')
      .end((error, response) => {
        if (!error && response.status === 200) {
          xkcdInfo = response.body
          if (suffix.toLowerCase() === 'current') {
            msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
          } else if (!suffix) {
            var xkcdRandom = Math.floor(Math.random() * (xkcdInfo.num - 1)) + 1
            request.get(`http://xkcd.com/${xkcdRandom}/info.0.json`)
              .end((error, response) => {
                if (!error && response.status === 200) {
                  xkcdInfo = response.body
                  msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
                } else {
                  msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
                  Logger.error(`Got an error: ${error}, status code: ${response.status}`)
                }
              })
          } else if (!isNaN(parseInt(suffix, 10)) && parseInt(suffix, 10) > 0 && (parseInt(suffix, 10) <= xkcdInfo.num)) {
            request(`http://xkcd.com/${suffix}/info.0.json`)
              .end((error, response) => {
                if (!error && response.status === 200) {
                  xkcdInfo = response.body
                  msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
                } else {
                  msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
                  Logger.error(`Got an error: ${error}, status code: ${response.status}`)
                }
              })
          } else {
            msg.channel.createMessage(`<@${msg.author.id}>, There are only ${xkcdInfo.num} xkcd comics!`)
          }
        } else {
          msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
          Logger.error(`Got an error: ${error}, status code: ${response.status}`)
        }
      })
  }
}

Commands.magic8ball = {
  name: 'magic8ball',
  help: 'I\'ll make a prediction using a Magic 8 Ball',
  aliases: ['8ball'],
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.createMessage(`<@${msg.author.id}>, I mean I can shake this 8ball all I want but without a question it's kinda dumb.`)
      return
    }
    var answers = [
      'Signs point to yes.',
      'Yes.',
      'Reply hazy, try again.',
      'Without a doubt.',
      'My sources say no.',
      'As I see it, yes.',
      'You may rely on it.',
      'Concentrate and ask again.',
      'Outlook not so good.',
      'It is decidedly so.',
      'Better not tell you now.',
      'Very doubtful.',
      'Yes - definitely.',
      'It is certain.',
      'Cannot predict now.',
      'Most likely.',
      'Ask again later.',
      'My reply is no.',
      'Outlook good.',
      'Don\'t count on it.',
      'Who cares?',
      'Never, ever, ever.',
      'Possibly.',
      'There is a small chance.'
    ]
    msg.channel.createMessage('The Magic 8 Ball says:\n```' + answerShuffle(answers)[0] + '```')

    function answerShuffle (array) {
      let rand
      let index = -1
      let length = array.length
      let result = Array(length)
      while (++index < length) {
        rand = Math.floor(Math.random() * (index + 1))
        result[index] = result[rand]
        result[rand] = array[index]
      }
      return (result)
    }
  }
}

Commands.randommeme = {
  name: 'randommeme',
  help: 'I\'ll get a random meme for you!',
  level: '0',
  nsfw: true,
  fn: function (msg) {
    request.get(`https://api.imgur.com/3/g/memes/viral/${Math.floor((Math.random() * 8) + 1)}`) // 20 Memes per page, 160 Memes
      .set('Authorization', 'Client-ID ' + config.api_keys.imgur)
      .end(function (err, result) {
        if (!err && !result.body.data.error) {
          msg.channel.createMessage(result.body.data[Math.floor((Math.random() * 20) + 1)].link)
        } else {
          Logger.error(result.body.data.error)
        }
      })
  }
}

Commands.shorten = {
  name: 'shorten',
  help: 'Shorten an url using goo.gl.',
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    var url = require('url')
    if (suffix.length === 0) {
      msg.channel.createMessage(`<@${msg.author.id}>, Enter an url!`)
      return
    }
    if (url.parse(suffix).hostname) {
      request.post(`https://www.googleapis.com/urlshortener/v1/url`)
        .query({key: config.api_keys.google})
        .send({longUrl: suffix})
        .set('Content-Type', 'application/json')
        .end(function (err, res) {
          if (!err) {
            msg.channel.createMessage(`:link: Shortened URL: **${res.body.id}**`)
          } else {
            Logger.debug(`Got an error: ${err}, status code: ${res.status}`)
          }
        })
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, This is not a valid url.`)
    }
  }
}

exports.Commands = Commands
