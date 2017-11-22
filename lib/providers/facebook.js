const _ = require('lodash')
const Promise = require('bluebird')
const Helpers = require('../helpers')
const GenericProvider = require('./generic')

const getSend = (data, config, logger, event) => (message, _options) => {
  let tokenParam = ''
  const payload = {
    recipient: { id: _options.userId || event.sender.id },
  }

  if (_options.botToken) {
    tokenParam = `access_token=${_options.botToken}`
  } else if (config.access_token) {
    tokenParam = `access_token=${config.access_token}`
  }

  const url = config.proxy
    ? `${config.proxy}/${_options.botSlug ? _options.botSlug : ''}`
    : `${config.fbUrl}?${tokenParam}`

  logger.debug(`Sending response to: ${url}`)

  if (message.sender_action) {
    payload.sender_action = message.sender_action
    return Helpers.sendToProvider(
      url,
      _.merge({ sender_action: message.sender_action }, _.cloneDeep(payload)),
      logger,
    )
  } else if (Array.isArray(message)) {
    return Promise.each(message, ({ message: messageItem, delay }) =>
      // Send event to show typing_on
      Helpers.sendToProvider(
        url,
        _.merge(
          {
            sender_action: 'typing_on',
          },
          _.cloneDeep(payload),
        ),
        logger,
      ).then(() =>
        Promise.delay(
          delay,
          Helpers.sendToProvider(
            url,
            _.merge({ message: messageItem }, _.cloneDeep(payload)),
            logger,
          ),
        )))
  }

  return Helpers.sendToProvider(
    url,
    _.merge(
      {
        message,
      },
      _.cloneDeep(payload),
    ),
    logger,
  )
}

const process = (request, config, logger) => {
  /* Set a default value for send function, then if is null we aren't going to assign it
    to request object such an app */
  let send = null
  const data = request.payload

  // Get the last element of the message if the object type is equals to 'page'
  const event = Helpers.getLastEventFromFacebookMessage(data, logger)

  // If event is defined process the message such a facebook message
  if (event) {
    logger.debug('Processing message from Facebook: %j', event)
    const requestProperties = {}

    // Verify if has ref params in order to do some logic to process that ref params
    if (event.postback && event.postback.referral) {
      requestProperties.refParams = Helpers.strParamToParamList(event.postback.referral.ref)
    } else if (event.referral) {
      requestProperties.refParams = Helpers.strParamToParamList(event.referral.ref)
    }

    // If event has a sender id then get funciont 'send' used to send message to provider
    if (event.sender && event.sender.id) {
      logger.debug('Getting send function for Facebook provider')
      send = getSend({}, config, logger, event)
    }
  } else {
    /*
      If doesnt have an event, then get a generic send function that is going
      to search its correct function depends on the provider
    */
    send = GenericProvider.getSend(data, config, logger)
  }

  return {
    send,
    event,
  }
}

module.exports = {
  getSend,
  process,
}
