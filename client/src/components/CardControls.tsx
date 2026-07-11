import { useMemo } from "react";
import { useLocale } from "../i18n";
import { cardConfidence } from "../lib/mastery";
import { hasImage, plainExcerpt } from "../lib/markdown";
import type { Bucket } from "../lib/mastery";
import type { Card } from "../types";

export type SortKey = "created" | "alpha-asc" | "alpha-desc" | "confidence-asc" | "confidence-desc";
export type BucketFilter = "all" | Bucket;
export type DirectionFilter = "all" | "bidirectional" | "oneway";
export type ImageFilter = "all" | "with" | "without";

export interface CardFilterState {
  search: string;
  sort: SortKey;
  bucket: BucketFilter;
  direction: DirectionFilter;
  image: ImageFilter;
}

export const DEFAULT_FILTER: CardFilterState = {
  search: "",
  sort: "created",
  bucket: "all",
  direction: "all",
  image: "all",
};

export function isDefaultFilter(f: CardFilterState): boolean {
  return (
    f.search.trim() === "" &&
    f.sort === "created" &&
    f.bucket === "all" &&
    f.direction === "all" &&
    f.image === "all"
  );
}

/** Wendet Suche + Filter + Sortierung an. Verändert die Eingabeliste nicht. */
export function useFilteredCards(cards: Card[], f: CardFilterState): Card[] {
  return useMemo(() => {
    const needle = f.search.trim().toLowerCase();
    let result = cards.filter((card) => {
      if (f.bucket !== "all" && cardConfidence(card).minBucket !== f.bucket) return false;
      if (f.direction === "bidirectional" && !card.bidirectional) return false;
      if (f.direction === "oneway" && card.bidirectional) return false;
      if (f.image !== "all") {
        const withImage = hasImage(card.front) || hasImage(card.back);
        if (f.image === "with" && !withImage) return false;
        if (f.image === "without" && withImage) return false;
      }
      if (needle) {
        const hay = `${plainExcerpt(card.front, 10000)} ${plainExcerpt(card.back, 10000)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    if (f.sort !== "created") {
      result = [...result].sort((a, b) => {
        switch (f.sort) {
          case "alpha-asc":
            return plainExcerpt(a.front).localeCompare(plainExcerpt(b.front));
          case "alpha-desc":
            return plainExcerpt(b.front).localeCompare(plainExcerpt(a.front));
          case "confidence-asc":
            return cardConfidence(a).minLevel - cardConfidence(b).minLevel;
          case "confidence-desc":
            return cardConfidence(b).minLevel - cardConfidence(a).minLevel;
          default:
            return 0;
        }
      });
    }
    return result;
  }, [cards, f]);
}

interface Props {
  value: CardFilterState;
  onChange: (next: CardFilterState) => void;
}

export default function CardControls({ value, onChange }: Props) {
  const { t } = useLocale();
  const set = <K extends keyof CardFilterState>(key: K, v: CardFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="card-controls">
      <input
        type="text"
        className="card-search"
        placeholder={t("cards.search")}
        value={value.search}
        onChange={(e) => set("search", e.target.value)}
      />
      <label className="control-select">
        <span>{t("cards.sort")}</span>
        <select value={value.sort} onChange={(e) => set("sort", e.target.value as SortKey)}>
          <option value="created">{t("cards.sort.created")}</option>
          <option value="alpha-asc">{t("cards.sort.alphaAsc")}</option>
          <option value="alpha-desc">{t("cards.sort.alphaDesc")}</option>
          <option value="confidence-asc">{t("cards.sort.confAsc")}</option>
          <option value="confidence-desc">{t("cards.sort.confDesc")}</option>
        </select>
      </label>
      <label className="control-select">
        <span>{t("cards.filterConfidence")}</span>
        <select value={value.bucket} onChange={(e) => set("bucket", e.target.value as BucketFilter)}>
          <option value="all">{t("cards.all")}</option>
          <option value="new">{t("bucket.new")}</option>
          <option value="learning">{t("bucket.learning")}</option>
          <option value="known">{t("bucket.known")}</option>
          <option value="mastered">{t("bucket.mastered")}</option>
        </select>
      </label>
      <label className="control-select">
        <span>{t("cards.filterDirection")}</span>
        <select value={value.direction} onChange={(e) => set("direction", e.target.value as DirectionFilter)}>
          <option value="all">{t("cards.all")}</option>
          <option value="bidirectional">{t("card.bidirectional")}</option>
          <option value="oneway">{t("card.oneway")}</option>
        </select>
      </label>
      <label className="control-select">
        <span>{t("cards.filterImage")}</span>
        <select value={value.image} onChange={(e) => set("image", e.target.value as ImageFilter)}>
          <option value="all">{t("cards.all")}</option>
          <option value="with">{t("cards.withImage")}</option>
          <option value="without">{t("cards.withoutImage")}</option>
        </select>
      </label>
      {!isDefaultFilter(value) && (
        <button className="card-controls-reset" onClick={() => onChange(DEFAULT_FILTER)}>
          {t("cards.reset")}
        </button>
      )}
    </div>
  );
}
