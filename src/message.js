module.exports = class Message {
  constructor (from, to, body, type = null, channel = null) {
    this.from = from
    this.to = to
    this.body = body
    this.type = type
    this.channel = channel
    this.timeStamp = new Date()
  }
}
