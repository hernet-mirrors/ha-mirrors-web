// Render helpers for z-form controls and code blocks.
// Ref: tuna/mirror-web/_helpz/templates.tsx (plain strings, no React).

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderZForm(codeId, inputChoices, inputVars, counterGen) {
  const items = inputChoices.map((inputName) => {
    const input = inputVars[inputName] || {};
    const inputId = "zhelp-input-" + counterGen();
    const toolTip = input.note ? ` title="${escapeAttr(input.note)}"` : "";
    const dataForCode = ` data-z-for-code="${codeId}"`;
    const dataName = ` data-z-name="${escapeAttr(inputName)}"`;
    let control;

    if (input.option) {
      const options = Object.entries(input.option).map(([optionName, optionValue]) => {
        const attrs = [];
        if (optionValue) {
          Object.entries(optionValue).forEach(([k, v]) => {
            if (k !== "default" && k !== "_") {
              attrs.push(`data-z-set-${escapeAttr(k)}="${escapeAttr(v)}"`);
            }
          });
        }
        const label = (optionValue && optionValue["_"]) ? optionValue["_"] : optionName;
        return `<option value="${escapeAttr(optionName)}" ${attrs.join(" ")}>${escapeText(label)}</option>`;
      }).join("");
      const defaultVal = input.default ? ` data-default="${escapeAttr(input.default)}"` : "";
      control = `<select id="${inputId}" class="form-select form-select-sm zhelp-field-control"${dataName}${dataForCode}${toolTip}${defaultVal}>${options}</select>`;
    } else if (input["true"] !== undefined || input["false"] !== undefined) {
      const checked = input.default ? " checked" : "";
      const dataTrue = input["true"] !== undefined ? ` data-z-true="${escapeAttr(input["true"])}"` : "";
      const dataFalse = input["false"] !== undefined ? ` data-z-false="${escapeAttr(input["false"])}"` : "";
      control = `<div class="form-control form-switch form-check zhelp-field-control"><input id="${inputId}" class="form-check-input" type="checkbox"${dataName}${dataForCode}${toolTip}${checked}${dataTrue}${dataFalse}></div>`;
    } else {
      const defaultVal = input.default ? ` value="${escapeAttr(input.default)}"` : "";
      control = `<input id="${inputId}" class="form-control form-control-sm zhelp-field-control" type="text"${dataName}${dataForCode}${toolTip}${defaultVal}>`;
    }

    return `<div class="zhelp-field"${toolTip}><label class="zhelp-field-label" for="${inputId}">${escapeText(input["_"] || inputName)}</label>${control}</div>`;
  }).join("");

  return `<div class="zhelp-form">${items}</div>`;
}

export function renderCodeBlock(originalCode, renderedCode, otherAttrs) {
  const attrs = Object.entries(otherAttrs || {})
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join("");
  const originalCodeBlock = originalCode != null
    ? `<code data-original-code>${escapeText(originalCode)}</code>`
    : "";
  return `<pre${attrs} class="codeblock"><code>${renderedCode}</code>${originalCodeBlock}<button type="button" class="btn-clipboard" aria-label="Copy to clipboard"><span><i class="far fa-clipboard"></i><i data-checked class="fas fa-clipboard-check"></i></span></button></pre>`;
}
