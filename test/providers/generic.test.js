const Bucker = require('bucker')
const Hapi = require('hapi')
const Kaiwa = require('kaiwa')
const HapiHam = require('../../lib')

const logger = Bucker.createLogger({ name: 'test/providers/generic' })
const kaiwaOptions = {
  webHookURL: 'http://localhost:3000/test-bot/direct-message',
  testingPort: 3001,
}

const tester = new Kaiwa.Tester(kaiwaOptions)
let server = null

beforeEach(() =>
  new Promise((resolve, reject) => {
    server = new Hapi.Server()
    server.connection({ host: 'localhost', port: 3000 })

    server.register(
      {
        register: HapiHam,
        options: {
          access_token: '123',
          proxy: 'http://localhost:3001/bots',
          logger: {
            console: true,
            level: 'debug',
          },
          silent: true,
        },
      },
      (err) => {
        if (err) {
          throw err
        }

        // Start the server
        server.start((error) => {
          if (err) {
            reject(error)
          }
          logger.info('Server with hapi-ham running at:', server.info.uri)
          resolve()
        })
      },
    )
  }))

afterEach(() =>
  new Promise((resolve, reject) => {
    /* eslint-disable consistent-return */
    server.stop((err) => {
      if (err) {
        return reject(err)
      }
      tester.stopListening((testerError) => {
        if (testerError) {
          return reject(testerError)
        }
        return resolve()
      })
    })
  }))

test('send request and validate one response', (done) => {
  server.route({
    method: 'POST',
    path: '/{botId}/direct-message',
    handler: (request, reply) => {
      reply({ message: 'Message sent!' })

      const template = {
        text: `Hello ${request.payload.userId}`,
      }
      const options = {
        botSlug: 'test',
        provider: 'facebook',
        userId: request.payload.userId,
      }
      request.app
        .send(template, options)
        .then(logger.info.bind(logger))
        .catch(logger.error.bind(logger))
    },
  })

  tester.startListening((error) => {
    if (error) {
      throw error
    }

    const messageToSend = {
      userId: '1568289853216540',
      type: 'quick-replies',
      message: 'Hello',
      quick_replies: [
        {
          content_type: 'text',
          title: 'test',
          payload: 'test',
        },
      ],
    }

    const expectedMessage = {
      recipient: { id: messageToSend.userId },
      message: { text: `Hello ${messageToSend.userId}` },
    }

    tester
      .runScript(messageToSend)
      .then((result) => {
        expect(result[0]).toBe(expectedMessage)
        done()
      })
      .catch(done)
  })
})
