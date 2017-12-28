module.exports = {
  help: 'I\'ll reply to you with pong!',
  timeout: 10,
  aliases: ['pang'],
  level: 0,
  fn: function (msg) {
    msg.channel.createMessage(`Pong! \nLatency: ${msg.channel.guild.shard.latency} ms.`)
  }
}