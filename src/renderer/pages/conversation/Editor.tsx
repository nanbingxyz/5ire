import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProjectStageConversation } from "@/main/database/types";
import { useLiveConversationsWithSelector } from "@/renderer/next/hooks/remote/use-live-conversations";
import EditorToolbar, { type EditorToolbarProps } from "@/renderer/pages/conversation/EditorToolbar";

const EditorToolbarForStage = (props: { project?: string }) => {
  const [conversation, setConversation] = useState<ProjectStageConversation>();

  useEffect(() => {
    window.bridge.conversationsManager.getStageConversation({ project: props.project }).then((conversation) => {
      setConversation(conversation);
    });
  }, [props.project]);

  const config = useMemo<EditorToolbarProps["config"]>(() => {
    if (conversation) {
      return {
        model: conversation.model,
      };
    }
    return {};
  }, [conversation]);

  return (
    <EditorToolbar
      config={config || {}}
      onModelSelected={(model) => {
        window.bridge.conversationsManager
          .setStageConversation({
            project: props.project,
            config: { ...config, model },
          })
          .then(() => {
            window.bridge.conversationsManager.getStageConversation({ project: props.project }).then((conversation) => {
              setConversation(conversation);
            });
          });
      }}
    />
  );
};

const EditorToolbarForConversation = (props: { id: string; project?: string }) => {
  const conversation = useLiveConversationsWithSelector(props.project, (raw) => {
    return raw.rows.find((conversation) => conversation.id === props.id);
  });

  const config = useMemo<EditorToolbarProps["config"]>(() => {
    if (conversation) {
      return {
        model:
          conversation.providerId && conversation.model
            ? {
                name: conversation.model,
                provider: conversation.providerId,
              }
            : undefined,
      };
    }
    return {};
  }, [conversation]);

  return (
    <EditorToolbar
      config={config || {}}
      onModelSelected={(model) => {
        if (conversation) {
          window.bridge.conversationsManager.updateConversation({
            id: conversation.id,
            config: conversation.config,
            model: model.name,
            providerId: model.provider,
            summary: conversation.summary,
          });
        }
      }}
    />
  );
};

export default function Editor() {
  const [searchParams] = useSearchParams();

  const id = searchParams.get("id");
  const project = searchParams.get("project");

  return (
    <div>
      {id ? (
        <EditorToolbarForConversation id={id} project={project ?? undefined} />
      ) : (
        <EditorToolbarForStage project={project ?? undefined} />
      )}
    </div>
  );
}
