'use strict'

// Load modules
const Wreck = require('wreck')
const Boom = require('boom')
const _ = require('lodash')
const Bucker = require('bucker')
const Promise = require('bluebird')
// Declare internals

const internals = {}

let defaults = {
  access_token: ''
}

const fbUrl = 'https://graph.facebook.com/v2.6/me/messages'

exports.register = (server, options, next) => {

  const logger = Bucker.createLogger(options, 'hapi-ham')

  server.decorate('reply', 'validateWebhook', () => {
    let response
    switch (options.provider) {
      case 'facebook-messenger': {
        response = this.request.query['hub.challenge']
        break
      }
      default: {
        const msg = 'Invalid provider'
        server.log('error', msg)
        response = Boom.badRequest(msg)
      }
    }
    return this.response(response)
  })

  server.ext('onPreHandler', (request, reply) => {

    let response
    switch (options.provider) {
      case 'facebook-messenger': {
        const data = request.payload

        if (data && data.object === 'page') {

          data.entry.forEach((entry) => {

            entry.messaging.forEach((event) => {

              logger.debug('FACEBOOK MESSENGER REQUEST:')
              logger.debug(event)
              response = event

              if (event.postback && event.postback.referral) {
                request.refParams = internals.strParamToParamList(event.postback.referral.ref)
              } else if (event.referral) {
                request.refParams = internals.strParamToParamList(event.referral.ref)
              }

              if (event.sender && event.sender.id) {
                request.app.send = (message, _options) => {
                  let promise
                  const payload = {}
                  const config = _.defaults(options, defaults)
                  const tokenParam = _options.botToken ? `?access_token=${_options.botToken}` : config.access_token ? `?access_token=${config.access_token}` : ''
                  const url = config.proxy ? `${config.proxy}/${_options.botSlug ? _options.botSlug : ''}` : fbUrl + tokenParam

                  logger.debug(`URL ${url}`)

                  payload.recipient = { id: _options.userId || event.sender.id }

                  if (message.sender_action) {
                    payload.sender_action = message.sender_action
                    return internals.sendData(url, payload, logger)
                  } else {
                    if (Array.isArray(message)) {
                      return Promise.each(message.map(({ message, delay }) => {
                        payload.message = message
                        return internals.sendData(url, payload, logger, delay)
                      }))
                      /*return Promise.all(payload.message.map(message => {
                        return internals.sendData(url, payload, logger)
                      }))*/

                    } else {
                      payload.message = message
                      return internals.sendData(url, payload, logger)
                    }
                  }

                }
              }
            })
          })
        } else {
          request.app.send = (message, _options) => {
            let promise
            const payload = {}
            const config = _.defaults(options, defaults)
            const tokenParam = _options.botToken ? `?access_token=${_options.botToken}` : config.access_token ? `?access_token=${config.access_token}` : ''
            const url = config.proxy ? `${config.proxy}/${_options.botSlug ? _options.botSlug : ''}` : fbUrl + tokenParam

            logger('debug', `URL ${url}`)

            payload.recipient = { id: _options.userId }

            if (message.sender_action) {
              payload.sender_action = message.sender_action
              return internals.sendData(url, payload, logger)
            } else {
              if (Array.isArray(message)) {
                return Promise.each(message.map(({ message, delay }) => {
                  payload.message = message
                  return internals.sendData(url, payload, logger, delay)
                }))

              } else {
                payload.message = message
                return internals.sendData(url, payload, logger)
              }
            }
          }
        }
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

internals.strParamToParamList = (strParam) => {
  let strParamsList = strParam.split(',')
  const params = {}
  for (var i = 0; i < strParamsList.length; i++) {
    params[strParamsList[i].split(':')[0]] = strParamsList[i].split(':')[1]
  }
  return params
}

internals.sendData = (url, payload, logger, delay = 0) => {
  return new Promise((resolve, reject) => {
    Wreck.post(url, { payload }, (err, res, payload) => {
      if (err) {
        logger.error(`Error ${err}`)
        return reject(err)
      }
      logger.debug('Facebook messenger response ->')
      logger.debug(payload.toString())
      return resolve(payload.toString())
    })
  })
}

exports.register.attributes = {
  pkg: require('../package.json'),
  once: true
}
