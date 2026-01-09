import type { Turn } from "@/main/database/types";
import { MarkdownRenderer } from "@/renderer/next/components/markdown-renderer";
import { useLiveTurnsWithSelector } from "@/renderer/next/hooks/remote/use-live-conversation-turns";

export type MessagesProps = {
  id: string;
};

export default function Messages(props: MessagesProps) {
  const turns = useLiveTurnsWithSelector(props.id, (raw) => raw.rows);

  const renderPrompt = (turn: Turn) => {
    if (turn.prompt.type === "user-input") {
      return (
        <div>
          <div className="ml-auto w-fit bg-gray-100 mb-8 p-3 rounded">
            {turn.prompt.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n")}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderReplay = (turn: Turn) => {
    if (turn.finishReason === "error") {
      return <div className="w-fit bg-red-100 mb-8 p-3 rounded text-xs">{turn.error || "Unknown error"}</div>;
    }

    return (
      <div className="mb-8">
        {turn.reply.map((part, index) => {
          const key = `part-${part.type}-${index}`;

          if (part.type === "text") {
            return <MarkdownRenderer source={part.text} key={key} />;
          }

          return null;
        })}
      </div>
    );
  };

  return (
    <div className="h-full pt-10 pb-20">
      {turns.map((turn) => {
        return (
          <>
            {renderPrompt(turn)} {renderReplay(turn)}
          </>
        );
      })}
    </div>
  );
}
