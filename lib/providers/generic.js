const FacebookProvider = require('./facebook')
const WhatsappProvider = require('./whatsapp')
const SmoochProvider = require('./smooch')

const sendFunctions = {
  facebook: FacebookProvider.getSend,
  whatsapp: WhatsappProvider.getSend,
  smooch: SmoochProvider.getSendGeneric,
}

const getSend = (data, config, logger) => (message, _options) => {
  logger.debug(`Creating generic getSend function for provider ${_options.provider}`)
  const provider = _options.provider || 'facebook'
  const sendFunction = sendFunctions[provider] || sendFunctions.facebook

  if (sendFunction) {
    logger.debug(`Sending message to provider ${provider}`)
    // Build function used to send message to providers
    const send = sendFunction(data, config, logger)

    // Call function with the given parameters
    return send(message, _options)
  }
  return Promise.reject(new Error(`There is not generic getSend function for provider ${provider}`))
}

const process = (request, config, logger) => ({
  event: {},
  send: getSend(request.payload, config, logger),
})

module.exports = {
  getSend,
  process,
}
