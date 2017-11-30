const FacebookProvider = require('./facebook')
const WhatsappProvider = require('./whatsapp')
const SmoochProvider = require('./smooch')

const sendFunctions = {
  facebook: FacebookProvider.getSend,
  whatsapp: WhatsappProvider.getSend,
  smooch: SmoochProvider.getSendGeneric,
  default: null,
}

const getSend = (data, config, logger) => (message, _options) => {
  const provider = _options.provider || 'facebook'
  const sendFunction = sendFunctions[provider] || sendFunctions.default

  if (sendFunction) {
    // Build function used to send message to providers
    const send = sendFunction(data, config, logger)

    // Call function with the given parameters
    send(message, _options)
  }
}

module.exports = {
  getSend,
}
