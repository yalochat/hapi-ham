'use strict'

const Hapi = require('hapi')
const Kaiwa = require('kaiwa')

let server
let tester
beforeEach(() => {
  return new Promise((resolve, reject) => {
    server = new Hapi.Server()
    server.connection({ host: 'localhost', port: 3000 })

    server.register({
      register: require('../'),
      options: {
        provider: 'whatsapp',
        access_token: '123',
        proxy: 'http://localhost:3001/bots',
        logger: {
          console: true,
          level: 'debug'
        },
        silent: true
      }
    }, (err) => {

      if (err) {
        throw err
      }

      // Start the server
      server.start((err) => {
        if (err) {
          throw err;
          reject()
        }
        console.log('Server with hapi-ham running at:', server.info.uri)
        resolve()
      })
    })
  })

})


test('send request and validate one response', (done) => {

  server.route({
    method: ['POST', 'GET'],
    path: '/',
    handler: (request, reply) => {
      reply({ message: 'Good test!' })
      const template = {
        body: `Hola ${request.event.message.text}`
      }
      const options = {
        botSlug: 'test'
      }
      request.app.send(template, options).then(result => console.log).catch(error => console.error)
    }
  })

  const kaiwaOptions = {
    webHookURL: 'http://localhost:3000',
    testingPort: 3001
  }

  tester = new Kaiwa.Tester(kaiwaOptions)

  tester.startListening((error) => {
    if (error) {
      throw error
    }
    const messageToSend = {
      payload: {
        from: 1,
        message: {
          text: 'ping',
          type: 'text'
        }
      }
    }
    const expectedMessage = {
      payload: {
        to: 1,
        body: 'Hola ping'
      }
    }

    tester.runScript(messageToSend).then((result) => {

      expect(result[0]).toEqual(expectedMessage)
      done()

    }).catch((error) => {
      throw error
      done()
    })
  })

})

test('send request and validate two responses', (done) => {

  server.route({
    method: ['POST', 'GET'],
    path: '/',
    handler: (request, reply) => {
      reply({ message: 'Good test!' })
      const templates = [
        {
          message: { body: `Hello ${request.event.message.text}` },
          delay: 0
        },
        {
          message: { body: `Hola ${request.event.message.text}` },
          delay: 0
        }
      ]

      const options = {
        botSlug: 'test'
      }
      request.app.send(templates, options).then(result => console.log).catch(error => console.error)
    }
  })

  const kaiwaOptions = {
    webHookURL: 'http://localhost:3000',
    testingPort: 3001
  }

  tester = new Kaiwa.Tester(kaiwaOptions)

  tester.startListening((error) => {
    if (error) {
      throw error
    }
    const messageToSend = {
      payload: {
        from: 1,
        message: {
          text: 'ping',
          type: 'text'
        }
      }
    }
    const firstExpectedMessage = {
      payload: {
        to: 1,
        body: 'Hello ping'
      }
    }

    const secondExpectedMessage = {
      payload: {
        to: 1,
        body: 'Hola ping'
      }
    }

    const options = {
      responses: 2
    }

    tester.runScript(messageToSend, options).then((result) => {

      expect(result[0]).toEqual(firstExpectedMessage)
      expect(result[1]).toEqual(secondExpectedMessage)
      done()

    }).catch((error) => {
      throw error
      done()
    })
  })

})

afterEach(() => {
  return new Promise((resolve, reject) => {
    server.stop((err) => {
      if (err) {
        return reject(err)
      }
      tester.stopListening((err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  })
})