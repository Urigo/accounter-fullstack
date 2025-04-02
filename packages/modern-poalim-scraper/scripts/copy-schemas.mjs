import { cp } from 'node:fs';

function copySchemas() {
  cp('./src/__generated__/', './dist/__generated__/', { recursive: true }, err => {
    if (err) {
      throw new Error(err);
    }
  });
}

copySchemas();
