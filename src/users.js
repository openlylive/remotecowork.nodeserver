module.exports = class Users {
  constructor (users) {
    this.users = users
  }

  addOrUpdate (newUser) {
    var user = this.getUserByName(newUser.name)
    if (!user) {
      console.log(`add`)
      this.add(newUser)
    } else {
      console.log(`update`)
      this.updateUsers(user.name, newUser)
    }
  }

  add (user) {
    // if (this.nameIsAvailable(user)) {
    console.log('users ' + JSON.stringify(this.users))
    this.users.push(user)
    console.log('NEW users ' + JSON.stringify(this.users))
    // return true
    // } else return false
  }

  updateUsers (userName, newVals) {
    this.getUserByName(userName).socket = newVals.socket
    this.getUserByName(userName).location = newVals.location
    this.getUserByName(userName).isOffline = newVals.isOffline
  }

  getUserBySocketID (socket) {
    return this.users.find(u => u.socket === socket)
  }

  getUserByName (userName) {
    console.log(`Getting user by name ${userName}`)
    if (userName) {
      return this.users.find(u => u.name && u.name.toLowerCase() === userName.toLowerCase())
    }
  }

  nameIsAvailable (user) {
    return !this.users.some(u => u.name && u.name.toLowerCase() === user.name.toLowerCase())
  }

  delete (user) {
    const index = this.users.findIndex(u => u.name === user.name)
    console.log(`${user.name} had index ${index}`)
    this.users.splice(index, 1)
  }

  isOffline (user) {
    user.isOffline = true
  }
}
