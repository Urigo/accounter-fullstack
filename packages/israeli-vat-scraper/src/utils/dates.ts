export const parseDate = (rawDate: string): Date => {
  try {
    const dateParts = rawDate.split('/').map(part => parseInt(part));
    switch (dateParts.length) {
      case 2:
        return new Date(dateParts[1]!, dateParts[0]!, 1);
      case 3:
        return new Date(dateParts[2]!, dateParts[1]!, dateParts[0]);
      default:
        throw new Error(`Unable to parse "${rawDate} into date"`);
    }
  } catch (e) {
    throw new Error(`Error parsing date: cannot parse ${(e as Error)?.message || e}`);
  }
};
