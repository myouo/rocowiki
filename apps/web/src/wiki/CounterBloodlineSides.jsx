import React from "react";
import { Dna } from "lucide-react";
import { normalizeMatchupBloodline, matchupBloodlineText } from "./matchupBloodlines";
import EntityReference, { EntityText } from "./EntityReference";
import { bloodlineDetailHref } from "./catalogBloodlines";

/** This is the recorded battle loadout, never inferred from the species' options. */
export default function CounterBloodlineSides({ record, myName = "当前宠物", opponentName }) {
  const sides = [
    { side: "我方", name: myName, value: record.myBloodline },
    { side: "对手", name: opponentName || record.opponent || "对手", value: record.opponentBloodline },
  ];
  return <div className="rw-counter-bloodlines-v71" aria-label="双方本场血脉配置">
    {sides.map(({ side, name, value }) => {
      const row = normalizeMatchupBloodline(value);
      return <div className={`rw-counter-bloodline-side-v71 ${row.status}`} key={side}>
        <span className="rw-counter-bloodline-side-label-v71"><Dna size={15} />{side}血脉</span>
        <small>{name}</small>
        <strong>{row.status === "specified" && row.names.length ? row.names.map((name) => <EntityReference key={name} to={bloodlineDetailHref(name)}>{name}</EntityReference>) : matchupBloodlineText(row)}</strong>
        {row.note && <p><EntityText text={row.note} /></p>}
      </div>;
    })}
  </div>;
}
