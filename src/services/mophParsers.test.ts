import { describe, it, expect } from 'vitest';
import {
  stripTrailingComma,
  parseXlsPriceNumber,
  parseLnddSearchTable,
  pickBestIngredient,
  type LnddRow,
} from './mophParsers';

// Mirrors the actual moph.gov.lb LNDD search page: every cell links to the
// detail page and the PRICE cell spans multiple lines (this is what previously
// broke the parser — regexes without the 's' flag).
const LNDD_HTML_FIXTURE = `<!DOCTYPE html>
<html><body>
<table>
  <tbody>
    <tr>
      <td><a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">A07AA02</a></td>
      <td><a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">MEDISTAN</a></td>
      <td><a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">G</a></td>
      <td><a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">Nystatin - 500,000IU</a></td>
      <td><a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">500,000IU</a></td>
      <td><a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">Capsule</a></td>
      <td>
        <a href="/en/Drugs/view/296" onclick="view_shop('/en/Drugs/view/296');return false;" class="drugLink">
          417,231 L.L<!--    					<br/>-->
        </a>
      </td>
    </tr>
    <tr>
      <td><a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">A07AA02</a></td>
      <td><a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">MEDISTAN</a></td>
      <td><a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">G</a></td>
      <td><a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">Nystatin - 200.000IU</a></td>
      <td><a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">200.000IU</a></td>
      <td><a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">Lozenge</a></td>
      <td>
        <a href="/en/Drugs/view/297" onclick="view_shop('/en/Drugs/view/297');return false;" class="drugLink">
          418,511 L.L<!--    					<br/>-->
        </a>
      </td>
    </tr>
  </tbody>
</table>
</body></html>`;

describe('stripTrailingComma', () => {
  it('removes trailing commas and whitespace', () => {
    expect(stripTrailingComma('417,231,'.replace(/[,\s]+$/, '').trim())).toEqual('417,231');
    expect(stripTrailingComma(' 23.08 ,')).toEqual('23.08');
    expect(stripTrailingComma('plain')).toEqual('plain');
    expect(stripTrailingComma('')).toEqual('');
  });
});

describe('parseXlsPriceNumber', () => {
  it('parses numbers from XLS cell values', () => {
    expect(parseXlsPriceNumber(417231)).toEqual(417231);
    expect(parseXlsPriceNumber(23.08)).toEqual(23.08);
    expect(parseXlsPriceNumber('417,231')).toEqual(417231);
    expect(parseXlsPriceNumber('1,234,567.5')).toEqual(1234567.5);
  });
  it('returns null for empty/garbage/non-finite values', () => {
    expect(parseXlsPriceNumber('')).toBeNull();
    expect(parseXlsPriceNumber(null)).toBeNull();
    expect(parseXlsPriceNumber(undefined)).toBeNull();
    expect(parseXlsPriceNumber('N/A')).toBeNull();
    expect(parseXlsPriceNumber(Number.NaN)).toBeNull();
  });
});

describe('parseLnddSearchTable', () => {
  it('parses result rows including multi-line price cells', () => {
    const rows = parseLnddSearchTable(LNDD_HTML_FIXTURE);
    expect(rows).toHaveLength(2);

    const first = rows[0];
    expect(first.viewId).toEqual('296');
    expect(first.atc).toEqual('A07AA02');
    expect(first.name).toEqual('MEDISTAN');
    expect(first.bg).toEqual('G');
    expect(first.ingredients).toEqual('Nystatin - 500,000IU');
    expect(first.dosage).toEqual('500,000IU');
    expect(first.form).toEqual('Capsule');

    const second = rows[1];
    expect(second.viewId).toEqual('297');
    expect(second.dosage).toEqual('200.000IU');
    expect(second.form).toEqual('Lozenge');
  });

  it('returns empty array when no result rows exist', () => {
    expect(parseLnddSearchTable('<html><body>No results found.</body></html>')).toEqual([]);
  });
});

describe('pickBestIngredient', () => {
  const rows: LnddRow[] = [
    {
      viewId: '296', atc: 'A07AA02', name: 'MEDISTAN', bg: 'G',
      ingredients: 'Nystatin - 500,000IU', dosage: '500,000IU', form: 'Capsule', priceText: '417,231 L.L',
    },
    {
      viewId: '297', atc: 'A07AA02', name: 'MEDISTAN', bg: 'G',
      ingredients: 'Nystatin - 200.000IU', dosage: '200.000IU', form: 'Lozenge', priceText: '418,511 L.L',
    },
    {
      viewId: '111', atc: 'J01', name: 'PANADOL', bg: 'G',
      ingredients: 'Paracetamol - 500mg', dosage: '500MG', form: 'Tablet', priceText: '100 L.L',
    },
  ];

  it('prefers exact name + matching dosage and form', () => {
    expect(pickBestIngredient(rows, 'MEDISTAN', '500,000IU', 'Capsule')).toEqual('Nystatin - 500,000IU');
    expect(pickBestIngredient(rows, 'MEDISTAN', '200.000IU', 'Lozenge')).toEqual('Nystatin - 200.000IU');
  });

  it('falls back to the exact-name row when dosage/form differ', () => {
    expect(pickBestIngredient(rows, 'PANADOL', '650MG', 'Tablet')).toEqual('Paracetamol - 500mg');
  });

  it('returns empty when no name matches', () => {
    expect(pickBestIngredient(rows, 'EGGIXIX', '', '')).toEqual('');
  });
});