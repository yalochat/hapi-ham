'use strict'

// Load modules
const _ = require('lodash')
const Boom = require('boom')
const Bucker = require('bucker')
const Promise = require('bluebird')
const Wreck = require('wreck')

let defaults = {
  access_token: ''
}

const fbUrl = 'https://graph.facebook.com/v2.6/me/messages'

// Declare internals
const strParamToParamList = (strParam) => {
  let strParamsList = strParam.split(',')
  const params = {}
  for (var i = 0; i < strParamsList.length; i++) {
    params[strParamsList[i].split(':')[0]] = strParamsList[i].split(':')[1]
  }
  return params
}

const sendData = (url, payload, logger) => {
  return new Promise((resolve, reject) => {
    Wreck.post(url, { payload }, (err, res, payload) => {
      if (err) {
        logger.error(`Error ${err}`)
        return reject(err)
      }
      logger.debug('Provider response ->')
      logger.debug(payload.toString())
      return resolve(payload.toString())
    })
  })
}

// Declare register
exports.register = (server, options, next) => {

  const loggerOptions = options.logger || {}
  loggerOptions.name = 'hapi-ham'
  const logger = Bucker.createLogger(loggerOptions)

  server.ext('onPreHandler', (request, reply) => {

    let response
    const config = _.defaults(options, defaults)
    const provider = request.query.provider || options.provider || 'facebook'
    switch (provider) {
      case 'facebook': {
        const data = request.payload

        if (data && data.object === 'page') {

          data.entry.forEach((entry) => {

            entry.messaging.forEach((event) => {

              logger.debug('FACEBOOK MESSENGER REQUEST:')
              logger.debug(event)
              response = event

              if (event.postback && event.postback.referral) {
                request.refParams = strParamToParamList(event.postback.referral.ref)
              } else if (event.referral) {
                request.refParams = strParamToParamList(event.referral.ref)
              }

              if (event.sender && event.sender.id) {
                request.app.send = (message, _options) => {
                  let promise
                  const payload = {}
                  const tokenParam = _options.botToken ? `?access_token=${_options.botToken}` : config.access_token ? `?access_token=${config.access_token}` : ''
                  const url = config.proxy ? `${config.proxy}/${_options.botSlug ? _options.botSlug : ''}` : fbUrl + tokenParam

                  logger.debug(`URL ${url}`)

                  payload.recipient = { id: _options.userId || event.sender.id }

                  if (message.sender_action) {
                    payload.sender_action = message.sender_action
                    return sendData(url, payload, logger)
                  } else {
                    if (Array.isArray(message)) {
                      return Promise.each(message, ({ message, delay }) => {
                        const typingOn = _.cloneDeep(payload)
                        typingOn.sender_action = 'typing_on'
                        sendData(url, typingOn, logger)
                        const tmpPayload = _.cloneDeep(payload)
                        tmpPayload.message = message
                        return Promise.delay(delay, sendData(url, tmpPayload, logger))
                      })
                    } else {
                      payload.message = message
                      return sendData(url, payload, logger)
                    }
                  }

                }
              }
            })
          })
        } else {
          request.app.send = (message, _options) => {
            const provider = _options.provider || 'facebook'
            switch (provider) {
              case 'facebook': {
                const payload = {}
                const config = _.defaults(options, defaults)
                const tokenParam = _options.botToken ? `?access_token=${_options.botToken}` : config.access_token ? `?access_token=${config.access_token}` : ''
                const url = config.proxy ? `${config.proxy}/${_options.botSlug ? _options.botSlug : ''}` : fbUrl + tokenParam

                logger.debug(`URL ${url}`)

                payload.recipient = { id: _options.userId }

                if (message.sender_action) {
                  payload.sender_action = message.sender_action
                  return sendData(url, payload, logger)
                } else {
                  if (Array.isArray(message)) {
                    return Promise.each(message, ({ message, delay }) => {
                      const typingOn = _.cloneDeep(payload)
                      typingOn.sender_action = 'typing_on'
                      sendData(url, typingOn, logger)
                      const tmpPayload = _.cloneDeep(payload)
                      tmpPayload.message = message
                      return Promise.delay(delay, sendData(url, tmpPayload, logger))
                    })
                  } else {
                    payload.message = message
                    return sendData(url, payload, logger)
                  }
                }
                break
              }
              case 'whatsapp': {
                const url = `${config.proxy}/${_options.botSlug}?provider=whatsapp`
                const metadata = { to: _options.userId || data.from }
                if (Array.isArray(message)) {
                  return Promise.each(message, ({ message, delay }) => {
                    const payload = { payload: _.merge(metadata, message) }
                    return Promise.delay(delay, sendData(url, payload, logger))
                  })
                } else {
                  if (message.sender_action) {
                    return Promise.resolve({})
                  } else {
                    const payload = { payload: _.merge(metadata, message) }
                    return sendData(url, payload, logger)
                  }
                }
                break
              }
              case 'smooch': {
                let payload = {}
                const config = _.defaults(options, defaults)
                const url = `${config.proxy}/${_options.botSlug}?provider=smooch`

                logger.debug(`URL ${url}`)

                payload.recipient = { id: _options.userId }

                if (Array.isArray(message)) {
                  return Promise.each(message, ({ message, delay }) => {
                    const tmpPayload = _.cloneDeep(payload)
                    message.is_echo = true
                    tmpPayload.message = message
                    return Promise.delay(delay, sendData(url, tmpPayload, logger))
                  })
                } else {
                  if (message.sender_action) {
                    return Promise.resolve({})
                  } else {
                    message.is_echo = true
                    payload.message = message
                    return sendData(url, payload, logger)
                  }
                }
                break
              }
            }
          }
        }
        break
      }
      case 'whatsapp': {
        const data = request.payload.payload
        switch (data.message.type) {
          case 'text': {
            response = {
              sender: { id: data.from },
              message: { text: data.message.text }
            }
            break
          }
        }
        request.app.send = (message, _options) => {
          const url = `${config.proxy}/${_options.botSlug}?provider=whatsapp`
          const metadata = { to: _options.userId || data.from }
          if (Array.isArray(message)) {
            return Promise.each(message, ({ message, delay }) => {
              const payload = { payload: _.merge(metadata, message) }
              return Promise.delay(delay, sendData(url, payload, logger))
            })
          } else {
            if (message.sender_action) {
              return Promise.resolve({})
            } else {
              const payload = { payload: _.merge(metadata, message) }
              return sendData(url, payload, logger)
            }
          }
        }
        break
      }
      case 'smooch': {
        const data = request.payload
        data.entry.forEach((entry) => {
          entry.messaging.forEach((event) => {
            response = event
            request.app.send = (message, _options) => {
              let payload = {}
              const config = _.defaults(options, defaults)
              const url = `${config.proxy}/${_options.botSlug}?provider=smooch`

              logger.debug(`URL ${url}`)

              //payload.recipient = { id: _options.userId || event.sender.id }

              if (Array.isArray(message)) {
                return Promise.each(message, ({ message, delay }) => {
                  const tmpPayload = _.cloneDeep(payload)
                  //message.is_echo = true
                  //tmpPayload.message = message
                  tmpPayload = {
                    entry: [
                      {
                        messaging: [
                          {
                            recipient: {
                              id: _options.userId || event.sender.id
                            },
                            message: message
                          }
                        ]
                      }
                    ]
                  }
                  return Promise.delay(delay, sendData(url, tmpPayload, logger))
                })
              } else {
                if (message.sender_action) {
                  return Promise.resolve({})
                } else {
                  message.is_echo = true
                  payload = {
                    entry: [
                      {
                        messaging: [
                          {
                            recipient: {
                              id: _options.userId || event.sender.id
                            },
                            message: message
                          }
                        ]
                      }
                    ]
                  }
                  //payload.message = message
                  return sendData(url, payload, logger)
                }
              }
            }
          })
        })
        break
      }
      default: {
        response = { status: 'success' }
      }
    }
    request.event = response
    return reply.continue()
  })

  next()
}

exports.register.attributes = {
  pkg: require('../package.json'),
  once: true
}
