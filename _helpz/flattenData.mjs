// Flatten { key: value | [value, {extraKV}] } → { key, ...extraKV }.
// Mirrors tuna/mirror-web/_src/lib/helpz-libs.mjs but copied here to keep
// _helpz self-contained.

export function flattenData(data) {
  const result = {};
  Object.entries(data).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      result[k] = v[0];
    } else {
      result[k] = v;
    }
  });
  Object.entries(data).forEach(([, v]) => {
    if (Array.isArray(v)) {
      Object.entries(v[1] || {}).forEach(([k, v2]) => {
        result[k] = v2;
      });
    }
  });
  return result;
}
