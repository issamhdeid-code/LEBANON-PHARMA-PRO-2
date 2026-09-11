function parseExpiry(input) {
    const digits = input.replace(/[^\d]/g, '');
    let d = 0, m = 0, y = 0;

    if (digits.length === 4) {
      m = parseInt(digits.slice(0, 2), 10);
      y = 2000 + parseInt(digits.slice(2, 4), 10);
    } else if (digits.length === 6) {
      const p1 = parseInt(digits.slice(0, 2), 10);
      const p2 = parseInt(digits.slice(2, 4), 10);
      const p3 = parseInt(digits.slice(4, 6), 10);
      
      // if it's MMYYYY e.g. 032027 => p1=03, p2=20, p3=27
      if (p1 <= 12 && p2 === 20) {
         m = p1;
         y = parseInt(digits.slice(2, 6), 10);
      } else if (p2 <= 12) {
         d = p1;
         m = p2;
         y = 2000 + p3;
      } else {
         m = p1;
         y = parseInt(digits.slice(2, 6), 10);
      }
    } else if (digits.length === 8) {
      d = parseInt(digits.slice(0, 2), 10);
      m = parseInt(digits.slice(2, 4), 10);
      y = parseInt(digits.slice(4, 8), 10);
    } else {
      return input;
    }

    if (m >= 1 && m <= 12) {
      if (d === 0 || d > 31) {
        d = new Date(y, m, 0).getDate();
      }
      const dd = d.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      const yyyy = y.toString();
      return `${dd}/${mm}/${yyyy}`;
    }
    return input;
}

console.log("03/27 ->", parseExpiry("03/27"));
console.log("03/2027 ->", parseExpiry("03/2027"));
console.log("032027 ->", parseExpiry("032027"));
console.log("150327 ->", parseExpiry("150327"));
console.log("15032027 ->", parseExpiry("15032027"));
console.log("10/24 ->", parseExpiry("10/24"));

