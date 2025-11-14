export function getDocumentsMinDate(
  documents: {
    date: Date | null;
  }[],
): Date | null {
  const dates = documents.map(t => t.date).filter(date => !!date);
  if (!dates.length) {
    return null;
  }
  return dates.reduce((min, curr) => (curr < min ? curr : min));
}
