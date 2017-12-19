const FacebookProvider = require('./facebook')
const WhatsappProvider = require('./whatsapp')
const SmoochProvider = require('./smooch')

const sendFunctions = {
  facebook: FacebookProvider.getSend,
  whatsapp: WhatsappProvider.getSend,
  smooch: SmoochProvider.getSendGeneric,
  default: null,
}

const getSend = (data, config, logger) => {
  const sendFuncs = []
  _.forOwn(sendFunctions, (getSendFunction, key) => {
    sendFuncs[key] = getSendFunction(data, config, logger)
  })
  return (message, _options) => {
    logger.debug(`Creating generic getSend function for provider ${_options.provider}`)
    const provider = _options.provider || 'facebook'
    const send = sendFuncs[provider] || sendFunctions.default

    if (send) {
      // Build function used to send message to providers
      //const send = sendFunction(data, config, logger)

      // Call function with the given parameters
      return send(message, _options)
    }
    return Promise.reject(new Error(`There is not generic getSend function for provider ${provider}`))
  }
}

const process = (request, config, logger) => {

  return {
    event: {},
    send: getSend(request.payload, config, logger),
  }
}

module.exports = {
  getSend,
  process,
}
