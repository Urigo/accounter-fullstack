/* eslint-disable no-undef */

/* eslint-disable no-console */
import bcrypt from 'bcrypt';

const saltRounds = 10;

const encrypt = async myPlaintextPassword => {
  const hash1 = bcrypt.hashSync(myPlaintextPassword, saltRounds);
  const hash2 = bcrypt.hashSync(myPlaintextPassword, saltRounds);
  
  // Verify hashes are different (bcrypt uses different salts)
  const hashesAreDifferent = hash1 !== hash2;
  
  // Verify hashes cannot be compared to each other
  const cannotCompareHashes = !bcrypt.compareSync(hash1, hash2) && !bcrypt.compareSync(hash2, hash1);
  
  // Verify original password validates against both hashes
  const validatesAgainstHash1 = bcrypt.compareSync(myPlaintextPassword, hash1);
  const validatesAgainstHash2 = bcrypt.compareSync(myPlaintextPassword, hash2);
  
  const allValidationsPassed = hashesAreDifferent && cannotCompareHashes && validatesAgainstHash1 && validatesAgainstHash2;
  
  if (allValidationsPassed) {
    console.log('🔒: ', true);
    console.log('Hash: ', hash1);
  } else {
    console.log('🔒: ', false);
  }
};

// Get password from command line arguments
const password = process.argv[2];

if (!password) {
  console.error('Please provide a password as an argument');
  console.log('Usage: node scripts/encrypt-password.mjs <password>');
  process.exit(1);
}

encrypt(password);
