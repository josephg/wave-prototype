import polka, { Polka } from "polka"
import * as dt from '../db/index.js'
import {Remarkable} from 'remarkable'
import fs from 'fs'

const md = new Remarkable()

const css = `
<style>
${fs.readFileSync('server/blog.css', 'utf8')}
</style>
`

export const makeRouter = (db: dt.FancyDB): Polka => {
  const router = polka()

  router.get('/:slug', (req, res, next) => {
    const slug = req.params.slug

    console.log('slug', slug)

    const data = (dt.get(db) as any).waves

    for (const wave of data.values()) {
      let thisslug = (wave.slug ?? '').trim()
      if (thisslug[0] === '/') thisslug.slice(1)

      if (wave.type === 'post' && thisslug === slug) {
        console.log('wave', wave)

        const html = md.render(wave.content)

        res.setHeader('content-type', 'text/html')
        res.end(`<!DOCTYPE html>
<html lang=en>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${wave.title ?? 'Untitled'}</title>
<meta charset="UTF-8">
${css}
<main>
  ${html}
</main>`)

        return
      }
    }

    res.writeHead(404, 'Not Found')
    res.end('Not found')
  })

  return router
}