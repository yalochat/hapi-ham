const _ = require('lodash')
const Bucker = require('bucker')
const Providers = require('./providers')
const Package = require('../package.json')
const KafkaHelper = require('./kafka-helper')

const defaults = {
  access_token: '',
  provider: 'generic',
  fb: {
    version: 'v2.7',
  },
}

// Declare register
exports.register = (server, options, next) => {
  const kafkaClient = KafkaHelper.createClient({
    host: options.kafka.host || 'kafka',
    port: options.kafka.port || 9092,
  })
  const loggerOptions = options.logger || {}
  const logger = Bucker.createLogger(Object.assign(
    {
      name: 'hapi-ham',
    },
    loggerOptions,
  ))

  server.ext('onPreHandler', (request, reply) => {
    if (request.method === 'post') {
      // Apply defaults options to received options
      const config = _.cloneDeep(_.defaults(options, defaults))
      config.kafkaClient = kafkaClient
      logger.debug('Getting configuration for hapi-ham: %j', config)

      // Get proxy from url query param
      config.proxy = request.query.proxy || config.proxy
      const callbackUrl = request.query['callback-url']
      config.extraParams = ''

      if (callbackUrl) {
        config.extraParams = `&callback-url=${callbackUrl}`
        request.app.omitSaveForm = true
      }

      // We are defining a fbUrl if there isn't a config for a proxy
      const fbUrl = `https://graph.facebook.com/${
        config.fb.version
      }/me/messages`

      // Set FB API Url to config
      config.fbUrl = fbUrl

      // Defining the provider if isn't come then assign facebook by default
      const provider = request.query.provider || options.provider
      logger.debug(`Applying functions for provider: ${provider}`)

      // Get functions used to build event and send function depends on provider
      // but if not exists the provider thus assign a default provider functions
      const providerFunctions = Providers[provider] || defaults.provider
      const { event, send } = providerFunctions.process(
        request,
        config,
        logger,
      )

      // add response object to event property in request object
      request.event = event

      // if send isn't null, add send as an app for our object request used to send messages
      // to providers
      if (send) {
        request.app.send = send
      }
    }
    return reply.continue()
  })

  next()
}

exports.register.attributes = {
  pkg: Package,
  once: true,
}
