const _ = require('lodash')
const Promise = require('bluebird')
const Helpers = require('../helpers')

const responses = {
  text: data => ({
    sender: {
      id: data.from,
    },
    message: {
      text: data.message.text,
    },
  }),
  medida: data => ({
    sender: {
      id: data.from,
    },
    message: {
      text: data.message.text || '',
    },
  }),
  default: () => {},
}

const getResponse = (data) => {
  const response = responses[data.message.type] || responses.default

  return response(data)
}

const getSend = (data, config, logger) => (message, _options) => {
  const url = `${config.proxy}/${_options.botSlug}?provider=whatsapp`
  const metadata = { to: _options.userId || data.from }

  if (Array.isArray(message)) {
    return Promise.each(message, ({ message: messageItem, delay }) =>
      Promise.delay(
        delay,
        Helpers.sendToProvider(
          url,
          {
            payload: _.merge(metadata, messageItem),
          },
          logger,
        ),
      ))
  } else if (message.sender_action) {
    return Promise.resolve({})
  }

  const payload = { payload: _.merge(metadata, message) }
  return Helpers.sendToProvider(url, payload, logger)
}

const process = (request, config, logger) => {
  // This is because the whatsapp structure is { payload: { ... } }
  // and Hapi has incoming payload in the property payload of the object request
  const { payload } = request
  const { payload: data } = payload

  return {
    event: getResponse(data),
    send: getSend(data, config, logger),
  }
}

module.exports = {
  getResponse,
  getSend,
  process,
}
