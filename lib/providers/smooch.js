const _ = require('lodash')
const Promise = require('bluebird')
const Helpers = require('../helpers')

const getSendGeneric = (data, config, logger) => (message, _options) => {
  const payload = {
    recipient: { id: _options.userId },
  }
  const url = `${config.proxy}/${_options.botSlug}?provider=smooch`

  logger.debug(`URL ${url}`)

  if (Array.isArray(message)) {
    return Promise.each(message, ({ message: messageItem, delay }) =>
      Promise.delay(
        delay,
        Helpers.sendToProvider(
          url,
          _.merge(
            {
              is_echo: true,
              message: messageItem,
            },
            _.cloneDeep(payload),
          ),
          logger,
        ),
      ))
  } else if (message.sender_action) {
    return Promise.resolve({})
  }

  return Helpers.sendToProvider(
    url,
    _.merge(
      {
        message,
        is_echo: true,
      },
      _.cloneDeep(payload),
    ),
    logger,
  )
}

const getSend = (data, config, logger) => {
  const event = Helpers.getLastEventFromFacebookMessage(data, logger)

  return (message, _options) => {
    const payload = {}
    const url = `${config.proxy}/${_options.botSlug}?provider=smooch`

    logger.debug(`Url to send message: ${url}`)

    if (Array.isArray(message)) {
      return Promise.each(message, ({ messageItem, delay }) =>
        Promise.delay(
          delay,
          Helpers.sendToProvider(
            url,
            _.merge(
              {
                entry: [
                  {
                    messaging: [
                      {
                        message: messageItem,
                        recipient: {
                          id: _options.userId || event.sender.id,
                        },
                      },
                    ],
                  },
                ],
              },
              _.cloneDeep(payload),
            ),
            logger,
          ),
        ))
    } else if (message.sender_action) {
      return Promise.resolve({})
    }

    return Helpers.sendToProvider(
      url,
      _.merge({
        entry: [
          {
            messaging: [
              {
                recipient: {
                  id: _options.userId || event.sender.id,
                },
                message: _.merge({ is_echo: true }, message),
              },
            ],
          },
        ],
      }),
      logger,
    )
  }
}

const process = (request, config, logger) => {
  const data = request.payload
  const event = Helpers.getLastEventFromFacebookMessage(data, logger)

  return {
    event,
    send: getSend(data, config, logger),
  }
}

module.exports = {
  getSendGeneric,
  getSend,
  process,
}
