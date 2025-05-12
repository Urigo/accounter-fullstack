export function isValidIsraeliID(rawId: string | number) {
  let id = String(rawId).trim();
  if (id.length > 9 || id.length < 5) return false;
  if (!/^\d+$/.test(id)) return false;

  // Pad string with zeros up to 9 digits
  id = id.length < 9 ? ('00000000' + id).slice(-9) : id;

  return (
    Array.from(id, Number).reduce((counter, digit, i) => {
      const step = digit * ((i % 2) + 1);
      return counter + (step > 9 ? step - 9 : step);
    }) %
      10 ===
    0
  );
}
