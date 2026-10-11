import React from "react";
import { ExternalLink } from "lucide-react";
import CustomSelect from "../Select";
import { calculatorData as calculatorSources } from "../content/bundled.js";

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  hint,
  className = "",
}) {
  return (
    <label className={"rw-calc-field " + className}>
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  searchable = false,
}) {
  return (
    <div className="rw-calc-field">
      <span>{label}</span>
      <CustomSelect
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options}
        searchable={searchable}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

function CalculatorErrors({ errors }) {
  return (
    <div className="rw-calc-errors" role="status">
      <strong>先调整这些参数</strong>
      <ul>
        {errors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function SourcesDetails({ ids, children }) {
  return (
    <details className="rw-calc-sources">
      <summary>公式、来源与适用边界</summary>
      <div className="rw-calc-source-body">
        {children}
        <h3>查阅原始资料</h3>
        <ul>
          {calculatorSources.sources
            .filter((source) => ids.includes(source.id))
            .map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title} <ExternalLink size={13} />
                </a>
                <small>
                  {source.author} · {source.published} · {source.kind}
                </small>
                <p>
                  {source.locator}。{source.verification}。
                </p>
              </li>
            ))}
        </ul>
      </div>
    </details>
  );
}

export { NumberField, SelectField, CalculatorErrors, SourcesDetails };
