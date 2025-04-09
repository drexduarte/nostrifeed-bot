const { generatePrivateKey, getPublicKey, nip19 } = require('nostr-tools');

// Generates a private key (hex)
const sk = generatePrivateKey();

// Convert private key to nsec
const nsec = nip19.nsecEncode(sk);


// Generate a public key (hex)
const pk = getPublicKey(sk);

// Convert public key to npub
const npub = nip19.npubEncode(pk);    

console.log('🔑 Private key (salve com segurança):', sk);
console.log('🔑 Private key (nsec):', nsec);
console.log('🪪 Public key:', pk);