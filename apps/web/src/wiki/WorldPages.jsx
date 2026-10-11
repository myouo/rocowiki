import React from "react";
import EventPagesV7 from "./EventPagesV7";
import "./WorldPages.css";
import "./WorldV7.css";
import { WorldNotFound } from "./world/components.jsx";
import { AdventureHome } from "./world/AdventurePage.jsx";
import { PlaceDetail, PlacesIndex } from "./world/PlacesPages.jsx";
import { NpcDetail, NpcIndex } from "./world/NpcPages.jsx";
import { BattlePage, BattleRules } from "./world/BattlePages.jsx";
import { ChallengesIndex, StarTower } from "./world/ChallengePages.jsx";
import { ItemsIndex, PotionDetail } from "./world/ItemPages.jsx";
import { BadgesPage, TasksIndex } from "./world/TaskPages.jsx";

function WorldPages({ path, query = new URLSearchParams() }) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  if (path === "/adventure/") return <AdventureHome />;
  if (parts[0] === "places")
    return parts[1] ? (
      <PlaceDetail slug={parts[1]} />
    ) : (
      <PlacesIndex query={query} />
    );
  if (parts[0] === "npcs")
    return parts[1] ? (
      <NpcDetail slug={parts[1]} />
    ) : (
      <NpcIndex query={query} />
    );
  if (parts[0] === "events") return <EventPagesV7 path={path} query={query} />;
  if (parts[0] === "battle")
    return !parts[1] ? (
      <BattlePage query={query} />
    ) : parts[1] === "rules" ? (
      <BattleRules query={query} />
    ) : (
      <WorldNotFound kind="赛事" back="/battle/" />
    );
  if (parts[0] === "challenges")
    return !parts[1] ? (
      <ChallengesIndex />
    ) : parts[1] === "star-tower" ? (
      <StarTower query={query} />
    ) : (
      <WorldNotFound kind="挑战" back="/challenges/" />
    );
  if (parts[0] === "items")
    return !parts[1] ? (
      <ItemsIndex query={query} />
    ) : parts[1] === "potion" ? (
      <PotionDetail />
    ) : (
      <WorldNotFound kind="道具" back="/items/" />
    );
  if (parts[0] === "tasks")
    return !parts[1] ? (
      <TasksIndex query={query} />
    ) : parts[1] === "badges" ? (
      <BadgesPage query={query} />
    ) : (
      <WorldNotFound kind="任务" back="/tasks/" />
    );
  return null;
}

export default WorldPages;
