import React, { useId, useMemo, useState } from "react";
import "./StatsRadar.css";

/** Clockwise from the top. Keep this order shared with all numeric tables. */
export const STATS_RADAR_AXES = [
  { key: "hp", label: "精力", short: "HP" },
  { key: "atk", label: "物攻", short: "Atk" },
  { key: "def", label: "物防", short: "Def" },
  { key: "spAtk", label: "魔攻", short: "SpAtk" },
  { key: "spDef", label: "魔抗", short: "SpDef" },
  { key: "speed", label: "速度", short: "Speed" },
];

export const STATS_RADAR_COLORS = ["#426fa4", "#ba7044", "#8a638e"];
const LINE_STYLES = [undefined, "6 3", "2 3"];
const CENTER = { x: 210, y: 161 };
const RADIUS = 106;

function readStat(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

/**
 * A pure model builder, also useful to check upstream data.
 * Missing values remain null; a partial record is never drawn as a zero-filled pet.
 * All selected pets determine the scale, including series hidden by the legend.
 */
export function getStatsRadarModel(input = []) {
  const seen = new Set();
  const series = [];
  for (const pet of Array.isArray(input) ? input : []) {
    if (!pet || typeof pet !== "object") continue;
    const id = String(pet.slug || pet.id || pet.name || "pet-" + series.length);
    if (seen.has(id)) continue;
    seen.add(id);
    const values = STATS_RADAR_AXES.map((axis, index) =>
      readStat(
        Array.isArray(pet.stats) ? pet.stats[index] : pet.stats?.[axis.key],
      ),
    );
    series.push({
      id,
      name: String(pet.name || "未命名宠物"),
      values,
      complete: values.every((value) => value !== null),
      total: values.every((value) => value !== null)
        ? values.reduce((sum, value) => sum + value, 0)
        : null,
      color: STATS_RADAR_COLORS[series.length],
      dash: LINE_STYLES[series.length],
    });
    if (series.length === 3) break;
  }
  const highest = Math.max(
    0,
    ...series.flatMap((pet) => pet.values.filter((v) => v !== null)),
  );
  return { series, scale: Math.max(180, Math.ceil(highest / 30) * 30) };
}

/** Unrounded numerical position, so checking radial distance remains exact. */
export function getStatsRadarPoint(value, axisIndex, scale = 180) {
  const angle = -Math.PI / 2 + (axisIndex * Math.PI) / 3;
  const distance = (value / scale) * RADIUS;
  return {
    x: CENTER.x + Math.cos(angle) * distance,
    y: CENTER.y + Math.sin(angle) * distance,
  };
}

function polygonPoints(values, scale) {
  return values
    .map((value, axisIndex) => {
      const { x, y } = getStatsRadarPoint(value, axisIndex, scale);
      return x.toFixed(3) + "," + y.toFixed(3);
    })
    .join(" ");
}

function Marker({ index, x, y, color, size = 2.8 }) {
  const common = { fill: color, stroke: "#fffefa", strokeWidth: 1 };
  if (index === 1) {
    return (
      <path
        d={`M ${x} ${y - size - 0.6} L ${x + size + 0.6} ${y} L ${x} ${y + size + 0.6} L ${x - size - 0.6} ${y} Z`}
        {...common}
      />
    );
  }
  if (index === 2) {
    return (
      <rect
        x={x - size}
        y={y - size}
        width={size * 2}
        height={size * 2}
        rx="0.4"
        {...common}
      />
    );
  }
  return <circle cx={x} cy={y} r={size} {...common} />;
}

function LegendSwatch({ index, color, dash }) {
  return (
    <svg width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">
      <line
        x1="1"
        y1="7"
        x2="27"
        y2="7"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dash}
      />
      <Marker index={index} x={14} y={7} color={color} />
    </svg>
  );
}

/**
 * A dependency-free SVG plot of base stats; accepts the existing pet records.
 * Set showTable={false} only when the surrounding page already shows exact values.
 * The scale is a display scale, never a statement about a game's stat cap.
 */
export default function StatsRadar({
  pets = [],
  compact = false,
  showLegend = true,
  showTable = true,
}) {
  const uid = useId().replace(/:/g, "");
  const { series, scale } = useMemo(() => getStatsRadarModel(pets), [pets]);
  const [hidden, setHidden] = useState(() => new Set());
  const visible = series.filter((pet) => pet.complete && !hidden.has(pet.id));
  const comparing = series.length > 1;
  const titleId = "stats-radar-title-" + uid;
  const descriptionId = "stats-radar-description-" + uid;
  const captionId = "stats-radar-caption-" + uid;
  const noteId = "stats-radar-note-" + uid;
  const incomplete = series.filter((pet) => !pet.complete);
  const valuesText = (pet) =>
    pet.name +
    "：" +
    STATS_RADAR_AXES.map(
      (axis, index) => axis.label + " " + (pet.values[index] ?? "未收录"),
    ).join("，");

  function toggle(id) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!series.length) {
    return <p className="rw-stats-radar-empty">选择宠物后显示种族值六维图。</p>;
  }

  return (
    <figure
      className={
        "rw-stats-radar" +
        (compact ? " rw-stats-radar--compact" : "") +
        (comparing ? " rw-stats-radar--compare" : "")
      }
      aria-labelledby={captionId}
      aria-describedby={noteId}
    >
      <figcaption className="rw-stats-radar-heading" id={captionId}>
        <span>种族值六维图</span>
        <span className="rw-stats-radar-scale">统一刻度 0–{scale}</span>
      </figcaption>

      {showLegend && (
        <div
          className="rw-stats-radar-legend"
          role="group"
          aria-label="显示或隐藏宠物曲线"
        >
          {series.map((pet, index) => (
            <button
              key={pet.id}
              type="button"
              className={hidden.has(pet.id) ? "is-hidden" : ""}
              aria-pressed={!hidden.has(pet.id)}
              aria-label={
                (hidden.has(pet.id) ? "显示" : "隐藏") + pet.name + "的曲线"
              }
              disabled={!pet.complete}
              title={!pet.complete ? "种族值尚未完整收录" : undefined}
              onClick={() => toggle(pet.id)}
            >
              <LegendSwatch index={index} color={pet.color} dash={pet.dash} />
              <span>{pet.name}</span>
              {!pet.complete && <small>资料不全</small>}
            </button>
          ))}
        </div>
      )}

      <div className="rw-stats-radar-body">
        <div className="rw-stats-radar-plot">
          <svg
            viewBox="40 6 340 322"
            role="img"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <title id={titleId}>
              {series.map((pet) => pet.name).join("、") + "的种族值六维图"}
            </title>
            <desc id={descriptionId}>
              六个轴从顶部顺时针依次为精力、物攻、物防、魔攻、魔抗、速度。统一刻度从
              0 到 {scale}。
              {visible.length
                ? visible.map(valuesText).join("；") + "。"
                : "当前没有显示的曲线。"}
              曲线仅呈现基础种族值，不表示实战强度。
            </desc>
            <g className="rw-stats-radar-grid" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => {
                const value = (scale * (i + 1)) / 6;
                return (
                  <polygon
                    key={i}
                    className={i === 5 ? "is-outer" : ""}
                    points={polygonPoints(Array(6).fill(value), scale)}
                  />
                );
              })}
              {STATS_RADAR_AXES.map((axis, index) => {
                const edge = getStatsRadarPoint(scale, index, scale);
                return (
                  <line
                    key={axis.key}
                    x1={CENTER.x}
                    y1={CENTER.y}
                    x2={edge.x}
                    y2={edge.y}
                  />
                );
              })}
              {Array.from({ length: 6 }, (_, i) => (
                <text
                  key={i}
                  x={CENTER.x + 5}
                  y={CENTER.y - (RADIUS * (i + 1)) / 6 + 3}
                >
                  {(scale * (i + 1)) / 6}
                </text>
              ))}
              <text x={CENTER.x + 5} y={CENTER.y + 11}>
                0
              </text>
            </g>

            {series.map((pet, index) =>
              pet.complete ? (
                <g
                  key={pet.id}
                  className="rw-stats-radar-series"
                  style={{ opacity: hidden.has(pet.id) ? 0 : 1 }}
                  aria-hidden="true"
                >
                  <polygon
                    points={polygonPoints(pet.values, scale)}
                    fill={pet.color}
                    fillOpacity={comparing ? 0.055 : 0.1}
                    stroke={pet.color}
                    strokeWidth={2}
                    strokeDasharray={pet.dash}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {pet.values.map((value, axisIndex) => {
                    const point = getStatsRadarPoint(value, axisIndex, scale);
                    return (
                      <Marker
                        key={axisIndex}
                        index={index}
                        x={point.x}
                        y={point.y}
                        color={pet.color}
                      />
                    );
                  })}
                </g>
              ) : null,
            )}

            <g className="rw-stats-radar-labels" aria-hidden="true">
              {STATS_RADAR_AXES.map((axis, index) => {
                const angle = -Math.PI / 2 + (index * Math.PI) / 3;
                const x = CENTER.x + Math.cos(angle) * (RADIUS + 31);
                const y = CENTER.y + Math.sin(angle) * (RADIUS + 31);
                const anchor =
                  index === 0 || index === 3
                    ? "middle"
                    : index < 3
                      ? "start"
                      : "end";
                return (
                  <text
                    key={axis.key}
                    x={x}
                    y={y + (comparing ? 4 : -2)}
                    textAnchor={anchor}
                  >
                    <tspan>{axis.label}</tspan>
                    {!comparing && (
                      <tspan
                        className="rw-stats-radar-axis-value"
                        x={x}
                        dy="17"
                      >
                        {series[0].values[index] ?? "—"}
                      </tspan>
                    )}
                  </text>
                );
              })}
            </g>
            {!visible.length && (
              <text
                className="rw-stats-radar-no-series"
                x={CENTER.x}
                y={CENTER.y + 4}
                textAnchor="middle"
                aria-hidden="true"
              >
                {series.some((pet) => pet.complete)
                  ? "点击图例显示曲线"
                  : "种族值待补充"}
              </text>
            )}
          </svg>
        </div>

        {showTable && (
          <div className="rw-stats-radar-values">
            <table>
              <caption className="rw-stats-radar-sr-only">
                种族值精确数值；隐藏曲线时仍保留数值。
              </caption>
              <thead>
                <tr>
                  <th scope="col">种族值</th>
                  {series.map((pet, index) => (
                    <th
                      scope="col"
                      key={pet.id}
                      className={hidden.has(pet.id) ? "is-hidden" : ""}
                    >
                      <span className="rw-stats-radar-table-pet">
                        <LegendSwatch
                          index={index}
                          color={pet.color}
                          dash={pet.dash}
                        />
                        <span>{comparing ? pet.name : "数值"}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STATS_RADAR_AXES.map((axis, index) => {
                  const maximum = Math.max(
                    -1,
                    ...series.map((pet) => pet.values[index] ?? -1),
                  );
                  return (
                    <tr key={axis.key}>
                      <th scope="row">
                        {axis.label}
                        <small>{axis.short}</small>
                      </th>
                      {series.map((pet) => (
                        <td
                          key={pet.id}
                          className={
                            comparing &&
                            pet.values[index] !== null &&
                            pet.values[index] === maximum
                              ? "is-leading"
                              : undefined
                          }
                        >
                          {pet.values[index] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">种族总和</th>
                  {series.map((pet) => (
                    <td key={pet.id}>{pet.total ?? "—"}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {incomplete.length > 0 && (
        <p className="rw-stats-radar-incomplete">
          {incomplete.map((pet) => pet.name).join("、")}
          的六维尚未完整收录，暂不绘制曲线。
        </p>
      )}
      <p className="rw-stats-radar-note" id={noteId}>
        刻度上限 {scale} 用于读图，不代表游戏上限。基础种族值不等同实战强度。
        {comparing && showLegend
          ? " 点击图例可隐藏曲线，坐标刻度保持一致。"
          : ""}
      </p>
      <span
        className="rw-stats-radar-sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        当前显示
        {visible.length
          ? "：" + visible.map((pet) => pet.name).join("、")
          : " 0 条曲线"}
        。
      </span>
    </figure>
  );
}

export { StatsRadar };
