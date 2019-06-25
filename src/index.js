
var app = require('express')()
var https = require('https')
var bodyParser = require('body-parser')
var cors = require('cors')
var fs = require('fs')
var path = require('path')

const dns = require('dns')

var Users = require('./users')
var User = require('./user')
var Message = require('./message')
var users = new Users([])

var usedPorts = []
var usedIDs = []
var activeJanusServers = ['co-work.jimber.org']

var delayedMessage = []
var delayedSignal = []

var teams = []

app.use(cors())
app.use(bodyParser.json())
var server = https.createServer({
  key: fs.readFileSync(path.resolve('/certificates/key.pem')),
  cert: fs.readFileSync(path.resolve('/certificates/cert.pem'))
}, app)

server.listen(3000, () => {
  console.log('listening on *:3000')
})

var io = require('socket.io').listen(server)

// GET USER REST
app.route('/users/:name').get((req, res) => {
  console.log(``)
  console.log(`>> users`)

  console.log(JSON.stringify(req.params.name))
  if (!req || !req.params || !req.params.name) res.send(400, 'I didn\'t get a name ')
  var wanted = users.getUserByName(req.params.name)
  if (!wanted) {
    console.log('CANT FIND USER ' + req.params.name)
    res.status(404).send(`I did my best but couldn't find user ${req.params.name}, sorry`)
  } else {
    console.log(wanted)
    res.json({
      name: wanted.name,
      location: wanted.location,
      publicKey: wanted.publicKey
    })
  }

  console.log(`<< users`)
  console.log(``)
})

app.route('/lookup').post((req, res) => {
  console.log(``)
  console.log(`>> lookup`)

  console.log(`Lookup requested for ${req.body.url}`)
  dns.lookup(req.body.url, (err, address) => {
    if (err || !address) res.send(500, 'Something went wrong, don\'t know what')
    else {
      console.log(address)
      res.json({
        ip: address
      })
    }
  })

  console.log(`<< lookup`)
  console.log(``)
})
app.route('/users/:name/streams').put((req, res) => {
  console.log(``)
  console.log(`>> addStreams`)

  var wanted = users.getUserByName(req.params.name)
  if (!wanted) res.send(404, `I looked everywhere but ${req.params.name} wasn't there`)
  if (!req.body || isEmpty(req.body)) res.send(400, `I have no body, only arms and legs`)
  var key = Object.keys(req.body)[0]

  wanted.streams[key] = req.body[key]

  res.send(wanted)

  console.log(`<< addStreams`)
  console.log(``)
})

app.route('/uniquestreaminfo/:location').get(async (req, res) => {
  console.log(``)
  console.log(`>> uniquestreaminfo`)

  if (!req.params.location) res.status(400).body('Where do you want me to search?')
  var response = await getOpenPorts(req.params.location)
  response.id = getFreeId(req.params.location)
  res.send(response)

  console.log(`<< uniquestreaminfo`)
  console.log(``)
})

app.route('/locations').get((req, res) => {
  console.log(``)
  console.log(`>> locations`)

  res.send(activeJanusServers)

  console.log(`<< locations`)
  console.log(``)
})

// CHECK USERNAME REST

io.on('connection', socket => {
  var re = /[^http(s)?:\/\/][^:]*/
  var matches = socket.handshake.headers.origin.match(re)
  if (activeJanusServers.indexOf(matches[0]) === -1) {
    console.log(`adding ${matches[0]} to the locations`)
    activeJanusServers.push(matches[0])
  }
  console.log('Someone connected')
  var user = null
  console.log(socket.id)

  // User fills in username
  socket.on('identify', newUser => {
    console.log(``)
    console.log(`>> identify`)
    user = new User(newUser.name, newUser.location, socket.id, newUser.publicKey)
    console.log(`${new Date()}: ${newUser.name} is connected`)
    console.log(`IDENTIFY ${JSON.stringify(newUser)}`)
    console.log(`IDENTIFY ${JSON.stringify(user)}`)
    users.addOrUpdate(user)
    console.log(`<< identify`)
    console.log(``)
  })

  socket.on('checkTeamName', teamname => {
    console.log(``)
    console.log(`>> checkTeamName`)
    console.log(`Checking team ${teamname}`)
    console.log(teams.some(t => t.name.toLowerCase() === teamname.toLowerCase()))
    if (teams.some(t => t.name.toLowerCase() === teamname.toLowerCase())) {
      socket.emit('teamNameInvalid')
    } else {
      socket.emit('teamNameValid')
    }
    console.log(`<< checkTeamName`)
    console.log(``)
  })

  socket.on('createTeam', data => {
    console.log(``)
    console.log(`>> createTeam`)
    console.log(`CREATING TEAM ${JSON.stringify(data)}`)
    teams.push(data)
    console.log(`Teams are now ${JSON.stringify(teams)}`)
    console.log(`<< createTeam`)
    console.log(``)
  })

  socket.on('addadmin', data => {
    console.log(``)
    console.log(`>> newAdmin`)
    var team = teams.find(t => t.name.toLowerCase() === data.teamname.toLowerCase())
    const me = users.getUserBySocketID(socket.id)
    var newAdmin = users.getUserByName(data.username)
    console.log(`${me.name} tries to make ${newAdmin.name} admin of ${team.name}`)
    if (team && me && newAdmin && team.admins && team.admins.length && team.admins.map(x => x.name.toLowerCase()).includes(me.name.toLowerCase())) {
      console.log(`OK`)
      team.admins.push(newAdmin)
    }
    console.log(`<< newAdmin`)
    console.log(``)
  })

  socket.on('pingAdmins', data => {
    console.log(``)
    console.log(`pingAdmins`)
    teamname = data.teamname;
    admins = getTeamAdmins(teamname);
    multicast(data.username, admins, "ping", "ping")
  });

  socket.on("pongAdminRequest", data => {
    console.log(``)
    console.log(`pongAdminRequest`)
  })


  socket.on('requestSymKey', data => {
    console.log(``)
    console.log(`>> requestSymKey`)
    const me = users.getUserBySocketID(socket.id)
    if (data.teamname && teams && teams.length) {
      var team = teams.find(t => t.name.toLowerCase() === data.teamname.toLowerCase())
      if (team) {
        console.log(`Serching for team ${data.teamname} found ${JSON.stringify({ name: team.name, admins: team.admins.map(x => x.name) })}`)
        console.log(`${me.name} is requesting access to ${data.teamname} to ${JSON.stringify(team.admins.map(x => x.name))}`)
        if (team.admins && team.admins.length && me && !team.admins.some(x => x.name === me.name)) {
          team.admins.filter(x => x.name !== me.name).forEach(admin => {
            const message = new Message(me.name, admin.name, data, 'requestSymKey', null)
            const correspondent = users.getUserByName(message.to)
            if (correspondent && correspondent.isOffline) delayedSignal.push(message)
            else if (correspondent) io.to(correspondent.socket).emit('signal', message)
            else console.log(`Oops... couldn't find correspondent`)
          })
        }
      } else {
        console.log('Something went wong')
      }
    } else {
      console.log(`data.teamname && teams && teams.length is false`)
      console.log(data.teamname)
      console.log(teams)
    }
    console.log(`<< requestSymKey`)
    console.log(``)
  })

  // User sends a message
  socket.on('message', newMessage => {
    console.log(``)
    console.log(`>> message`)
    if (user) {
      const message = new Message(user.name, newMessage.to, newMessage.body, newMessage.type, newMessage.channel)
      console.log(`${message.time}: New message from ${user.name}: ${JSON.stringify(message)}`)
      const correspondent = users.getUserByName(message.to)
      if (correspondent.isOffline) delayedMessage.push(message)
      else io.to(correspondent.socket).emit('message', message)
    }
    console.log(`<< message`)
    console.log(``)
  })
  socket.on('signal', newMessage => {
    console.log(``)
    console.log(`>> signal`)
    if (user) {
      console.log(`============= ${JSON.stringify(user.name)} ======== ${JSON.stringify(newMessage)}`)
      const message = new Message(user.name, newMessage.to, newMessage.body, newMessage.type, newMessage.channel)
      console.log(`New signal from ${JSON.stringify(user.name)}: ${JSON.stringify(message)}`)
      const correspondent = users.getUserByName(message.to)
      console.log(`Found correspondent ${JSON.stringify(correspondent.name)}`)
      if (correspondent) {
        if (correspondent.isOffline) delayedSignal.push(message)
        else io.to(correspondent.socket).emit('signal', message)
      } else {
        console.log('Correspondent is not found?')
      }
    }
    console.log(`<< signal`)
    console.log(``)
  })

  socket.on('disconnect', () => {
    console.log(``)
    console.log(`>> disconnect`)
    if (user) {
      var msg = new Message(user.name, 'everyone', '', 'userDisconnected')
      console.log(`${msg.time}: New signal from ${user.name}: ${JSON.stringify(msg)}`)
      socket.broadcast.emit('signal', msg)
      users.isOffline(user)
    }
    console.log(`<< disconnect`)
    console.log(``)
  })
  socket.on('leave', () => {
    console.log(``)
    console.log(`>> leave`)
    console.log(`Someoneleft`)
    leaveTeam(socket)
    console.log(`<< leave`)
    console.log(``)
  })
})

function leaveTeam (socket) {
  var me = users.getUserBySocketID(socket.id)
  console.log(`${!me ? 'No u' : 'U'}ser found with socket id ${socket.id}`)
  if (!me) return
  var msg = new Message(me.name, 'everyone', '', 'userLeft')

  console.log(`${msg.time}: New signal from ${me.name}: ${JSON.stringify(msg)}`)
  socket.broadcast.emit('signal', msg)

  // users.isOffline(me)
}

function getFreeId (location) {
  var id = Math.floor(Math.random() * 2147000000) + 100
  if (!usedIDs.length || !usedIDs[location] || usedIDs[location].indexOf(id) === -1) {
    usedIDs.push(id)
    return id
  } else {
    return getFreeId(location)
  }
}

async function getOpenPorts (location) {
  var videoPort = await getOpenPort(location)
  var audioPort = await getOpenPort(location)
  var videoRtcpPort = await getOpenPort(location)
  var audioRtcpPort = await getOpenPort(location)
  return { videoPort, audioPort, videoRtcpPort, audioRtcpPort }
}

async function getOpenPort (location, attempt = 0) {
  return new Promise((resolve, reject) => {
    var suggestedPort = Math.floor(Math.random() * 5000) + 60000
    if (attempt < 50) {
      console.log(!usedPorts.length)
      console.log(usedPorts[location])
      if (usedPorts[location]) console.log(!usedPorts[location].filter(x => x === suggestedPort).length)
      if (
        !usedPorts.length &&
        (!usedPorts[location] || !usedPorts[location].filter(x => x === suggestedPort).length)
      ) {
        if (!usedPorts[location]) usedPorts[location] = []
        usedPorts[location].push(suggestedPort)
        resolve(suggestedPort)
      } else {
        console.log('Double. Attempt nr ' + attempt)
        resolve(getOpenPort(location, (attempt + 1)))
      }
    } else {
      console.error('No more free ports')
    }
  })
}

function isEmpty (obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) { return false }
  }
  return true
}

function getTeamAdmins(teamname) {
  team = teams.find(t => t.name.toLowerCase() === teamname.toLowerCase())
  return team.admins;
}


function multicast(from, userList, msg, type) {
  userList.forEach(user => {
    var message = new Message(from, user, msg, type)
    cast(message);
  });

}
function cast(message) {
  io.to(users.getUserByName(message.to.name).socket).emit('signal', message)
}