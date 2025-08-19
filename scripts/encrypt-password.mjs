/* eslint-disable no-undef */

/* eslint-disable no-console */
import bcrypt from 'bcrypt';

const saltRounds = 10;

const encrypt = async myPlaintextPassword => {
  const hash = bcrypt.hashSync(myPlaintextPassword, saltRounds);
  const hash2 = bcrypt.hashSync(myPlaintextPassword, saltRounds);
  const validate = bcrypt.compareSync(hash2, hash);
  console.log('🔒: ', validate);
};

// Get password from command line arguments
const password = process.argv[2];

if (!password) {
  console.error('Please provide a password as an argument');
  console.log('Usage: node scripts/encrypt-password.mjs <password>');
  process.exit(1);
}

encrypt(password);
