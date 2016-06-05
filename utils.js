import fetch from 'node-fetch'
import { Observable } from 'rxjs'
import settings from './settings'
import facts from './catfacts.json'
import gifs from './gifs.json'

const messageUrl = `https://graph.facebook.com/v2.6/me/messages?access_token=${settings.facebook.pageToken}`

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
}

export const fetchMessenger$ = body => Observable.fromPromise(fetch(messageUrl, {
  method: 'POST',
  headers,
  body: JSON.stringify(body)
}).then(res => res.json()))
  .retry(3)

export const generateFact = () => facts[Math.floor(Math.random() * facts.length)]

export const generateGifUrl = () => gifs[Math.floor(Math.random() * gifs.length)]
