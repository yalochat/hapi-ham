const _ = require('lodash')
const Promise = require('bluebird')
const Helpers = require('../helpers')

const oldResponses = {
  text: data => ({
    sender: {
      id: data.from,
    },
    message: {
      text: data.message.text,
    },
  }),
  media: data => ({
    sender: {
      id: data.from,
    },
    message: {
      text: data.message.text || '',
    },
  }),
  default: () => {},
}

const responses = {
  text: data => ({
    sender: {
      id: data.from,
    },
    message: {
      text: data.text.body,
    },
  }),
  default: () => {},
}

const getOldResponse = (data) => {
  const doResponse = oldResponses[data.message.type] || oldResponses.default

  return doResponse(data)
}

const getResponse = (data) => {
  const doResponse = responses[data.type] || responses.default

  return doResponse(data)
}

const getSend = (data, config, logger) => (message, _options) => {
  const smooch = _options.smooch || 'yes'
  const url = `${config.proxy}/${_options.botSlug}?provider=whatsapp&smooch=${smooch}${
    config.extraParams
  }`
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
  const { payload } = request

  if (_.has(payload, 'payload')) {
    // This is because the whatsapp structure is { payload: { ... } }
    // and Hapi has incoming payload in the property payload of the object request
    const { payload: data } = payload

    return {
      event: getOldResponse(data),
      send: getSend(data, config, logger),
    }
  }

  // This is for new whatsapp structure that has come with a plain object with id as a property
  return {
    event: getResponse(payload),
    send: getSend(payload, config, logger),
  }
}

module.exports = {
  getResponse,
  getSend,
  process,
}
