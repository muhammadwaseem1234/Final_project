const { generateProof } = require('./zkp');

const args = process.argv.slice(2);
const secretIndex = args.findIndex((arg) => arg === '--secret');
const secret = secretIndex >= 0 ? args[secretIndex + 1] : null;

if (!secret) {
  // eslint-disable-next-line no-console
  console.error('Usage: node zkp/prove.js --secret <secret>');
  process.exit(1);
}

generateProof(secret)
  .then((data) => {
    process.stdout.write(JSON.stringify(data));
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message);
    process.exit(1);
  });
