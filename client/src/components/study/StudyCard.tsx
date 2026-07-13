import type { StudyItem } from "../../lib/studyQueue";
import BasicCard from "./BasicCard";
import ChoiceCard from "./ChoiceCard";
import ClozeCard from "./ClozeCard";
import TrueFalseCard from "./TrueFalseCard";
import TypeAnswerCard from "./TypeAnswerCard";

export interface StudyCardProps {
  item: StudyItem;
  onAnswer: (correct: boolean) => void;
}

/** Wählt den passenden Renderer je Kartentyp. */
export default function StudyCard({ item, onAnswer }: StudyCardProps) {
  switch (item.type) {
    case "type_answer":
      return <TypeAnswerCard item={item} onAnswer={onAnswer} />;
    case "choice":
      return <ChoiceCard item={item} onAnswer={onAnswer} />;
    case "truefalse":
      return <TrueFalseCard item={item} onAnswer={onAnswer} />;
    case "cloze":
      return <ClozeCard item={item} onAnswer={onAnswer} />;
    default:
      return <BasicCard item={item} onAnswer={onAnswer} />;
  }
}
