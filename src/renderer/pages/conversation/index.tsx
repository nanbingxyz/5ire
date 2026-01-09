import { Button } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SplitPane, { Pane } from "split-pane-react";
import Editor from "@/renderer/pages/conversation/Editor";
import Messages from "@/renderer/pages/conversation/Messages";

const ID = "4c1b1383-3481-47ff-b859-485b5decae27";

export default function Conversation() {
  const [searchParams] = useSearchParams();
  const [verticalSizes, setVerticalSizes] = useState(["auto", 200]);

  const project = searchParams.get("project");
  const id = searchParams.get("id");

  const verticalSashRender = () => <div className="border-t border-base" />;

  useEffect(() => {
    window.bridge.conversationsManager
      .getStageConversation({
        project: project ?? undefined,
      })
      .then(console.log);
  }, [project]);

  return (
    <div className="h-full overflow-y-auto absolute w-full top-0 left-0">
      <SplitPane split="horizontal" sizes={verticalSizes} onChange={setVerticalSizes} sashRender={verticalSashRender}>
        <Pane className="chat-content flex-grow">
          <div className="overflow-y-auto h-full">
            <div className="mx-auto max-w-screen-md px-5">{id && <Messages id={id} />}</div>
          </div>
        </Pane>
        <Pane minSize={180} maxSize="60%">
          <Editor />
          <Button
            onClick={() => {
              window.bridge.conversationsManager.startTurn({
                id: ID,
                prompt: {
                  type: "user-input",
                  content: [
                    {
                      type: "text",
                      text: "请使用 TypeScript 实现一个 JSON 解析器",
                    },
                  ],
                },
              });
            }}
          >
            Run
          </Button>
        </Pane>
      </SplitPane>
    </div>
  );
}
