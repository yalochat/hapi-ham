const _ = require('lodash')
// const rp = require('request-promise')
const superagent = require('superagent')

const sendToProvider = (url, data, logger) =>
  superagent
    .post(url)
    .send(data)
    .then((response) => {
      logger.debug('Provider response %j', response || { response: 'ok' })
      return response
    })
    .catch((err) => {
      logger.error(`Error ${err} trying to send to the URL: ${url}`)
      throw err
    })
// rp
//   .post(url, {
//     body: data,
//     json: true,
//   })
//   .then((response) => {
//     logger.debug('Provider response %j', response || { response: 'ok' })
//     return response
//   })
//   .catch((err) => {
//     logger.error(`Error ${err} trying to send to the URL: ${url}`)
//     throw err
//   })

const strParamToParamList = strParam =>
  strParam.split(',').reduce((acc, param) => {
    const [key, value] = param.split(':')

    return Object.assign({}, acc, { [key]: value })
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
