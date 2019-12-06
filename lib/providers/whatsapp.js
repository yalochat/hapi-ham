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
      id: data.message.from,
      name: _.get(data, 'user.profile.name', data.message.from),
    },
    message: {
      text: data.message.text.body,
    },
  }),
  location: data => ({
    sender: {
      id: data.message.from,
      name: _.get(data, 'user.profile.name', data.message.from),
    },
    message: {
      type: 'location',
      attachments: [
        {
          type: 'location',
          payload: {
            coordinates: {
              lat: data.message.location.latitude,
              long: data.message.location.longitude,
            },
          },
        },
      ],
    },
  }),
  default: (data) => {
    const media = data.message[data.message.type] || {
      id: 'unknown message type',
    }
    return {
      sender: {
        id: data.message.from,
        name: _.get(data, 'user.profile.name', data.message.from),
      },
      message: {
        type: data.message.type,
        attachments: [
          {
            type: data.message.type,
            payload: {
              url: media.id,
            },
          },
        ],
      },
    }
  },
}

const getOldResponse = (data) => {
  const doResponse = oldResponses[data.message.type] || oldResponses.default

  return doResponse(data)
}

const getResponse = (data) => {
  const doResponse = responses[data.message.type] || responses.default

  return {
    ...doResponse(data),
    timestamp: data.message.timestamp,
    id: data.message.id,
  }
}

const getSend = (data, config, logger) => (message, _options) => {
  const smooch = _options.smooch || 'yes'
  const notification = _options.notification || 'no'
  const url = `${config.proxy}/${_options.botSlug}?provider=whatsapp&smooch=${
    smooch
  }&notification=${notification}${config.extraParams}`

  const metadata = { to: _options.userId || data.message.from }

  if (Array.isArray(message)) {
    return Promise.each(message, ({ message: messageItem, delay }) => {
      const lastMetadata = _.cloneDeep(metadata)
      const payload = _.merge(lastMetadata, messageItem)
      return Promise.delay(delay, Helpers.sendToProvider(url, payload, logger))
    })
  }

  if (message.sender_action) {
    return Promise.resolve({})
  }

  const payload = _.merge(metadata, message)

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
