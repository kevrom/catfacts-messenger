import express from 'express'
import logger from 'morgan'
import bodyParser from 'body-parser'
import settings from './settings'
import swig from 'swig'
import { Observable } from 'rxjs'
import { fetchMessenger$, generateFact, generateGifUrl } from './utils'

const app = express()

const CATFACT = 'CATFACT'
const GIF = 'GIF'

app.use(logger('dev'))
app.use(bodyParser.json())

app.get('/policy', (req, res) => res.send(swig.renderFile('./policy.html')))

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === settings.facebook.verifyToken) {
    res.send(req.query['hub.challenge'])
  } else {
    res.send('Error, wrong validation token')
  }
})

const buttonPayload = {
  template_type: 'button',
  text: 'Choose wisely. More otters coming soon!',
  buttons: [
    {
      type: 'postback',
      title: 'Send a cat fact!',
      payload: CATFACT
    },
    {
      type: 'postback',
      title: 'Send an animal gif!',
      payload: GIF
    }
  ]
}

// a function that returns an observable that sends the button template
const sendButton$ = obs => obs.mergeMap(id => fetchMessenger$({
  recipient: { id },
  message: {
    attachment: {
      type: 'template',
      payload: buttonPayload
    }
  }
}))

// set up an observable for this route
const hook$ = Observable.create(observer => {
  // listen for webhook posts from the Messenger API
  app.post('/webhook', (req, res) => {
    // return 200 to FB
    res.sendStatus(200)

    // ship off the array of messages to our observable
    observer.next(req.body.entry[0].messaging)
  })
})

  // flatten the array of messages from the FB callback
  .mergeAll()

  // ignore message if it's a delivery confirmation
  .filter(m => !m.delivery)

  // time to filter and map depending on what the user did
  .mergeMap(m => {
    if (m.message && m.message.text) {
      // if they sent a normal text message let's just return an observable of their id
      return Observable.of(m)
        .map(msg => ({ recipient_id: msg.sender.id }))
    } else if (m.postback.payload === GIF) {
      // if the user clicks the cat gif button, ship off a gif url
      return Observable.of(m)
        .map(msg => msg.sender.id)
        // wait a little while before shipping off the buttons
        .delay(2000)
        .mergeMap(id => fetchMessenger$({
          recipient: { id },
          message: {
            attachment: {
              type: 'image',
              payload: {
                url: generateGifUrl()
              }
            }
          }
        }))
    } else if (m.postback.payload === CATFACT) {
      // and if the user clicks the cat fact button, send a fact
      return Observable.of(m)
        .map(msg => msg.sender.id)
        // wait a little while before shipping off the buttons
        .delay(2000)
        .mergeMap(id => fetchMessenger$({
          recipient: { id },
          message: {
            text: generateFact()
          }
        }))
    }

    // any unhandled stuff will just send the buttons
    return Observable.of(m)
      .map(msg => ({ recipient_id: msg.sender.id }))
  })

  // send the button template
  .mergeMap(res => sendButton$(Observable.of(res.recipient_id)))

hook$.subscribe(m => console.log(m), err => console.log(err))

app.get('/health', (req, res) => res.send({ status: 'ok' }))

export default app
