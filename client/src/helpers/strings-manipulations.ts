export const stringComparer = (string1: string, string2: string): number => {
  /* returns the longest identical substring of two strings */
  if (!string1 || !string2) {
    return 0;
  }
  let longestMatch = 0;

  // clean anything but letters and digits
  const stripped1 = string1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const stripped2 = string2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  for (let i = 0; i < stripped1.length; i++) {
    let identLength = 0;
    for (let j = 0; j < stripped2.length; j++) {
      if (stripped1[i + j] === stripped2[j]) {
        identLength += 1;
      } else {
        if (identLength > longestMatch) {
          longestMatch = identLength;
        }
        identLength = 0;
      }
    }
    if (identLength > longestMatch) {
      longestMatch = identLength;
    }
    identLength = 0;
  }

  return longestMatch;
};

export const containsHebrew = (str: string) => {
  return /[\u0590-\u05FF]/.test(str);
};
