export function getDocumentsMinDate(
  documents: {
    date: Date | null;
  }[],
): Date | null {
  return documents
    .map(t => t.date)
    .filter(date => !!date)
    .reduce((min, curr) => (curr < min ? curr : min));
}
