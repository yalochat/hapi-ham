const _ = require('lodash')
const Promise = require('bluebird')
const Helpers = require('../helpers')

const getSend = (data, config, logger, event) => (message, _options) => {
  let tokenParam = ''
  const recipientKey = event.optin ? 'user_ref' : 'id'
  const recipientId = event.optin
    ? event.optin.user_ref
    : _options.userId || event.sender.id

  const payload = {
    recipient: { [recipientKey]: recipientId },
  }

  if (_options.botToken) {
    tokenParam = `access_token=${_options.botToken}`
  } else if (config.access_token) {
    tokenParam = `access_token=${config.access_token}`
  }

  const url = config.proxy
    ? `${config.proxy}/${_options.botSlug || ''}?${config.extraParams}`
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
      )
        .delay(delay)
        .then(() =>
          Helpers.sendToProvider(
            url,
            _.merge({ message: messageItem }, _.cloneDeep(payload)),
            logger,
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

    // Verify if has ref params in order to do some logic to process that ref params
    if (
      event.postback &&
      event.postback.referral &&
      event.postback.referral.ref
    ) {
      request.refParams = Helpers.strParamToParamList(event.postback.referral.ref)
    } else if (event.referral && event.referral.ref) {
      request.refParams = Helpers.strParamToParamList(event.referral.ref)
    }

    // If event has a sender id then get funciont 'send' used to send message to provider
    if (
      (event.sender && event.sender.id) ||
      (event.optin && event.optin.user_ref)
    ) {
      logger.debug('Getting send function for Facebook provider')
      send = getSend({}, config, logger, event)
    }
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
