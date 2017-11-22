const _ = require('lodash')
const rp = require('request-promise')

const sendToProvider = (url, data, logger) =>
  rp
    .post(url, {
      body: data,
      json: true,
    })
    .then((response) => {
      logger.debug('Provider response %j', response || { response: 'ok' })
      return response
    })
    .catch((err) => {
      logger.error(`Error ${err}`)
      throw err
    })

const strParamToParamList = strParam =>
  strParam.split(',').reduce((acc, param) => {
    const [key, value] = param.split(':')

    acc[key] = value

    return acc
  }, {})

const getLastEventFromFacebookMessage = (data, logger) => {
  if (data && data.object === 'page') {
    // Get the last event object in messaging objects
    logger.debug('Getting the last message in incoming data')
    const entry = _.last(data.entry)

    return _.last(entry.messaging)
  }

  return null
}

module.exports = {
  sendToProvider,
  strParamToParamList,
  getLastEventFromFacebookMessage,
}
