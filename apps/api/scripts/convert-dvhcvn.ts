/**
 * Convert dvhcvn SQL dumps -> JSON seed files (chay 1 lan khi cap nhat dataset).
 *
 * Nguon: https://github.com/thanhtrungit97/dvhcvn
 *   seed-data/dvhcvn/provinces.sql      (pgsql, multi-row VALUES)
 *   seed-data/dvhcvn/wards.sql          (pgsql, multi-row VALUES)
 *   seed-data/dvhcvn/ward_mappings.sql  (mysql, 1 INSERT/dong)
 * Output: seed-data/dvhcvn/{provinces,wards,ward-mappings}.json
 *
 * Chay: pnpm ts-node scripts/convert-dvhcvn.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const DATA_DIR = path.join(__dirname, "..", "seed-data", "dvhcvn");

/** Tach 1 tuple SQL "(...)" thanh mang gia tri string|number|null. */
function parseTuple(tuple: string): (string | number | null)[] {
  const values: (string | number | null)[] = [];
  let i = 0;
  while (i < tuple.length) {
    const ch = tuple[i];
    if (ch === " " || ch === ",") {
      i++;
      continue;
    }
    if (ch === "'") {
      // chuoi: '' (pgsql) hoac \' (mysql) la escape cua dau nhay don
      let out = "";
      i++;
      while (i < tuple.length) {
        if (tuple[i] === "\\" && tuple[i + 1] === "'") {
          out += "'";
          i += 2;
        } else if (tuple[i] === "'" && tuple[i + 1] === "'") {
          out += "'";
          i += 2;
        } else if (tuple[i] === "'") {
          i++;
          break;
        } else {
          out += tuple[i++];
        }
      }
      values.push(out);
    } else {
      let raw = "";
      while (i < tuple.length && tuple[i] !== ",") raw += tuple[i++];
      raw = raw.trim();
      if (raw.toUpperCase() === "NULL") values.push(null);
      else if (raw !== "") values.push(Number.isNaN(Number(raw)) ? raw : Number(raw));
    }
  }
  return values;
}

/** Lay moi tuple (...) sau VALUES tu noi dung SQL (bo qua phan CREATE TABLE). */
function extractTuples(sqlText: string): string[] {
  const tuples: string[] = [];
  const valuesIdx = sqlText.search(/VALUES/i);
  let body = sqlText.slice(valuesIdx);
  // mysql dump: nhieu cau INSERT — gom tat ca phan sau VALUES cua tung cau
  body = body.replace(/INSERT INTO[^(]+\([^)]*\)\s*VALUES/gi, ",");
  let depth = 0;
  let current = "";
  let inString = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      current += ch;
      if (ch === "\\" && body[i + 1] === "'") {
        current += body[++i];
      } else if (ch === "'" && body[i + 1] === "'") {
        current += body[++i];
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
    } else if (ch === "(") {
      depth++;
      if (depth === 1) current = "";
      else current += ch;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) tuples.push(current);
      else current += ch;
    } else if (depth > 0) {
      current += ch;
    }
  }
  return tuples;
}

function convertProvinces(): number {
  const sqlText = fs.readFileSync(path.join(DATA_DIR, "provinces.sql"), "utf8");
  const rows = extractTuples(sqlText)
    .map(parseTuple)
    // bo tuple rac tu cau setval cuoi file (khong phai dong data)
    .filter((v) => typeof v[2] === "string" && /^\d{2}$/.test(String(v[1])))
    .map((v) => ({
      provinceCode: String(v[1]),
      name: String(v[2]),
      shortName: String(v[3]),
      code: String(v[4]),
      placeType: String(v[5]),
    }));
  fs.writeFileSync(path.join(DATA_DIR, "provinces.json"), JSON.stringify(rows, null, 1));
  return rows.length;
}

function convertWards(): number {
  const sqlText = fs.readFileSync(path.join(DATA_DIR, "wards.sql"), "utf8");
  const rows = extractTuples(sqlText)
    .map(parseTuple)
    // bo tuple rac tu cau setval cuoi file
    .filter((v) => /^\d{1,6}$/.test(String(v[1])) && typeof v[2] === "string")
    .map((v) => ({
      wardCode: String(v[1]),
      name: String(v[2]),
      provinceCode: String(v[3]),
    }));
  fs.writeFileSync(path.join(DATA_DIR, "wards.json"), JSON.stringify(rows, null, 1));
  return rows.length;
}

function convertWardMappings(): number {
  const sqlText = fs.readFileSync(path.join(DATA_DIR, "ward_mappings.sql"), "utf8");
  // chi lay phan records, bo CREATE TABLE mysql
  const recordsIdx = sqlText.indexOf("Records of ward_mappings");
  const rows = extractTuples(sqlText.slice(recordsIdx)).map(parseTuple).map((v) => ({
    oldWardCode: v[1] === null ? null : String(v[1]),
    oldWardName: v[2] === null ? null : String(v[2]),
    oldDistrictName: v[3] === null ? null : String(v[3]),
    oldProvinceName: v[4] === null ? null : String(v[4]),
    newWardCode: v[5] === null ? null : String(v[5]),
    newWardName: v[6] === null ? null : String(v[6]),
    newProvinceName: v[7] === null ? null : String(v[7]),
  }));
  fs.writeFileSync(path.join(DATA_DIR, "ward-mappings.json"), JSON.stringify(rows, null, 1));
  return rows.length;
}

const p = convertProvinces();
const w = convertWards();
const m = convertWardMappings();
console.log(`provinces.json: ${p} | wards.json: ${w} | ward-mappings.json: ${m}`);
if (p !== 34) throw new Error(`Ky vong 34 tinh, nhan ${p} — kiem tra parser/dataset`);
