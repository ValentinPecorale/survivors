import { makeRouteHandler } from '@keystatic/next/route-handler'
import config from '../../../../../keystatic.config'

const handlers = makeRouteHandler({ config })
export const GET: typeof handlers.GET = (...args) => process.env.NODE_ENV === 'production'
  ? Promise.resolve(new Response(null, { status: 404 })) : handlers.GET(...args)
export const POST: typeof handlers.POST = (...args) => process.env.NODE_ENV === 'production'
  ? Promise.resolve(new Response(null, { status: 404 })) : handlers.POST(...args)
