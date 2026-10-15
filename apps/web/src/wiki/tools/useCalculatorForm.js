import { useState, useEffect } from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { setQuery } from "../core";
import { pets } from "../data";
import { statsDefaultsForPet } from "../statsProfiles";
import {matchesCatalogEntry} from '../../../../../packages/wiki-schema/src/catalog-routes';

function statsDefaults(query) {
  const pet =
    pets.find((item) => matchesCatalogEntry('pets', item, query.get('pet') || '')) ||
    pets.find((item) => item.slug === "bishui") ||
    pets[0];
  return statsDefaultsForPet(pet);
}

function damageDefaults(query) {
  const defaults = {
    category: "physical",
    mode: "ordinary",
    conditions: "plain",
    level: "100",
    power: "120",
    attack: "300",
    defense: "300",
    hp: "500",
    matchup: "neutral",
    attackStage: "0",
    defenseStage: "0",
    boost: "0",
    reduction: "0",
  };
  for (const key of Object.keys(defaults))
    if (query.has(key)) defaults[key] = query.get(key);
  return defaults;
}

function useCalculatorForm(defaultsForQuery, normalizeData = (data) => data) {
  const history = useHistory(),
    location = useLocation();
  function read(search) {
    const query = new URLSearchParams(search),
      defaults = defaultsForQuery(query),
      encoded = query.get("calc");
    if (!encoded) return { form: defaults, invalidLink: false };
    try {
      if (encoded.length > 6000) throw new Error("oversize");
      const parsed = JSON.parse(encoded);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
      const data = normalizeData(parsed);
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("shape");
      let invalidLink = false;
      const form = { ...defaults };
      for (const key of Object.keys(defaults)) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        const value = data[key];
        if (Array.isArray(defaults[key])) {
          if (
            !Array.isArray(value) ||
            value.length !== 6 ||
            value.some((x) => !["string", "number"].includes(typeof x))
          ) {
            invalidLink = true;
            continue;
          }
          form[key] = value.map(String);
        } else if (["string", "number"].includes(typeof value))
          form[key] = String(value);
        else invalidLink = true;
      }
      if (typeof form.pet === 'string' && form.pet !== 'custom') {
        const pet = pets.find(item => matchesCatalogEntry('pets', item, form.pet));
        if (pet) form.pet = pet.slug;
      }
      return { form, invalidLink };
    } catch {
      return { form: defaults, invalidLink: true };
    }
  }
  const [state, setState] = useState(() => read(location.search));
  useEffect(() => {
    setState(read(location.search));
  }, [location.search]);
  function update(changes) {
    const next = { ...state.form, ...changes };
    setState({ form: next, invalidLink: false });
    setQuery(history, location, { calc: JSON.stringify(next) });
  }
  function reset() {
    const next = defaultsForQuery(new URLSearchParams());
    setState({ form: next, invalidLink: false });
    // Reset known legacy scalar parameters too, retaining unrelated link context.
    const values = Object.fromEntries(
      Object.keys(next).map((key) => [key, null]),
    );
    setQuery(history, location, { ...values, calc: null });
  }
  return { ...state, update, reset };
}

export { statsDefaults, damageDefaults, useCalculatorForm };
