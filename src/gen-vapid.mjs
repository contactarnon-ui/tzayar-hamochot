// מייצר מפתחות VAPID להתראות פוש. הרצה: node gen-vapid.mjs
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', kp.privateKey);
const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const pub = Buffer.from(raw).toString('base64url');
console.log('VAPID_PUBLIC=' + pub);
console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(jwk));
