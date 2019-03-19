module.exports = class Users {
  constructor (name, location, socket, publicKey) {
    this.name = name
    this.location = location
    this.socket = socket
    this.publicKey = publicKey
    this.streams = {}
  }
}
