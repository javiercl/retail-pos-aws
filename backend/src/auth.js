import { createRemoteJWKSet, jwtVerify } from 'jose'

const region = process.env.AWS_REGION
const userPoolId = process.env.COGNITO_USER_POOL_ID
const clientId = process.env.COGNITO_CLIENT_ID

const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

export async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: clientId,
  })
  return payload
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta Authorization Bearer token' })
  }

  verifyJwt(token)
    .then((claims) => {
      req.user = claims
      next()
    })
    .catch(() => res.status(401).json({ error: 'JWT invalido o expirado' }))
}
