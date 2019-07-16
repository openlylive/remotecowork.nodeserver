module.exports = class Message {
  constructor (from, to, body, type = null, teamName = null) {
    this.from = from
    this.to = to
    this.body = body
    this.type = type
    this.timeStamp = new Date(),
    this.teamName = teamName
  }
}
