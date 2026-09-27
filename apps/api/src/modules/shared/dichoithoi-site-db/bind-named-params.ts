/**
 * Doi SQL dung tham so co ten `@name` sang dang vi tri `$1, $2...` cua node-postgres.
 * Giu SQL trong adapter doc duoc nhu ban SQL Server cu (dichoithoi-postgres-migration-plan.md
 * Giai doan 3) thay vi dem tay $1..$20. Cung 1 ten dung nhieu lan -> cung 1 vi tri.
 *
 * Chi nhan ten bat dau bang chu cai/_ (khong dung dau `@` cho toan tu PG trong SQL cua adapter).
 * Thieu gia tri cho 1 ten -> nem loi ngay (bug lap trinh, khong phai loi du lieu).
 */
export function bindNamedParams(
  sqlText: string,
  values: Readonly<Record<string, unknown>>,
): { text: string; params: unknown[] } {
  const positionByName = new Map<string, number>();
  const params: unknown[] = [];

  const text = sqlText.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      throw new Error(`Thieu gia tri cho tham so @${name}`);
    }
    let position = positionByName.get(name);
    if (position === undefined) {
      params.push(values[name]);
      position = params.length;
      positionByName.set(name, position);
    }
    return `$${position}`;
  });

  return { text, params };
}
