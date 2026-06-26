/** 1-based column index → A1 letter (1 = A, 27 = AA). */
export function columnIndexToLetter(count: number): string {
  let n = count;
  let letter = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - rem - 1) / 26);
  }
  return letter;
}
