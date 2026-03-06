const crypto = require('node:crypto');

const DURATION_RE = /^(\d+)([smhd])?$/i;
const DURATION_MULTIPLIER = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400
};

const toBase64Url = (value) => Buffer.from(value).toString('base64url');

const parseJsonSegment = (segment, label) => {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new Error(`Invalid JWT ${label}`);
  }
};

const parseExpiresInSeconds = (expiresIn) => {
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    return Math.floor(expiresIn);
  }
  if (typeof expiresIn !== 'string') {
    throw new Error('JWT expiresIn must be a number or duration string');
  }
  const match = DURATION_RE.exec(expiresIn.trim());
  if (!match) {
    throw new Error(`Invalid JWT expiresIn value: ${expiresIn}`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  return amount * DURATION_MULTIPLIER[unit];
};

const signJwt = ({ secret, subject, issuer, audience, expiresIn = '15m', claims = {} }) => {
  if (!secret) {
    throw new Error('Missing JWT secret');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...claims,
    sub: subject,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + parseExpiresInSeconds(expiresIn)
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
};

const verifyJwt = (token, { secret, issuer, audience, subject, clockToleranceSec = 5 } = {}) => {
  if (!secret) {
    throw new Error('Missing JWT secret');
  }
  if (!token || typeof token !== 'string') {
    throw new Error('Missing JWT token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonSegment(encodedHeader, 'header');
  const payload = parseJsonSegment(encodedPayload, 'payload');

  if (header.alg !== 'HS256') {
    throw new Error(`Unsupported JWT algorithm: ${header.alg || 'none'}`);
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  const actualSigBytes = Buffer.from(encodedSignature, 'base64url');
  const expectedSigBytes = Buffer.from(expectedSig, 'base64url');
  if (actualSigBytes.length !== expectedSigBytes.length || !crypto.timingSafeEqual(actualSigBytes, expectedSigBytes)) {
    throw new Error('Invalid JWT signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const skew = Math.max(0, Number(clockToleranceSec) || 0);

  if (!Number.isFinite(payload.exp)) {
    throw new Error('JWT token missing exp claim');
  }
  if (now - skew >= payload.exp) {
    throw new Error('JWT token expired');
  }
  if (Number.isFinite(payload.nbf) && now + skew < payload.nbf) {
    throw new Error('JWT token not active yet');
  }
  if (issuer && payload.iss !== issuer) {
    throw new Error('JWT issuer mismatch');
  }
  if (subject && payload.sub !== subject) {
    throw new Error('JWT subject mismatch');
  }
  if (audience) {
    const aud = payload.aud;
    const isValidAudience = Array.isArray(aud) ? aud.includes(audience) : aud === audience;
    if (!isValidAudience) {
      throw new Error('JWT audience mismatch');
    }
  }

  return payload;
};

module.exports = {
  signJwt,
  verifyJwt,
  parseExpiresInSeconds
};
