import { auth, toNextJsHandler } from '@mindmap/auth'

export const { GET, POST } = toNextJsHandler(auth)
