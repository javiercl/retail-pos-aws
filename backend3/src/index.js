import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';
import AWS from 'aws-sdk';
import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(express.json());

const cognitoRegion = process.env.COGNITO_REGION || process.env.AWS_REGION;
const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID;
const cognitoClientId = process.env.COGNITO_CLIENT_ID;
const cognitoClientSecret = process.env.COGNITO_CLIENT_SECRET;

if (cognitoRegion) {
  AWS.config.update({ region: cognitoRegion });
}

const cognito = new AWS.CognitoIdentityServiceProvider();

const cognitoIssuer = cognitoRegion && cognitoUserPoolId
  ? `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`
  : null;

const jwks = cognitoIssuer
  ? createRemoteJWKSet(new URL(`${cognitoIssuer}/.well-known/jwks.json`))
  : null;

function buildSecretHash(username) {
  if (!cognitoClientSecret || !cognitoClientId) {
    return undefined;
  }

  return crypto
    .createHmac('sha256', cognitoClientSecret)
    .update(`${username}${cognitoClientId}`)
    .digest('base64');
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyCognitoToken(req, res, next) {
  if (!cognitoIssuer || !jwks) {
    return res.status(500).json({
      error: 'Cognito no configurado',
      missing: ['COGNITO_REGION/AWS_REGION', 'COGNITO_USER_POOL_ID']
    });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta token Bearer' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Token vacio' });
  }

  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: cognitoIssuer });
    const tokenUse = payload.token_use;

    if (cognitoClientId) {
      if (tokenUse === 'id' && payload.aud !== cognitoClientId) {
        return res.status(401).json({ error: 'aud invalido para client id' });
      }
      if (tokenUse === 'access' && payload.client_id !== cognitoClientId) {
        return res.status(401).json({ error: 'client_id invalido' });
      }
    }

    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

app.get('/public', (req, res) => {
  res.json({ message: 'Endpoint publico activo' });
});

app.get('/private', verifyCognitoToken, (req, res) => {
  res.json({
    message: 'Endpoint privado autorizado',
    sub: req.user?.sub,
    username: req.user?.username || req.user?.['cognito:username']
  });
});

app.post('/auth/register', async (req, res) => {
  if (!cognitoClientId) {
    return res.status(500).json({ error: 'Falta COGNITO_CLIENT_ID' });
  }

  const { username, password, email, name } = req.body || {};
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'username, password y email son requeridos' });
  }

  const secretHash = buildSecretHash(username);
  const userAttributes = [{ Name: 'email', Value: email }];
  if (name) {
    userAttributes.push({ Name: 'name', Value: name });
  }

  try {
    const signUpResult = await cognito.signUp({
      ClientId: cognitoClientId,
      Username: username,
      Password: password,
      UserAttributes: userAttributes,
      ...(secretHash ? { SecretHash: secretHash } : {})
    }).promise();

    return res.status(201).json({
      message: 'Usuario registrado. Confirma el usuario para poder iniciar sesion.',
      userSub: signUpResult.UserSub,
      userConfirmed: signUpResult.UserConfirmed
    });
  } catch (error) {
    return res.status(400).json({
      error: error.code || 'RegisterError',
      message: error.message
    });
  }
});

app.post('/auth/login', async (req, res) => {
  if (!cognitoClientId) {
    return res.status(500).json({ error: 'Falta COGNITO_CLIENT_ID' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son requeridos' });
  }

  const secretHash = buildSecretHash(username);
  const authParameters = {
    USERNAME: username,
    PASSWORD: password,
    ...(secretHash ? { SECRET_HASH: secretHash } : {})
  };

  try {
    const response = await cognito.initiateAuth({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: cognitoClientId,
      AuthParameters: authParameters
    }).promise();

    if (!response.AuthenticationResult) {
      return res.status(401).json({
        error: 'ChallengeRequired',
        challengeName: response.ChallengeName
      });
    }

    return res.json({
      accessToken: response.AuthenticationResult.AccessToken,
      idToken: response.AuthenticationResult.IdToken,
      refreshToken: response.AuthenticationResult.RefreshToken,
      expiresIn: response.AuthenticationResult.ExpiresIn,
      tokenType: response.AuthenticationResult.TokenType
    });
  } catch (error) {
    return res.status(401).json({
      error: error.code || 'LoginError',
      message: error.message
    });
  }
});

app.get('/time', verifyCognitoToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ serverTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error conectando a la BD' });
  }
});

const basePort = Number(process.env.PORT || 3000);

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Puerto ${port} en uso, intentando ${nextPort}...`);
      startServer(nextPort);
      return;
    }
    throw err;
  });
}

startServer(basePort);