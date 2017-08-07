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

const sendData = (url, payload, logger, delay = 0) => {
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

// Declare register
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
                request.refParams = strParamToParamList(event.postback.referral.ref)
              } else if (event.referral) {
                request.refParams = strParamToParamList(event.referral.ref)
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
                    return sendData(url, payload, logger)
                  } else {
                    if (Array.isArray(message)) {
                      return Promise.each(message.map(({ message, delay }) => {
                        payload.message = message
                        return sendData(url, payload, logger, delay)
                      }))
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
            let promise
            const payload = {}
            const config = _.defaults(options, defaults)
            const tokenParam = _options.botToken ? `?access_token=${_options.botToken}` : config.access_token ? `?access_token=${config.access_token}` : ''
            const url = config.proxy ? `${config.proxy}/${_options.botSlug ? _options.botSlug : ''}` : fbUrl + tokenParam

            logger('debug', `URL ${url}`)

            payload.recipient = { id: _options.userId }

            if (message.sender_action) {
              payload.sender_action = message.sender_action
              return sendData(url, payload, logger)
            } else {
              if (Array.isArray(message)) {
                return Promise.each(message.map(({ message, delay }) => {
                  payload.message = message
                  return sendData(url, payload, logger, delay)
                }))

              } else {
                payload.message = message
                return sendData(url, payload, logger)
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

exports.register.attributes = {
  pkg: require('../package.json'),
  once: true
}
