import express from 'express'
import logger from 'morgan'
import bodyParser from 'body-parser'
import settings from './settings'
import fetch from 'node-fetch'
import { Subject, Observable } from 'rxjs'
import facts from './catfacts.json'

const app = express()

const messageUrl = `https://graph.facebook.com/v2.6/me/messages?access_token=${settings.facebook.pageToken}`

const generateFact = () => facts[Math.floor(Math.random() * facts.length)]

const messages$ = new Subject()
  .mergeAll()
  .filter(m => !m.delivery)
  .map(m => ({
    sender: m.sender.id,
    text: m.message.text
  }))
  .mergeMap(m => Observable.fromPromise(fetch(messageUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: m.sender },
      message: { text: generateFact() }
    })
  }).then(res => res.json())))

messages$.subscribe(message => {
  console.log(message)
}, err => {
  console.log(err)
})

app.use(logger('dev'))
app.use(bodyParser.json())

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === settings.facebook.verifyToken) {
    res.send(req.query['hub.challenge'])
  } else {
    res.send('Error, wrong validation token')
  }
})

app.post('/webhook', (req, res) => {
  messages$.next(req.body.entry[0].messaging)
  res.sendStatus(200)
})

app.get('/health', (req, res) => res.send({ status: 'ok' }))

export default app
